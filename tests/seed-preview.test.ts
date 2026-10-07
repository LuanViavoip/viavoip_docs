import assert from "node:assert/strict";
import test from "node:test";
import { prepareSeed } from "../src/features/demo/prepare-seed";
import { summarizeImport, documentSignature } from "../src/features/importer/preview";
import type { ImportNode } from "../src/features/importer/types";

test("Seed prepara todo conteúdo e falha antes da persistência quando HTML está ausente", async () => {
  const nodes = [{ title: "A", slug: "a", contentUrl: "/a.html" }, { title: "B", slug: "b", contentUrl: "/missing.html" }];
  await assert.rejects(prepareSeed(nodes, new Set(), async url => {
    if (url === "/missing.html") throw new Error("HTML ausente");
    return "A";
  }), /ausente/);
  const prepared = await prepareSeed(nodes, new Set(), async url => url);
  assert.equal(prepared.size, 2);
  await assert.rejects(prepareSeed([{ title: "A", slug: "a", profiles: ["developer"] }], new Set()), /Perfil/);
});
test("Preview contabiliza inclusões, alterações, exclusões, perfis e exemplos", () => {
  const base: ImportNode = { title: "A", slug: "a", type: null, file: "a.html", profiles: ["support"], examples: [], children: [], searchableContent: "texto" };
  const changed = { ...base, slug: "b", title: "B", examples: [{ title: "Request", language: "http", content: "GET /" }] };
  const summary = summarizeImport([base, changed], [{ path: "/a", signature: documentSignature(base, base.file, 0) }, { path: "/b", signature: "old" }, { path: "/deleted", signature: "old" }]);
  assert.deepEqual(summary, { exampleCount: 1, profileSlugs: ["support"], changes: { added: 0, updated: 1, removed: 1 } });
});
