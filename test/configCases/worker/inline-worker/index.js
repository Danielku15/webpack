it("should allow to create a Inline WebWorker with importScripts", async () => {
	const workerUrl = __webpack_get_worker_url__(
		new URL("./worker.js", import.meta.url)
	);
	const workerBlob = new Blob([`importScripts('${workerUrl}')`], {
		type: "text/javascript"
	});
	const worker = new Worker(URL.createObjectURL(workerBlob));
	worker.postMessage("ok");
	const result = await new Promise(resolve => {
		worker.onmessage = event => {
			resolve(event.data);
		};
	});
	expect(result).toBe("data: OK, thanks");
	await worker.terminate();
});

it("should allow to create a Inline WebWorker with importScripts and module", async () => {
	const workerUrl = __webpack_get_worker_url__(
		new URL("./worker.js", import.meta.url),
		{
			type: "module"
		}
	);

	// NOTE: At the time of writing using import to load the worker leads to syntax errors
	// likely the node workers and blobs are not properly working together. 
	const workerBlob = new Blob([`importScripts(${JSON.stringify(workerUrl)})`], {
		type: "text/javascript"
	});
	const worker = new Worker(URL.createObjectURL(workerBlob), {
		type: "module"
	});
	worker.postMessage("ok");
	const result = await new Promise((resolve, reject) => {
		worker.onmessage = event => {
			resolve(event.data);
		};
	});
	expect(result).toBe("data: OK, thanks");
	await worker.terminate();
});
