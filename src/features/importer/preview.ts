import { createHash } from "node:crypto";
import type { ImportNode } from "./types";

export type DocumentSnapshot = { path: string; signature: string };
export function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function documentSignature(node: Pick<ImportNode, "title" | "type" | "profiles" | "examples" | "searchableContent">, reference: string | null, position: number): string {
  return fingerprint({ title: node.title, type: node.type, profiles: [...node.profiles].sort(), examples: node.examples, text: node.searchableContent ?? null, reference, position });
}
export function summarizeImport(nodes: ImportNode[], existing: DocumentSnapshot[]) {
  const proposed = new Map<string, string>();
  const profiles = new Set<string>();
  let exampleCount = 0;
  const visit = (nodes: ImportNode[], parent: string) => nodes.forEach((node, position) => {
    const path = `${parent}/${node.slug}`;
    proposed.set(path, documentSignature(node, node.file ?? node.contentUrl ?? null, position));
    exampleCount += node.examples.length;
    node.profiles.forEach(profile => profiles.add(profile));
    visit(node.children, path);
  });
  visit(nodes, "");
  const old = new Map(existing.map(document => [document.path, document.signature]));
  const changes = { added: 0, updated: 0, removed: 0 };
  for (const [path, signature] of proposed) {
    if (!old.has(path)) changes.added++;
    else if (old.get(path) !== signature) changes.updated++;
  }
  for (const path of old.keys()) if (!proposed.has(path)) changes.removed++;
  return { exampleCount, profileSlugs: [...profiles].sort(), changes };
}
