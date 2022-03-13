const path = require("path");
const { resolveObjectURL } = require("buffer");

module.exports = ({ outputDirectory }) =>
	class Worker {
		constructor(url, options = {}) {
			if (url instanceof URL) {
				url = url.href;
			}

			this._bufferedMessages = [];
			this._onmessage = undefined;

			if (url.startsWith("http:") || url.startsWith("https:")) {
				this.start(url, options, `importScripts(${JSON.stringify(url)});`);
			} else if (url.startsWith("blob:")) {
				const blob = resolveObjectURL(url);
				blob
					.text()
					.then(workerCode => {
						this.start("https://test.cases/path/", options, workerCode);
					})
					.catch(e => {
						this.reportError(e);
					});
			} else {
				throw new SyntaxError(
					`Unsupported URL protocol, must be http:, https: or blob: but was ${url}`
				);
			}
		}

		reportError(e) {
			this._startError = e;
			if (this._onmessage) {
				this._onmessage(this._startError);
			}
		}

		start(url, options, workerCode) {
			const workerBootstrap = `
${
	options.type === "module"
		? `
		import { parentPort } from "worker_threads";
		import { URL } from "url";
		import * as path from "path";
		import * as fs from "fs";	
		`
		: `
		const { parentPort } = require("worker_threads");
		const { URL } = require("url");
		const path = require("path");
		const fs = require("fs");
		`
}

global.self = global;
self.URL = URL;
self.location = new URL(${JSON.stringify(url)});
self.urlToPath = url => {
	if(url.startsWith("https://test.cases/path/")) url = url.slice(24);
	return path.resolve(${JSON.stringify(outputDirectory)}, \`./\${url}\`);
};
self.importScripts = url => { 
	require(urlToPath(url)) 
};
self.fetch = async url => {
	try {
		const buffer = await new Promise((resolve, reject) =>
			fs.readFile(urlToPath(url), (err, b) =>
				err ? reject(err) : resolve(b)
			)
		);
		return {
			status: 200,
			ok: true,
			json: async () => JSON.parse(buffer.toString("utf-8"))
		};
	} catch(err) {
		if(err.code === "ENOENT") {
			return {
				status: 404,
				ok: false
			};
		}
		throw err;
	}
};
parentPort.on("message", data => {
	if(self.onmessage) self.onmessage({
		data
	});
});
self.postMessage = data => {
	parentPort.postMessage(data);
};
${workerCode}
`;
			if (options.type === "module") {
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				this.worker = new (require("worker_threads").Worker)(workerBootstrap, {
					eval: true
				});
			} else {
				const dataUrl =
					`data:text/javascript;base64,` +
					Buffer.from(workerBootstrap).toString("base64");
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				this.worker = new (require("worker_threads").Worker)(new URL(dataUrl));
			}

			this.worker.on("error", error => {
				this.reportError(error);
			});

			if (this._onmessage) {
				this.worker.on("message", this._onmessage);
			}

			for (const m of this._bufferedMessages) {
				this.worker.postMessage(m);
			}
			this._bufferedMessages = [];
		}

		set onmessage(value) {
			const newOnMessage = data => {
				value({
					data
				});
			};

			if (this.worker) {
				if (this._onmessage) this.worker.off("message", this._onmessage);
				this.worker.on("message", newOnMessage);
			}

			this._onmessage = newOnMessage;
		}

		postMessage(data) {
			if (this._startError) {
				throw this._startError;
			}

			if (this.worker) {
				this.worker.postMessage(data);
			} else {
				this._bufferedMessages.push(data);
			}
		}

		terminate() {
			if (this._startError) {
				throw this._startError;
			}
			return this.worker?.terminate();
		}
	};
