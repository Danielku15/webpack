/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

"use strict";

const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

/** @typedef {import("../Chunk")} Chunk */
/** @typedef {import("../Compilation")} Compilation */
/** @typedef {import("../Compilation").AssetInfo} AssetInfo */
/** @typedef {import("../Compilation").PathData} PathData */

/** @typedef {function(PathData, AssetInfo=): string} FilenameFunction */

class GetWorkerUrlRuntimeModule extends RuntimeModule {
	/**
	 * @param {string} global function name to be assigned
	 */
	constructor(global) {
		super(`get worker url`);
		this.global = global;
		this.dependentHash = true;
	}

	/**
	 * @returns {string} runtime code
	 */
	generate() {
		const { global, compilation } = this;
		const { runtimeTemplate } = compilation;

		return Template.asString([
			`${global} = ${runtimeTemplate.basicFunction("url", "return url.href;")};`
		]);
	}
}

module.exports = GetWorkerUrlRuntimeModule;
