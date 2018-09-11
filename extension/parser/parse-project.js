//@ts-check
/// <reference path="../index.d.ts" />

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const vscode = require('vscode');
const { parseAntDesignProModuleFile } = require('./parse-antd-module');

const MODELS_DIR = 'src/models';
const AT_START = new vscode.Position(0, 0);

module.exports = {
	createProjectParser,
	MODELS_DIR
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
		getModelByFilePath,
		getModelCompletions, getStatesCompletion, getEffectsAndReducersCompletions,
	};

	function parse() {
		const modelsDir = path.join(projectPath, MODELS_DIR);
		ok = false;
		return fs.stat(modelsDir)
			.then(stat => { ok = stat.isDirectory() }).catch(() => { })
			.then(() => {
				if (!ok)
					return Promise.resolve(false);
				return fs.readdir(modelsDir)
					.then(files => {
						return Promise.all(
							files
								.map(file => path.join(modelsDir, file))
								.filter(it => it.endsWith('.js') && fs.statSync(it).isFile())
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

	/** @param {string} filePath */
	function reloadModel(filePath) {
		return parseAntDesignProModuleFile(filePath)
			.then(it => { models[it.namespace] = it; return Promise.resolve(true); })
			.catch(ex => { console.error(ex.stack); return Promise.resolve(false); });
	}

	/**
	 * @param {string} prefix
	 */
	function getModelCompletions(prefix = '') {
		let names =  Object.keys(models);
		if (prefix)
			names = names.filter(name => name.toLowerCase().startsWith(prefix));
		return names.map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Module));
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
	 * @param {AntdModuleParserResult} modalContext
	 * @param {string} prefix
	 */
	function getStatesCompletion(modalContext, prefix = '') {
		if (!modalContext) return null;
		const results = [];
		modalContext.states.forEach(it => {
			if (prefix && !it.name.toLowerCase().startsWith(prefix))
				return;
			results.push(_newCompletionItem(it.name, vscode.CompletionItemKind.Property, `state in "${modalContext.namespace}"`));
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
		const results = [];
		if (!options || !options.ignoreEffects) {
			model.effects.forEach(it => {
				if (prefix && !it.name.toLowerCase().startsWith(prefix))
					return;
				results.push(_newCompletionItem(it.name, vscode.CompletionItemKind.Method, `effect in "${modelName}"`));
			});
		}
		if (!options || !options.ignoreReducers) {
			model.reducers.forEach(it => {
				if (prefix && !it.name.toLowerCase().startsWith(prefix))
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
