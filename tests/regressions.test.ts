import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import test from "node:test";

import { getDocumentContent } from "../src/features/content/service";
import { sanitizeDocumentHtml } from "../src/features/content/sanitize";
import { buildDocumentTree, filterTreeForProfile, flattenTree, isVisibleForProfile, type DocumentRecord } from "../src/features/documents/tree";
import { zipSync } from "fflate";
import { buildImportPlan } from "../src/features/importer/plan";
import { readZipUpload } from "../src/features/importer/upload";
import { SYSTEMS_STORAGE_DIR } from "../src/lib/storage/paths";

const node = (id: string, parentId: string | null, profiles: string[] = []): DocumentRecord => ({
  id, parentId, title: id, slug: id, type: null, contentUrl: null, position: 0, profileSlugs: profiles,
});
const files = (entries: Record<string, string>) => new Map(Object.entries(entries).map(([name, body]) => [name, new TextEncoder().encode(body)]));

test("URL inválida retorna erro tipado", async () => {
  const result = await getDocumentContent({ contentUrl: "/demo-docs/%ZZ.html" });
  assert.equal(result.status, "error");
  if (result.status === "error") assert.equal(result.reason, "invalid-url");
});
test("HTML inexistente retorna not-found", async () => {
  const result = await getDocumentContent({ contentUrl: "/demo-docs/missing-test.html" });
  assert.equal(result.status, "error");
  if (result.status === "error") assert.equal(result.reason, "not-found");
});
test("HTML vazio, whitespace e vazio após sanitização têm empty state", async () => {
  const dir = `${SYSTEMS_STORAGE_DIR}/empty-test`;
  await mkdir(dir, { recursive: true });
  try {
    for (const content of ["", " \n\t", "<script>alert(1)</script>", "<p> </p>", '<img onerror="alert(1)">']) {
      await writeFile(`${dir}/x.html`, content);
      assert.equal((await getDocumentContent({ contentUrl: "/content/empty-test/x.html" })).status, "empty");
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
for (const [name, html, forbidden] of [
  ["script", "<script>alert(1)</script>", /<script|alert/],
  ["onerror", '<img src=x onerror="alert(1)">', /onerror|alert/],
  ["onclick", '<p onclick="alert(1)">texto</p>', /onclick|alert/],
  ["javascript", '<a href="java&#x73;cript:alert(1)">x</a>', /href|javascript|alert/],
  ["svg", '<svg onload="alert(1)"></svg>', /svg|onload|alert/],
  ["embeds", '<iframe src=x></iframe><object data=x></object><embed src=x>', /iframe|object|embed/],
] as const) test(`Sanitização bloqueia ${name}`, () => assert.doesNotMatch(sanitizeDocumentHtml(html, { baseUrl: "/demo-docs/x.html" }), forbidden));
test("HTML válido preserva tabela, imagem, código e formatação", () => {
  const html = sanitizeDocumentHtml('<h1>T</h1><p><strong>S</strong><em>E</em></p><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table><img src="./x.png"><ul><li>X</li></ul><pre><code>x</code></pre>', { baseUrl: "/demo-docs/x.html" });
  for (const tag of ["h1", "p", "strong", "em", "table", "thead", "tbody", "tr", "th", "td", "img", "ul", "li", "pre", "code"]) assert.ok(html.includes(`<${tag}`));
});
test("URLs protocol-relative não escapam à política", () => assert.doesNotMatch(sanitizeDocumentHtml('<a href="//example.com/x">x</a>', { baseUrl: "/demo-docs/x.html" }), /href=/));
test("Árvore normal suporta mais de quatro níveis", () => {
  const tree = buildDocumentTree(Array.from({ length: 12 }, (_, i) => node(`n${i}`, i ? `n${i - 1}` : null)), "/docs/t");
  assert.equal(flattenTree(tree).length, 12);
});
for (const records of [[node("a", "a")], [node("a", "b"), node("b", "a")], [node("a", "c"), node("b", "a"), node("c", "b")]]) {
  test(`Árvore rejeita ciclo de ${records.length} nós`, () => assert.throws(() => buildDocumentTree(records, "/docs/t"), /ciclo|próprio/i));
}
test("Árvore rejeita pai inexistente", () => assert.throws(() => buildDocumentTree([node("x", "missing")], "/docs/t"), /pai/i));
test("Árvore rejeita root slug duplicado", () => assert.throws(() => buildDocumentTree([node("x", null), { ...node("y", null), slug: "x" }], "/docs/t"), /slug/i));
test("Documento global, perfil único e múltiplos perfis", () => {
  assert.ok(isVisibleForProfile(node("g", null), "support"));
  assert.ok(isVisibleForProfile(node("x", null, ["developer"]), "developer"));
  assert.ok(isVisibleForProfile(node("x", null, ["developer", "support"]), "support"));
  assert.equal(isVisibleForProfile(node("x", null, ["developer"]), "support"), false);
});
test("Pai invisível esconde subárvore sem considerá-la corrompida", () => {
  const records = [node("p", null, ["developer"]), node("c", "p")];
  // Filtrar visibilidade deve acontecer depois da validação da árvore inteira.
  const tree = buildDocumentTree(records, "/docs/t");
  assert.equal(filterTreeForProfile(tree, records, "support").length, 0);
});
test("Pai e filho não podem pertencer a sistemas diferentes", () => assert.throws(() => buildDocumentTree([
  { ...node("p", null), systemId: "one" }, { ...node("c", "p"), systemId: "two" },
], "/docs/t"), /System/i));
test("Índice válido e inválido", () => {
  assert.equal(buildImportPlan(files({ "x.html": "<h1>X</h1>", "docs-index.json": JSON.stringify({ documents: [{ file: "x.html" }] }) }), new Set()).errors.length, 0);
  assert.ok(buildImportPlan(files({ "x.html": "<h1>X</h1>", "docs-index.json": "invalid" }), new Set()).errors.length);
});
test("Profile desconhecido bloqueia importação", () => {
  const plan = buildImportPlan(files({ "x.html": "<h1>X</h1>", "docs-index.json": JSON.stringify({ documents: [{ file: "x.html", profiles: ["unknown"] }] }) }), new Set(["developer"]));
  assert.ok(plan.errors.some(error => /perfil/i.test(error)));
});
test("Colisão index.html / index.htm bloqueia importação", () => {
  const plan = buildImportPlan(files({ "a/index.html": "A", "a/index.htm": "B" }), new Set());
  assert.ok(plan.errors.some(error => /ambig|index/i.test(error)));
});
test("Índice pode referenciar contentUrl sem upload dos HTMLs", () => {
  const plan = buildImportPlan(files({ "docs-index.json": JSON.stringify({ documents: [{ title: "Introdução", contentUrl: "/demo-docs/introduction.html" }] }) }), new Set());
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.tree[0].contentUrl, "/demo-docs/introduction.html");
});

test("Colisão index.html / index.htm também é rejeitada na raiz após normalização do upload", () => {
  assert.ok(buildImportPlan(files({ "index.html": "A", "index.htm": "B" }), new Set()).errors.some(error => /ambíguo/i.test(error)));
});

test("ZIP com caminho inseguro não importa o arquivo e gera warning explícito", async () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  const archive = zipSync({ "docs/ok.html": bytes("<h1>Ok</h1>"), "../evil.html": bytes("<h1>E</h1>"), "/abs.html": bytes("A"), "docs/sub/../../up.html": bytes("U"), "docs/.DS_Store": bytes("x") });
  const upload = await readZipUpload(new File([archive], "docs.zip"));
  assert.deepEqual([...upload.files.keys()], ["ok.html"]);
  assert.deepEqual(upload.rejectedPaths.toSorted(), ["../evil.html", "/abs.html", "docs/sub/../../up.html"]);
  const plan = buildImportPlan(upload.files, new Set(), upload.rejectedPaths);
  assert.equal(plan.errors.length, 0);
  assert.ok(plan.warnings.includes("Arquivo ignorado por caminho inseguro: ../evil.html"));
  assert.equal(plan.warnings.filter(warning => /caminho inseguro/.test(warning)).length, 3);
  await assert.rejects(readZipUpload(new File([zipSync({ "../only.html": bytes("x") })], "x.zip")), /caminho inseguro/);
});

test("Content Service lê HTML válido e resolve referências relativas com links seguros", async () => {
  const dir = `${SYSTEMS_STORAGE_DIR}/valid-content`;
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(`${dir}/x.html`, '<h1>Documentação</h1><table><tr><td>Valor</td></tr></table><img src="./images/x.png"><a href="../auth/login.html">Login</a><a target="_blank" href="https://example.com">Externo</a>');
    const result = await getDocumentContent({ contentUrl: "/content/valid-content/x.html" });
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.match(result.html, /<table>/);
      assert.match(result.html, /src="\/content\/valid-content\/images\/x.png"/);
      assert.match(result.html, /href="\/content\/auth\/login.html"/);
      assert.match(result.html, /noopener/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
