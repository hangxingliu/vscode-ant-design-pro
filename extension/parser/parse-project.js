//@ts-check
/// <reference path="../index.d.ts" />

const fs = require('fs-extra');
const path = require('path');
const vscode = require('vscode');
const log = require('../console-logger');
const { parseAntDesignProModuleFile } = require('./parse-antd-module');

let modelsDir = 'src/models';
const AT_START = new vscode.Position(0, 0);

module.exports = {
	createProjectParser,
	getModelsDir: () => modelsDir,
	setModelsDir: _dir => modelsDir = _dir,
};

/**
 * @param {string} projectPath
 */
function createProjectParser(projectPath) {
	/** @type {{[namespace: string]: AntdModuleParserResult}} */
	const models = {};
	let ok = false;
	return {
		isOk: () => ok,
		getAllModelNames: () => Object.keys(models),
		parse, getReportInfo, getModelLocation, reloadModel,
		getModelByFilePath, getModelByName,
		getModelCompletions, getStatesCompletion, getEffectsAndReducersCompletions,
	};

	function parse() {
		const modelsDirFullPath = path.join(projectPath, modelsDir);
		ok = false;
		return fs.stat(modelsDirFullPath)
			.then(stat => { ok = stat.isDirectory() }).catch(() => { })
			.then(() => {
				if (!ok)
					return Promise.resolve(false);
				return fs.readdir(modelsDirFullPath)
					.then(files => {
						return Promise.all(
							files
								.map(file => path.join(modelsDirFullPath, file))
								.filter(it => /\.[jt]sx?$/i.test(it) && fs.statSync(it).isFile())
								.map(file => parseAntDesignProModuleFile(file)));
					}).then(results => {
						results.filter(it => it.ok).forEach(it => { models[it.namespace] = it; });
						return true;
					})
			});
	}

	/** @param {string} filePath */
	function getModelByFilePath(filePath) {
		for (const namespace in models) {
			const it = models[namespace];
			if (it.file == filePath)
				return it;
		}
	}

	/** @param {string} modelName */
	function getModelByName(modelName) {
		const model = models[modelName];
		if (!model || !model.ok) return null;
		return model;
	}

	/**
	 * @param {string} filePath
	 * @param {string} [unsavedContent]
	 */
	function reloadModel(filePath, unsavedContent = null) {
		return parseAntDesignProModuleFile(filePath, unsavedContent)
			.then(it => {
				if (it.ok)
					models[it.namespace] = it;
				return Promise.resolve(true);
			}).catch(ex => { log.error(ex.stack || ex); return Promise.resolve(false); });
	}

	/**
	 * @param {string} prefix
	 */
	function getModelCompletions(prefix = '') {
		let names = Object.keys(models);
		const lowerPrefix = prefix.toLowerCase();
		if (prefix)
			names = names.filter(name => name.toLowerCase().startsWith(lowerPrefix));
		return names.map(name => _newCompletionItem(name, vscode.CompletionItemKind.Module,
			`model ${name}`));
	}

	/**
	 * @param {string} name
	 * @param {vscode.CompletionItemKind} kind
	 * @param {string} [detail]
	 */
	function _newCompletionItem(name, kind, detail = undefined) {
		const cit = new vscode.CompletionItem(name, kind);
		if (detail) cit.detail = detail;
		return cit;
	}

	/**
	 * @param {AntdModuleParserResult} modelContext
	 * @param {string} prefix
	 */
	function getStatesCompletion(modelContext, prefix = '') {
		if (!modelContext) return null;
		const lowerPrefix = prefix.toLowerCase();
		const results = [];
		modelContext.states.forEach(it => {
			if (prefix && !it.name.toLowerCase().startsWith(lowerPrefix))
				return;
			results.push(_newCompletionItem(it.name, vscode.CompletionItemKind.Property,
				`state in model "${modelContext.namespace}"`));
		});
		return results;
	}

	/**
	 * @param {string} modelName
	 * @param {string} prefix
	 * @param {{ignoreEffects?: boolean; ignoreReducers?: boolean; }} [options]
	 */
	function getEffectsAndReducersCompletions(modelName, prefix = '', options = {}) {
		if (!modelName || !Object.prototype.hasOwnProperty.call(models, modelName))
			return null;
		const model = models[modelName];
		const lowerPrefix = prefix.toLowerCase();
		const results = [];
		if (!options || !options.ignoreEffects) {
			model.effects.forEach(it => {
				if (prefix && !it.name.toLowerCase().startsWith(lowerPrefix))
					return;
				results.push(_newCompletionItem(it.name, vscode.CompletionItemKind.Method, `effect in "${modelName}"`));
			});
		}
		if (!options || !options.ignoreReducers) {
			model.reducers.forEach(it => {
				if (prefix && !it.name.toLowerCase().startsWith(lowerPrefix))
					return;
				results.push(_newCompletionItem(it.name, vscode.CompletionItemKind.Method, `reducer in "${modelName}"`));
			});
		}
		return results;
	}

	/**
	 * @param {string} modelName
	 * @param {string} [childName]
	 * @param {{ignoreEffects?: boolean; ignoreReducers?: boolean; ignoreStates?: boolean; noDefault?: boolean}} [options]
	 */
	function getModelLocation(modelName, childName = null, options = {}) {
		if (!modelName || !Object.prototype.hasOwnProperty.call(models, modelName))
			return null;

		const model = models[modelName];
		const file = vscode.Uri.file(model.file);
		if (childName) {
			if (!options || !options.ignoreEffects) {
				const foundEffect = model.effects.find(it => it.name == childName);
				if (foundEffect)
					return new vscode.Location(file, createVSCodeRange(foundEffect));
			}

			if (!options || !options.ignoreReducers) {
				const foundReducer = model.reducers.find(it => it.name == childName);
				if (foundReducer)
					return new vscode.Location(file, createVSCodeRange(foundReducer));
			}

			if (!options || !options.ignoreStates) {
				const foundState = model.states.find(it => it.name == childName);
				if (foundState)
					return new vscode.Location(file, createVSCodeRange(foundState));
			}

		}

		if (options && options.noDefault === true)
			return null;
		return new vscode.Location(file, AT_START);
	}

	/** @param {{from: ParseLocation, to: ParseLocation}} obj */
	function createVSCodeRange(obj) {
		return new vscode.Range(
			new vscode.Position(obj.from.line - 1, obj.from.character),
			new vscode.Position(obj.to.line - 1, obj.to.character)
		);
	}

	function getReportInfo() {
		const modelNames = Object.keys(models);
		const modelValues = modelNames.map(it => models[it]);
		return {
			modelNames,
			modelCount: modelNames.length,
			effectCount: modelValues.map(it => it.effects.length).reduce((a, b) => a + b, 0),
			reducerCount: modelValues.map(it => it.reducers.length).reduce((a, b) => a + b, 0),
		};
	}
}
