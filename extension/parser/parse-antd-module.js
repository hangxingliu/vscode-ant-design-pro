//@ts-check
/// <reference path="../index.d.ts" />

const _ = require('lodash');
const fs = require('fs-extra');
// const path = require('path');
const traverse = require('@babel/traverse').default;
const { parseCode, createLocationFromASTNode } = require('./babel-parser');

module.exports = {
	parseAntDesignProModuleFile
};

/**
 * @param {string} filePath
 * @param {string} [fileContent]
 * @returns {Promise<AntdModuleParserResult>}
 */
function parseAntDesignProModuleFile(filePath, fileContent = null) {
	/** @type {AntdModuleParserResult} */
	const result = {
		ok: false,
		file: filePath,
		namespace: '',
		states: [],
		effects: [],
		reducers: [],
	};

	if (typeof fileContent != 'string')
		return fs.readFile(filePath, 'utf8').then(thenable);
	return thenable(fileContent);

	/**
	 * @param {string} fileContent
	 * @returns {Promise<AntdModuleParserResult>}
	 */
	function thenable(fileContent) {
		let ast = null;
		try {
			ast = parseCode(fileContent);
		} catch (ex) {
			console.error(`Error: parseCode from ${filePath}\n${ex.stack}`);
			return Promise.resolve(result);
		}

		traverse(ast, {
			enter(path) {
				if (result.ok) return;

				const type = path.node.type;
				if (type === 'ExportDefaultDeclaration' && path.node.declaration.type === 'ObjectExpression') {
					const { properties } = path.node.declaration;
					if (!properties || !Array.isArray(properties)) return;

					const keyValues = {};
					properties.map(it => {
						const key = _.get(it, 'key.name', '');
						if (!key) return;
						keyValues[key] = it;
					});

					if (!('namespace' in keyValues)) return;

					const namespaceValue = _.get(keyValues, 'namespace.value.value', '');
					if (!namespaceValue) return;
					result.namespace = namespaceValue;

					const stateProps = _.get(keyValues,'state.value.properties');
					if (Array.isArray(stateProps)) {
						stateProps.forEach(stateProp => {
							const stateName = _.get(stateProp, 'key.name', '');
							if (!stateName) return;

							const location = createLocationFromASTNode(stateProp.key);
							result.states.push(Object.assign({ name: stateName }, location));
						})
					}

					const effectProps = _.get(keyValues,'effects.value.properties');
					if (Array.isArray(effectProps)) {
						effectProps.forEach(effectProp => {
							const stateName = _.get(effectProp, 'key.name', '');
							if (!stateName) return;

							const location = createLocationFromASTNode(effectProp.key);
							result.effects.push(Object.assign({ name: stateName }, location));
						})
					}

					const reducerProps = _.get(keyValues,'reducers.value.properties');
					if (Array.isArray(reducerProps)) {
						reducerProps.forEach(reducerProp => {
							const stateName = _.get(reducerProp, 'key.name', '');
							if (!stateName) return;

							const location = createLocationFromASTNode(reducerProp.key);
							result.reducers.push(Object.assign({ name: stateName }, location));
						})
					}

					// success
					result.ok = true;
				}
			},
			exit() {}
		});

		return Promise.resolve(result);
	}
}
