import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Module, { createRequire } from "node:module";

Object.assign(globalThis, { AsyncLocalStorage });
const testStorageRoot = mkdtempSync(path.join(tmpdir(), "viavoip-tests-"));
process.env.STORAGE_DIR = testStorageRoot;
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
// O build Next substitui este marcador em Server Components. O runner Node não faz essa transformação.
const require = createRequire(`${process.cwd()}/tests/setup.ts`);
const marker = require.resolve("next/dist/compiled/server-only");
const stub = new Module(marker);
stub.exports = {};
stub.loaded = true;
require.cache[marker] = stub;

process.once("exit", () => rmSync(testStorageRoot, { recursive: true, force: true }));
