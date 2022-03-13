it("should allow to create a Inline WebWorker with importScripts", async () => {
	const workerUrl = __webpack_get_worker_url__(new URL("./worker.js", import.meta.url));
	const workerBlob = new Blob([`importScripts('${workerUrl}')`], { type: 'text/javascript' });
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

// Fake Worker is not compatible with imports
// it("should allow to create a Inline WebWorker with import", async () => {
// 	const workerUrl = __webpack_get_worker_url__(new URL("./worker.js", import.meta.url));
// 	const workerBlob = new Blob([`import * as worker from '${workerUrl}'`], { type: 'text/javascript' });
// 	const worker = new Worker(URL.createObjectURL(workerBlob), {
// 		type: "module"
// 	});
// 	worker.postMessage("ok");
// 	const result = await new Promise(resolve => {
// 		worker.onmessage = event => {
// 			resolve(event.data);
// 		};
// 	});
// 	expect(result).toBe("data: OK, thanks");
// 	await worker.terminate();
// });