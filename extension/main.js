//@ts-check
/// <reference path="index.d.ts" />

const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const log = require('./console-logger');
const vscodeHelper = require('./vscode-helper');
const { createProjectParser, MODELS_DIR } = require('./parser/parse-project');

const JAVASCRIPTS = ['javascript', 'javascriptreact'];
const JAVASCRIPTS_MAP = {};
JAVASCRIPTS.forEach(key => { JAVASCRIPTS_MAP[key] = key; });

let projectParsers = [{
	project: '',
	/** @type {vscode.FileSystemWatcher} */
	watcher: null,
	parser: createProjectParser(null)
}].slice(0, 0);

/** @type {vscode.TreeDataProvider & {refresh: Function}} */
let modelTreeProvider = null;

/** @param {vscode.TextDocument} document */
function getProjectPath(document) {
	if (!Object.prototype.hasOwnProperty.call(JAVASCRIPTS_MAP, document.languageId)) return;
	if (!document.uri) return;
	const folder = vscode.workspace.getWorkspaceFolder(document.uri);
	if (!folder || !folder.uri || !folder.uri.fsPath) return;
	return folder.uri.fsPath;
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {vscode.CancellationToken} token
 */
function provideDefinition(document, position, token) {
	const projectPath = getProjectPath(document);
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
	const projectPath = getProjectPath(document);
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
	const onDidChangeTreeData = new vscode.EventEmitter();
	const provider = {
		refresh: what => onDidChangeTreeData.fire(what),
		//@ts-ignore
		onDidChangeTreeData: (...p) => onDidChangeTreeData.event(...p),
		getTreeItem: it => it,
		getChildren: it => {
			if (!it) {
				// root level
				return projectParsers.filter(it => it.parser.isOk()).map(it => {
					const treeItem = new vscode.TreeItem(path.basename(it.project), vscode.TreeItemCollapsibleState.Expanded)
					treeItem.id = 'project:' + it.project;
					return treeItem;
				});
			}
			if (typeof it.id !== 'string' || !it.id) return null;
			const parentId = String(it.id);
			if (parentId.startsWith('project:')) {
				const projectPath = parentId.slice('project:'.length);
				const project = projectParsers.find(it => it.project == projectPath);
				if (!project) return null;
				return project.parser.getAllModelNames().map(it => {
					const treeItem = new vscode.TreeItem(it, vscode.TreeItemCollapsibleState.Expanded)
					treeItem.id = 'model:' + it + '\nproject' + projectPath;
					return treeItem;
				});
			}
			if (parentId.startsWith('model:')) {
				//todo
			}
			return null;
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

	/** @type {vscode.DocumentFilter[]} */
	const documentSelectors = JAVASCRIPTS.map(it => ({
		scheme: 'file',
		language: it,
	}));

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

	log.debug('activated done!');
}

function deactivate() { }

exports.activate = activate;
exports.deactivate = deactivate;
