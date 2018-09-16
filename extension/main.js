//@ts-check
/// <reference path="index.d.ts" />

const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const log = require('./console-logger');
const vscodeHelper = require('./vscode-helper');
const vscodeIcon = require('./vscode-icon');
const { createProjectParser, MODELS_DIR } = require('./parser/parse-project');

let projectParsers = [{
	project: '',
	/** @type {vscode.FileSystemWatcher} */
	watcher: null,
	parser: createProjectParser(null)
}].slice(0, 0);

/** @type {vscode.TreeDataProvider & {refresh: Function}} */
let modelTreeProvider = null;


/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {vscode.CancellationToken} token
 */
function provideDefinition(document, position, token) {
	if (!vscodeHelper.isJavascriptDocument(document)) return;
	const projectPath = vscodeHelper.getProjectPathByDocument(document);
	const it = projectParsers.find(it => it.project == projectPath);
	if (!it) return null;

	const { parser } = it;
	const filePath = document.uri.fsPath;
	const lineText = document.lineAt(position).text;
	const pos = position.character;

	let beforeText = lineText.slice(0, pos);
	let afterText = lineText.slice(pos);
	beforeText = (beforeText.match(/[\w\/]*$/) || [''])[0];
	afterText = (afterText.match(/^[\w\/]*/) || [''])[0];

	const definition = beforeText + afterText;

	const parts = definition.split(/[\/.]/);
	log.debug("[" + parts.join(', ') + "]");

	const location = parser.getModelLocation(parts[0], parts[1]);
	if (location) return location;

	const model = parser.getModelByFilePath(filePath);
	if (!model) return null;
	const options = { ignoreEffects: true, ignoreStates: true, noDefault: true };
	for (const part of parts) {
		const loc = parser.getModelLocation(model.namespace, part, options);
		if (loc) return loc;
	}
	return null;
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function provideCompletionItems(document, position) {
	if (!vscodeHelper.isJavascriptDocument(document)) return;
	const projectPath = vscodeHelper.getProjectPathByDocument(document);
	const it = projectParsers.find(it => it.project == projectPath);
	if (!it) return null;

	const { parser } = it;
	const lineText = document.lineAt(position).text;
	const pos = position.character;

	const beforeText = lineText.slice(0, pos);
	const beforeTextLower = beforeText.toLowerCase();

	const _beforeWord = beforeText.match(/(\w+)$/);
	const beforeWord = _beforeWord ? _beforeWord[1] : '';

	const inModel = parser.getModelByFilePath(document.uri.fsPath);
	const results = [];

	if (inModel) {
		if (beforeTextLower.match(/\b(select|state)\b/)) {
			const r = parser.getStatesCompletion(inModel, beforeWord);
			if (r) results.push(...r);
		}
		if (beforeText.match(/\b(select)\b/)) {
			const r = parser.getModelCompletions(beforeWord);
			if (r) results.push(...r);
		}
		const r = parser.getEffectsAndReducersCompletions(inModel.namespace, beforeWord, { ignoreEffects: true });
		if (r) results.push(...r);
	} else {
		if (beforeTextLower.match(/\b(?:models|props|dispatch|connect|easydispatch|effects|loading)\b/)) {
			const r = parser.getModelCompletions(beforeWord);
			if (r) results.push(...r);
		}
		const mtx = beforeText.match(/(\w+)[\.\[\/'"`](\w*)$/)
		if (mtx) {
			const r = parser.getEffectsAndReducersCompletions(mtx[1], mtx[2]);
			if (r) results.push(...r);
		}
	}
	return results;
}

function reloadParser() {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length <= 0)
		return;
	if (projectParsers && projectParsers.length > 0)
		projectParsers.filter(it => it.watcher).forEach(it => it.watcher.dispose());

	projectParsers = folders.map(it => ({
		project: it.uri.fsPath,
		watcher: null,
		parser: createProjectParser(it.uri.fsPath)
	}));

	return Promise.all(projectParsers.map(it => it.parser.parse())).then(() => {
		log.debug('reloadParser');

		projectParsers.forEach(it => {
			if (it.parser.isOk()) {
				if (!it.watcher) {
					it.watcher = vscode.workspace.createFileSystemWatcher(
						new vscode.RelativePattern(it.project, `${MODELS_DIR}/*.js`),
						false, false, true // ignoreCreate, ignoreChange, ignoreDelete
					);
					it.watcher.onDidChange(onFileModify);
					it.watcher.onDidCreate(onFileModify);
					log.debug(`createFileSystemWatcher for ${it.project}`);
				}
				// console.log(it.parser.getReportInfo())
			}
		});

		if (modelTreeProvider && typeof modelTreeProvider.refresh == 'function')
			modelTreeProvider.refresh(null);
		return Promise.resolve(true);
	}).catch(ex => {
		console.error(ex.stack)
	});
}

/** @param {vscode.Uri} uri */
function onFileModify(uri) {
	if (!uri) return;
	// log.debug(`onFileModify: ${uri.fsPath}`);

	const folder = vscode.workspace.getWorkspaceFolder(uri);
	if (!folder || !folder.uri || !folder.uri.fsPath) return;

	const it = projectParsers.find(it => it.project == folder.uri.fsPath);
	if (!it) return;

	it.parser.reloadModel(uri.fsPath);
}

/** @returns {vscode.TreeDataProvider & {refresh: Function}} */
function createModelsTreeProvider() {
	const dirIcon = vscodeIcon.getIcon('dir.svg');

	/** @type {{project?: string; model?: string;}[]} */
	let data = [];
	const onDidChangeTreeData = new vscode.EventEmitter();
	const provider = {
		refresh: what => { data = []; onDidChangeTreeData.fire(what); },
		//@ts-ignore
		onDidChangeTreeData: (...p) => onDidChangeTreeData.event(...p),
		getTreeItem: it => it,
		getChildren: parent => {
			if (!parent) {
				// root level
				return projectParsers.filter(it => it.parser.isOk()).map(it => {
					const treeItem = new vscode.TreeItem(path.basename(it.project), vscode.TreeItemCollapsibleState.Expanded)
					treeItem.id = (data.push({ project: it.project }) - 1).toString();
					treeItem.iconPath = dirIcon;
					return treeItem;
				});
			}
			if (typeof parent.id !== 'string' || !parent.id) return null;
			const parentInfo = data[parseInt(parent.id, 10)];
			if (!parentInfo || !parentInfo.project) return null;

			const project = projectParsers.find(it => it.project == parentInfo.project);
			if (!project) return null;

			if (parentInfo.model) return null;
			return project.parser.getAllModelNames().map(modelName => {
				const treeItem = new vscode.TreeItem(modelName, vscode.TreeItemCollapsibleState.None);
				treeItem.id = (data.push({ project: parentInfo.project, model: modelName }) - 1).toString();
				treeItem.command = {
					command: 'antdesignpro.gotomodel',
					title: 'Goto model',
					arguments: [parentInfo.project, modelName],
				};
				return treeItem;
			});
		},
	};
	return provider;
}

/**
 * Extension Entry  插件入口
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	log.debug('activating ...');

	if (!reloadParser())
		return;

	const documentSelectors = vscodeHelper.getJavascriptDocumentSelector();

	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(documentSelectors, { provideDefinition }));

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(documentSelectors, {
			provideCompletionItems,
			resolveCompletionItem: item => item
		}, '.', '/'));


	modelTreeProvider = createModelsTreeProvider();
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('ant-design-pro-modules', modelTreeProvider));

	context.subscriptions.push(
		vscode.commands.registerCommand('antdesignpro.reload', () => {
			const thenable = reloadParser();
			if (!thenable) return;
			thenable.then(ok => {
				if (ok) return vscodeHelper.showMessage(`Reload Ant Design Pro data success!`)
				throw new Error(`Reload failed!`);
			}).catch(ex => {
				vscodeHelper.showErrorMessage(ex.name || 'error');
			})
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('antdesignpro.gotomodel', (projectPath, modelName) => {
			if (!projectPath) {
				const activeEditor = vscode.window.activeTextEditor;
				if (!activeEditor || !activeEditor.document) return;
				projectPath = vscodeHelper.getProjectPathByDocument(activeEditor.document);
			}

			const it = projectParsers.find(it => it.project == projectPath);
			if (!it) return;

			if(modelName) return gotModelName(modelName);
			vscode.window.showQuickPick(it.parser.getAllModelNames())
				.then(modelName => { if (modelName) gotModelName(modelName); });

			function gotModelName(modelName) {
				const model = it.parser.getModelByName(modelName);
				if (!model) return;

				vscode.workspace.openTextDocument(vscode.Uri.file(model.file))
					.then(document => vscode.window.showTextDocument(document));
			}
		}));

	log.debug('activated done!');
}

function deactivate() { }

exports.activate = activate;
exports.deactivate = deactivate;
