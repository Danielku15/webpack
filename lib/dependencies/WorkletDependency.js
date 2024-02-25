/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Daniel Kuschny @danielku15
*/

"use strict";

const Dependency = require("../Dependency");
const RuntimeGlobals = require("../RuntimeGlobals");
const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const Template = require("../Template");

/** @typedef {import("webpack-sources").ReplaceSource} ReplaceSource */
/** @typedef {import("../AsyncDependenciesBlock")} AsyncDependenciesBlock */
/** @typedef {import("../ChunkGraph")} ChunkGraph */
/** @typedef {import("../Chunk")} Chunk */
/** @typedef {import("../Dependency").ReferencedExport} ReferencedExport */
/** @typedef {import("../Dependency").UpdateHashContext} UpdateHashContext */
/** @typedef {import("../DependencyTemplate").DependencyTemplateContext} DependencyTemplateContext */
/** @typedef {import("../Entrypoint")} Entrypoint */
/** @typedef {import("../ModuleGraph")} ModuleGraph */
/** @typedef {import("../javascript/JavascriptParser").Range} Range */
/** @typedef {import("../serialization/ObjectMiddleware").ObjectDeserializerContext} ObjectDeserializerContext */
/** @typedef {import("../serialization/ObjectMiddleware").ObjectSerializerContext} ObjectSerializerContext */
/** @typedef {import("estree").Expression} Expression */
/** @typedef {import("estree").CallExpression} CallExpression */
/** @typedef {import("../util/Hash")} Hash */
/** @typedef {import("../util/runtime").RuntimeSpec} RuntimeSpec */

class WorkletDependency extends ModuleDependency {
	/**
	 * @param {string} request request
	 * @param {Range} range range
	 * @param {Object} workletDependencyOptions options
	 * @param {string} workletDependencyOptions.publicPath public path for the worker
	 * @param {(chunk:Chunk) => string} workletDependencyOptions.getChunkFileName get filename for a chunk
	 */
	constructor(request, range, workletDependencyOptions) {
		super(request);
		this.range = range;
		this.options = workletDependencyOptions;
		this._hashUpdate = undefined;
	}

	getReferencedExports() {
		return Dependency.NO_EXPORTS_REFERENCED;
	}

	get type() {
		return "worklet.addModule()";
	}

	get category() {
		return "worker";
	}

	/**
	 * Update the hash
	 * @param {Hash} hash hash to be updated
	 * @returns {void}
	 */
	updateHash(hash) {
		if (this._hashUpdate === undefined) {
			this._hashUpdate = JSON.stringify(this.options);
		}
		hash.update(this._hashUpdate);
	}

	/**
	 * @param {ObjectSerializerContext} context context
	 */
	serialize(context) {
		const { write } = context;
		write(this.options);
		super.serialize(context);
	}

	/**
	 * @param {ObjectDeserializerContext} context context
	 */
	deserialize(context) {
		const { read } = context;
		this.options = read();
		super.deserialize(context);
	}
}

WorkletDependency.Template = class WorkletDependencyTemplate extends (
	ModuleDependency.Template
) {
	/**
	 * @param {Dependency} dependency the dependency for which the template should be applied
	 * @param {ReplaceSource} source the current replace source which can be modified
	 * @param {DependencyTemplateContext} templateContext the context object
	 * @returns {void}
	 */
	apply(dependency, source, templateContext) {
		const { chunkGraph, moduleGraph } = templateContext;
		const dep = /** @type {WorkletDependency} */ (dependency);
		const block = /** @type {AsyncDependenciesBlock} */ (
			moduleGraph.getParentBlock(dependency)
		);
		const entrypoint = /** @type {Entrypoint} */ (
			chunkGraph.getBlockChunkGroup(block)
		);

		const workletImportBaseUrl = dep.options.publicPath
			? `"${dep.options.publicPath}"`
			: RuntimeGlobals.publicPath;

		const chunk = entrypoint.getEntrypointChunk();

		// worklet global scope has no 'self', need to inject it for compatibility with chunks
		// some plugins like the auto public path need to right location. we pass this on from the main runtime
		// some plugins rely on importScripts to be defined.
		const workletInlineBootstrap = `
			globalThis.self = globalThis.self || globalThis;
			globalThis.location = \${JSON.stringify(${RuntimeGlobals.baseURI})};
			globalThis.importScripts = (url) => { throw new Error("importScripts not available, dynamic loading of chunks not supported in this context", url) };
		`;

		source.replace(
			dep.range[0],
			dep.range[1] - 1,
			Template.asString([
				"(/* worklet bootstrap */ async function(__webpack_worklet__, __webpack_worklet_args__) {",
				Template.indent([
					`await __webpack_worklet__.addModule(URL.createObjectURL(new Blob([\`${workletInlineBootstrap}\`], { type: "application/javascript; charset=utf-8" })), __webpack_worklet_args__);`,
					...Array.from(chunk.getAllReferencedChunks()).map(
						c =>
							`await __webpack_worklet__.addModule(new URL(${workletImportBaseUrl} + ${JSON.stringify(dep.options.getChunkFileName(c))}, ${RuntimeGlobals.baseURI}), __webpack_worklet_args__);`
					)
				]),
				`})(`
			])
		);
	}

	serialize() {
		return "";
	}
};

makeSerializable(
	WorkletDependency,
	"webpack/lib/dependencies/WorkletDependency"
);

module.exports = WorkletDependency;
