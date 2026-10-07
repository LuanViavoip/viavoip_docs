import { validateHierarchy } from "@/features/documents/invariants";
import { loadRawHtml } from "@/features/content/sources";
import { extractSearchableText, sanitizeDocumentHtml } from "@/features/content/sanitize";
import { normalizeUploadPath } from "./paths";
import { importedContentUrl } from "./storage";
import { MAX_EXAMPLE_BYTES, MAX_FILES } from "./constants";
import type { ImportNode } from "./types";

export type PreparedNode = ImportNode & { contentUrl: string | null; searchableContent: string | null; managedReferences: string[]; children: PreparedNode[] };
export function validateImportNodes(nodes: ImportNode[], knownProfiles: ReadonlySet<string>): void {
  if (!nodes.length) throw new Error("Índice vazio.");
  const seen = new Set<ImportNode>();
  const records: { id: string; parentId: string | null; slug: string; systemId: string }[] = [];
  const pending = nodes.map((node, index) => ({ node, id: String(index), parentId: null as string | null }));
  while (pending.length) {
    const item = pending.pop()!;
    if (seen.has(item.node)) throw new Error("Ciclo ou nó repetido na hierarquia de importação.");
    seen.add(item.node);
    if (seen.size > MAX_FILES) throw new Error("O índice excede o limite de documentos.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.node.slug)) throw new Error("Slug de documento inválido.");
    for (const profile of item.node.profiles) if (!knownProfiles.has(profile)) throw new Error(`Perfil inexistente: ${profile}.`);
    if (item.node.file && (normalizeUploadPath(item.node.file) !== item.node.file || !/\.html?$/i.test(item.node.file))) throw new Error("Caminho HTML inválido.");
    if (item.node.file && item.node.contentUrl) throw new Error("Informe file ou contentUrl, nunca ambos.");
    for (const example of item.node.examples) if (Buffer.byteLength(example.content) > MAX_EXAMPLE_BYTES) throw new Error("Exemplo excede o limite de tamanho.");
    records.push({ id: item.id, parentId: item.parentId, slug: item.node.slug, systemId: "import" });
    item.node.children.forEach((node, index) => pending.push({ node, id: `${item.id}.${index}`, parentId: item.id }));
  }
  validateHierarchy(records);
}

/** Mesmo processamento central de HTML da consulta, executado antes do preview e novamente na confirmação. */
export async function prepareImportedNodes(nodes: ImportNode[], readUploadedHtml: (relative: string) => Promise<string>, contentBase: string): Promise<PreparedNode[]> {
  const result: PreparedNode[] = [];
  for (const node of nodes) {
    const contentUrl = node.file ? importedContentUrl(contentBase, node.file) : node.contentUrl ?? null;
    let searchableContent: string | null = null;
    let managedReferences: string[] = [];
    if (contentUrl) {
      const raw = node.file ? { html: await readUploadedHtml(node.file), baseUrl: contentUrl } : await loadRawHtml(contentUrl);
      const safe = sanitizeDocumentHtml(raw.html, { baseUrl: raw.baseUrl });
      searchableContent = extractSearchableText(safe);
      managedReferences = [...safe.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]).filter(url => url.startsWith("/content/"));
    }
    result.push({ ...node, contentUrl, searchableContent, managedReferences, children: await prepareImportedNodes(node.children, readUploadedHtml, contentBase) });
  }
  return result;
}
