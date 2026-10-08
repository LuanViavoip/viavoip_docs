import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { GET } from "../src/app/content/[...path]/route";
import { extractPdfText, hasPdfSignature, isPdfPath } from "../src/features/content/pdf";
import { getDocumentContent } from "../src/features/content/service";
import { buildImportPlan } from "../src/features/importer/plan";
import { prepareImportedNodes, validateImportNodes } from "../src/features/importer/prepare";
import { SYSTEMS_STORAGE_DIR } from "../src/lib/storage/paths";

/** PDF mínimo de uma página com o texto informado (tabela xref calculada). */
function makePdf(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 40 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

const encode = (value: string) => new TextEncoder().encode(value);
const profiles = new Set<string>();

test("Identifica PDFs pelo caminho e pela assinatura", () => {
  assert.equal(isPdfPath("/content/s/i/Manual.PDF#page=2"), true);
  assert.equal(isPdfPath("/content/s/i/manual.pdf.html"), false);
  assert.equal(hasPdfSignature(makePdf("x")), true);
  assert.equal(hasPdfSignature(encode("<html>")), false);
});

test("Sem índice, cada PDF vira um documento ao lado dos HTMLs", () => {
  const plan = buildImportPlan(new Map([["01-intro.html", encode("<h1>Intro</h1>")], ["02-manual_do_usuario.pdf", makePdf("Manual")]]), profiles);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.tree.map(node => [node.title, node.slug, node.file]), [
    ["Intro", "intro", "01-intro.html"],
    ["Manual do usuario", "manual-do-usuario", "02-manual_do_usuario.pdf"],
  ]);
  assert.equal(plan.pdfCount, 1);
  assert.equal(plan.htmlCount, 1);
  assert.ok(plan.storedFiles.has("02-manual_do_usuario.pdf"));
});

test("Índice pode apontar para PDF; envio só com PDFs é aceito", () => {
  const index = encode(JSON.stringify({ documents: [{ title: "Folder", file: "docs/folder.pdf" }] }));
  const plan = buildImportPlan(new Map([["docs-index.json", index], ["docs/folder.pdf", makePdf("Folder")]]), profiles);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.tree[0].file, "docs/folder.pdf");
  validateImportNodes(plan.tree, profiles);
});

test("Arquivo .pdf sem assinatura de PDF bloqueia a importação", () => {
  const plan = buildImportPlan(new Map([["falso.pdf", encode("<script>alert(1)</script>")]]), profiles);
  assert.ok(plan.errors.some(error => error.includes("não é um PDF válido")));
  assert.equal(plan.storedFiles.has("falso.pdf"), false);
});

test("Texto do PDF é extraído para a pesquisa", async () => {
  const pdf = makePdf("Roteamento de filas ViaVOIP");
  assert.equal(await extractPdfText(pdf), "Roteamento de filas ViaVOIP");
  // Caracteres de controle do PDF (NUL incluso) não podem chegar ao banco.
  assert.equal(await extractPdfText(makePdf("Fila\\000 A\\001B")), "Fila A B");
  const plan = buildImportPlan(new Map([["manual.pdf", pdf]]), profiles);
  const [node] = await prepareImportedNodes(plan.tree, async () => { throw new Error("não deveria ler HTML"); }, "/content/pdf-test/preview/", async file => plan.storedFiles.get(file)!);
  assert.equal(node.contentUrl, "/content/pdf-test/preview/manual.pdf");
  assert.equal(node.searchableContent, "Roteamento de filas ViaVOIP");
});

test("PDF corrompido é recusado na preparação", async () => {
  const plan = buildImportPlan(new Map([["quebrado.pdf", encode("%PDF-1.4 lixo")]]), profiles);
  await assert.rejects(
    prepareImportedNodes(plan.tree, async () => "", "/content/pdf-test/preview/", async file => plan.storedFiles.get(file)!),
    /Não foi possível ler o PDF/,
  );
});

test("Rota de conteúdo entrega PDF com suporte a intervalos e a tela recebe o visualizador", async () => {
  const root = `${SYSTEMS_STORAGE_DIR}/pdf-route/v1`;
  const pdf = makePdf("Rota");
  await mkdir(root, { recursive: true });
  await writeFile(`${root}/manual.pdf`, pdf);
  await writeFile(`${root}/pagina.html`, "<p>x</p>");
  const call = (file: string, headers?: Record<string, string>) =>
    GET(new Request(`http://local/content/pdf-route/v1/${file}`, { headers }), { params: Promise.resolve({ path: ["pdf-route", "v1", file] }) });

  const full = await call("manual.pdf");
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "application/pdf");
  assert.equal(full.headers.get("x-content-type-options"), "nosniff");
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await full.arrayBuffer()), pdf);

  const partial = await call("manual.pdf", { range: "bytes=0-4" });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), `bytes 0-4/${pdf.byteLength}`);
  assert.equal(await partial.text(), "%PDF-");

  const tail = await call("manual.pdf", { range: "bytes=-6" });
  assert.equal(await tail.text(), "%%EOF\n");
  assert.equal((await call("manual.pdf", { range: `bytes=${pdf.byteLength}-` })).status, 416);
  // HTML importado continua fora da rota: só chega sanitizado.
  assert.equal((await call("pagina.html")).status, 404);

  assert.deepEqual(await getDocumentContent({ contentUrl: "/content/pdf-route/v1/manual.pdf" }), { status: "pdf", url: "/content/pdf-route/v1/manual.pdf" });
  const missing = await getDocumentContent({ contentUrl: "/content/pdf-route/v1/ausente.pdf" });
  assert.equal(missing.status, "error");
  await rm(`${SYSTEMS_STORAGE_DIR}/pdf-route`, { recursive: true, force: true });
});
