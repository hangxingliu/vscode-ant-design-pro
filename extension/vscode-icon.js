//@ts-check
/// <reference path="index.d.ts" />

const path = require('path');
const fs = require('fs');

const ICON_DIR = path.join(__dirname, '..', 'icon');
const LIGHT_ICON_DIR = path.join(ICON_DIR, 'light');
const DARK_ICON_DIR = path.join(ICON_DIR, 'dark');

module.exports = {
	getIcon
}

function getIcon(fileName) {
	return {
		light: path.join(LIGHT_ICON_DIR, fileName),
		dark: path.join(DARK_ICON_DIR, fileName)
	};
}
