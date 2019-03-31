//@ts-check
/// <reference path="../../extension/index.d.ts" />

const path = require('path');
const fs = require('fs-extra');
const { Assert } = require('@hangxingliu/assert');
const { parseAntDesignProModuleFile } = require('../../extension/parser/parse-antd-module');


describe('parser models', () => {
	const exampleDir = path.join(__dirname, 'example-files');
	const files = fs.readdirSync(exampleDir)
		.map(it => path.join(exampleDir, it))
		.filter(it => /\.[jt]sx?$/i.test(it) && fs.statSync(it).isFile());
	files.forEach(file => {
		it(`# ${path.basename(file)}`, () =>
			parseAntDesignProModuleFile(file)
				.then(result => {
					Assert(result).containsKeys('ok', 'file');
					Assert(result.ok).isTrue();
					Assert(result.file).equals(file);
					Assert(result.namespace).equals(path.basename(file).replace(/\.[jt]sx?$/i, ''));
					Assert(result.states).isArray();
					Assert(result.effects).isArray();
					Assert(result.reducers).isArray();
				}));
	});
});
