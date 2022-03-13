const path = require("path");
const { resolveObjectURL } = require("buffer");

module.exports = ({ outputDirectory }) =>
	class Worker {
		constructor(url, options = {}) {
			const parsedUrl = url instanceof URL ? url : new URL(url);

			this._bufferedMessages = [];
			this._onmessage = undefined;

			if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
				expect(url.origin).toBe("https://test.cases");
				expect(url.pathname.startsWith("/path/")).toBe(true);
				const file = url.pathname.slice(6);
				this.start(
					url,
					options,
					`require(${JSON.stringify(path.resolve(outputDirectory, file))});`
				);
			} else if (parsedUrl.protocol === "blob:") {
				const blob = resolveObjectURL(parsedUrl.href);
				blob.text().then(value => {
					this.start(url, options, value);
				});
			} else {
				throw new SyntaxError(
					"Unsupported URL protocol, must be http:, https: or blob: but was " +
						parsedUrl.protocol
				);
			}
		}

		start(url, options, workerStartup) {
			const workerBootstrap = `
const { parentPort } = require("worker_threads");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
global.self = global;
self.URL = URL;
self.location = new URL(${JSON.stringify(url)});
const urlToPath = url => {
	if(url.startsWith("https://test.cases/path/")) url = url.slice(24);
	return path.resolve(${JSON.stringify(outputDirectory)}, \`./\${url}\`);
};
self.importScripts = url => {
	${
		options.type === "module"
			? `throw new Error("importScripts is not supported in module workers")`
			: `require(urlToPath(url))`
	};
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
${workerStartup}
`;
			// eslint-disable-next-line node/no-unsupported-features/node-builtins
			this.worker = new (require("worker_threads").Worker)(workerBootstrap, {
				eval: true
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
			if (this.worker) {
				this.worker.postMessage(data);
			} else {
				this._bufferedMessages.push(data);
			}
		}

		terminate() {
			return this.worker?.terminate();
		}
	};
