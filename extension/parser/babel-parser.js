//@ts-check
/// <reference path="../types/antd.d.ts" />

const Parser = require('@babel/parser');

module.exports = {
	parseCode,
	createLocationFromASTNode
};

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isTypescriptFile(filePath) {
	return typeof filePath === 'string' && filePath && /\.tsx?$/i.test(filePath);
}

function parseCode(code, filePath = '') {
	const plugins = [
		'objectRestSpread',
		'jsx',
		'ecorators-legacy',
		'classProperties',
	];
	if (isTypescriptFile(filePath))
		plugins.push('typescript');

	return Parser.parse(code, { sourceType: 'module', plugins });
}

/**
 * @param {any} node
 * @returns {{from: ParseLocation; to: ParseLocation;}}
 */
function createLocationFromASTNode(node) {
	if (!node || !node.loc
		|| !node.loc.start || typeof node.loc.start.line != 'number'
		|| !node.loc.end || typeof node.loc.end.line != 'number')
		return;

	const from = {offset: node.start, line: node.loc.start.line, character: node.loc.start.column };
	const to = { offset: node.end, line: node.loc.end.line, character: node.loc.end.column };
	return { from, to };
}
