import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { runImportApplication, type ImportStore } from "../src/features/importer/workflow";
import { createStaging } from "../src/features/importer/storage";
import { SYSTEMS_STORAGE_DIR } from "../src/lib/storage/paths";

test("A → B mantém B; C inválida não destrói B; concorrência e falha de cleanup", async t => {
  // Adapter de teste transacional: DB real é coberto separadamente por test:integration.
  let version = "initial";
  let urls: string[] = [];
  let tail: Promise<unknown> = Promise.resolve();
  let failWrite = false;
  let active = 0;
  let maximum = 0;
  const repository = {
    async withSystemLock<T>(_slug: string, operation: (store: ImportStore) => Promise<T>): Promise<T> {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      active++; maximum = Math.max(maximum, active);
      const saved = { version, urls: [...urls] };
      try { return await operation({
        async fingerprint() { return version; },
        async profiles() { return new Set(["developer"]); },
        async activeContentUrls() { return new Set(urls); },
        async replace(_plan: unknown, nodes: { contentUrl: string | null }[]) { urls = nodes.flatMap(n => n.contentUrl ? [n.contentUrl] : []); version = randomUUID(); if (failWrite) throw new Error("transaction rollback"); },
      }); }
      catch (error) { version = saved.version; urls = saved.urls; throw error; }
      finally { active--; release(); }
    },
  };
  const ownerId = randomUUID();
  const make = async (label: string, profiles: string[] = []) => createStaging(new Map([["x.html", new TextEncoder().encode(`<h1>${label}</h1>`)]]), {
    ownerId, baseFingerprint: version, system: { name: "Workflow", slug: "workflow-test", description: null }, source: "folders",
    tree: [{ title: label, slug: "x", type: null, file: "x.html", profiles, examples: [], children: [] }],
  });
  await runImportApplication(await make("A"), ownerId, repository);
  const a = urls[0];
  await runImportApplication(await make("B"), ownerId, repository);
  const b = urls[0];
  assert.notEqual(a, b);
  const disk = (url: string) => SYSTEMS_STORAGE_DIR + url.slice("/content".length);
  await access(disk(b)); await assert.rejects(access(disk(a)));
  await assert.rejects(runImportApplication(await make("C", ["unknown"]), ownerId, repository), /perfil/i);
  assert.deepEqual(urls, [b]); await access(disk(b));
  const missing = await createStaging(new Map(), {
    ownerId, baseFingerprint: version, system: { name: "Workflow", slug: "workflow-test", description: null }, source: "folders",
    tree: [{ title: "Missing", slug: "x", type: null, file: "missing.html", profiles: [], examples: [], children: [] }],
  });
  await assert.rejects(runImportApplication(missing, ownerId, repository));
  assert.deepEqual(urls, [b]); await access(disk(b));
  const unauthorized = await make("wrong-owner");
  await assert.rejects(runImportApplication(unauthorized, randomUUID(), repository), /sessão/);
  assert.deepEqual(urls, [b]);
  failWrite = true;
  await assert.rejects(runImportApplication(await make("rollback"), ownerId, repository), /rollback/);
  failWrite = false;
  assert.deepEqual(urls, [b]); await access(disk(b));
  const one = await make("one"), two = await make("two");
  const results = await Promise.allSettled([runImportApplication(one, ownerId, repository), runImportApplication(two, ownerId, repository)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(maximum, 1); await access(disk(urls[0]));
  t.mock.method(console, "error", () => {});
  const result = await runImportApplication(await make("cleanup-warning"), ownerId, repository, async () => { throw new Error("cleanup"); });
  assert.equal(result.cleanupPending, true); await access(disk(urls[0]));
});
