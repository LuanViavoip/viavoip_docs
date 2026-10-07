import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/lib/db/prisma";
import { escapeLikePattern, searchDocuments } from "../src/features/search/engine";

test("Pesquisa título/conteúdo/exemplo calcula ranking antes de limit", async () => {
  const original = prisma.document.findMany;
  // A fronteira DB fornece mais correspondências que o limite, incluindo título por último.
  prisma.document.findMany = (async (args: { take?: number }) => {
    const rows = [
      { id: "example", title: "A", searchableContent: null, examples: [{ title: "Código", content: "agulha" }] },
      { id: "content", title: "B", searchableContent: "texto agulha", examples: [] },
      { id: "title", title: "agulha", searchableContent: null, examples: [] },
    ];
    return args.take ? rows.slice(0, args.take) : rows;
  }) as unknown as typeof prisma.document.findMany;
  try {
    const hits = await searchDocuments({ query: "agulha", documentIds: ["example", "content", "title"], limit: 2 });
    assert.deepEqual(hits.map(hit => [hit.documentId, hit.matchedIn]), [["title", "title"], ["content", "content"]]);
    const all = await searchDocuments({ query: "agulha", documentIds: ["example", "content", "title"], limit: 3 });
    assert.equal(all[2].matchedIn, "example");
  } finally { prisma.document.findMany = original; }
});
test("Pesquisa trata % e _ como texto literal, sem curingas", async () => {
  assert.equal(escapeLikePattern("%"), "\\%");
  assert.equal(escapeLikePattern("_"), "\\_");
  assert.equal(escapeLikePattern("__"), "\\_\\_");
  assert.equal(escapeLikePattern("100%"), "100\\%");
  assert.equal(escapeLikePattern("foo_bar"), "foo\\_bar");
  assert.equal(escapeLikePattern("a\\b"), "a\\\\b");
  assert.equal(escapeLikePattern("Clientes API"), "Clientes API");
  const original = prisma.document.findMany;
  let pattern: unknown;
  prisma.document.findMany = (async (args: { where: { OR: [{ title: unknown }] } }) => {
    pattern = args.where.OR[0].title;
    return [];
  }) as unknown as typeof prisma.document.findMany;
  try {
    await searchDocuments({ query: "foo_bar", documentIds: ["x"], limit: 5 });
    assert.deepEqual(pattern, { contains: "foo\\_bar", mode: "insensitive" });
  } finally { prisma.document.findMany = original; }
});
