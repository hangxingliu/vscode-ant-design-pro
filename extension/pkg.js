//@ts-check
/// <reference path="./index.d.ts" />

const fs = require('fs');
const path = require('path');

const PACKAGE_FILE = path.join(__dirname, '..', 'package.json');

/** @type {PackageInfo} */
//@ts-ignore
let pkg = {};

try {
	pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
} catch (ex) {
	console.error(ex.stack);
}

module.exports = {
	getPkg: () => pkg,
};
