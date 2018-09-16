//@ts-check
/// <reference path="./index.d.ts" />

const pkg = require('./pkg');

const LOG_NAME = (pkg.getPkg().name || '').replace('vscode-', '');
module.exports = {
	debug, error
};

function debug(message) {
	console.log(`${LOG_NAME}: ${message}`); //eslint-disable-line no-console
}

function error(message) {
	console.error(`${LOG_NAME}: ${message}`); //eslint-disable-line no-console
}
