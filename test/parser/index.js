//@ts-check


const fs = require('fs-extra');
const path = require('path');
const { parseAntDesignProModuleFile } = require('../../extension/parser/parse-antd-module');

test();

async function test() {
	console.log(await parseAntDesignProModuleFile(path.join(__dirname, 'example-files', 'coin.js')));
}
