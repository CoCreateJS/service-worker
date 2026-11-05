import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("only registers from the top-level HTTP(S) page", async () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const originalNavigator = Object.getOwnPropertyDescriptor(
		globalThis,
		"navigator"
	);
	const originalDocument = Object.getOwnPropertyDescriptor(
		globalThis,
		"document"
	);
	let registerCalls = 0;
	const iframeWindow = {
		location: {
			href: "about:srcdoc",
			protocol: "about:"
		}
	};
	iframeWindow.self = iframeWindow;
	iframeWindow.top = {
		location: {
			href: "https://app.example/",
			protocol: "https:",
			origin: "https://app.example"
		}
	};

	Object.defineProperties(globalThis, {
		window: {
			configurable: true,
			value: iframeWindow
		},
		navigator: {
			configurable: true,
			value: {
				serviceWorker: {
					register() {
						registerCalls += 1;
						return Promise.resolve({});
					}
				}
			}
		},
		document: {
			configurable: true,
			value: { readyState: "complete" }
		}
	});

	try {
		const source = await readFile(
			new URL("../src/index.js", import.meta.url),
			"utf8"
		);
		const { default: serviceWorker } = await import(
			`data:text/javascript,${encodeURIComponent(source)}`
		);

		assert.equal(await serviceWorker.init(), null);
		assert.equal(registerCalls, 0);

		iframeWindow.location = {
			href: "https://app.example/builder/",
			protocol: "https:"
		};
		assert.equal(await serviceWorker.init(), null);
		assert.equal(registerCalls, 0);

		iframeWindow.top = iframeWindow.self;
		assert.notEqual(await serviceWorker.init(), null);
		assert.equal(registerCalls, 1);
	} finally {
		for (const [key, descriptor] of [
			["window", originalWindow],
			["navigator", originalNavigator],
			["document", originalDocument]
		]) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globalThis[key];
		}
	}
});
