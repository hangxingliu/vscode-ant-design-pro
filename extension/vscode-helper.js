//@ts-check
/// <reference path="./index.d.ts" />

const vscode = require('vscode');
const pkg = require('./pkg');

const INFORMATION = 1;
const WARNING = 2;
const AS_MODAL = 128;

const LOG_NAME = (pkg.getPkg().name || '').replace('vscode-', '');

/**
 * @param {string} msg
 */
function showErrorMessage(msg) {
	vscode.window.showErrorMessage(`${LOG_NAME}: ${msg}`);
}

/**
 * @param {string} msg
 */
function showMessage(msg) {
	vscode.window.showInformationMessage(`${LOG_NAME}: ${msg}`);
}


function showConfirm(title, btnOk, btnCancel, flags = 0) {
	return new Promise(resolve => {
		const showConfirm = flags & WARNING
			? vscode.window.showWarningMessage
			: vscode.window.showInformationMessage;

		const btn1 = { title: btnOk, code: 1 };
		const btn2 = btnCancel ? { title: btnCancel, code: 2 } : undefined;
		showConfirm(`${LOG_NAME}: ${title}`, { modal: !!(flags & AS_MODAL) }, btn1, btn2)
			.then(result => resolve(result && result.code == 1));
	});
}

/** @param {vscode.TextDocument} document */
function getProjectPathByDocument(document) {
	if (!document || !document.uri) return;
	const folder = vscode.workspace.getWorkspaceFolder(document.uri);
	if (!folder || !folder.uri || !folder.uri.fsPath) return;
	return folder.uri.fsPath;
}


const JAVASCRIPTS = ['javascript', 'javascriptreact'];
const JAVASCRIPTS_MAP = {};
JAVASCRIPTS.forEach(key => { JAVASCRIPTS_MAP[key] = key; });

/** @param {vscode.TextDocument} document */
function isJavascriptDocument(document) {
	return Object.prototype.hasOwnProperty.call(JAVASCRIPTS_MAP, document.languageId);
}

function getJavascriptDocumentSelector() {
	/** @type {vscode.DocumentFilter[]} */
	const documentSelectors = JAVASCRIPTS.map(it => ({
		scheme: 'file',
		language: it,
	}));
	return documentSelectors;
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {string}
 */
function getTextBeforeCursor(document, position) {
    var start = new vscode.Position(position.line, 0);
    var range = new vscode.Range(start, position);
    return document.getText(range);
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {string}
 */
function getTextAroundCursor(document, position) {
	let lineText = document.lineAt(position).text,
		pos = position.character;
	let beforeText = lineText.slice(0, pos),
		afterText = lineText.slice(pos);
	beforeText = (beforeText.match(/\w*$/) || [''] )[0];
	afterText = (afterText.match(/^\w*/) || [''] )[0];
	return beforeText + afterText;
}

module.exports = {
	WARNING,
	INFORMATION,
	AS_MODAL,
	showConfirm,

	getTextBeforeCursor,
	getTextAroundCursor,
	showErrorMessage,
	showMessage,

	getProjectPathByDocument,
	getJavascriptDocumentSelector,
	isJavascriptDocument,
};
