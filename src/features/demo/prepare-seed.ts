import type { DemoDocument } from "@/data/demo/sol-maker-demo";
import { getDocumentSearchableText } from "@/features/content/service";

/** Preparação sem escrita: qualquer falha acontece antes da transação destrutiva. */
export async function prepareSeed(documents: DemoDocument[], knownProfiles: ReadonlySet<string>,
  readContent = getDocumentSearchableText): Promise<Map<string, string>> {
  const prepared = new Map<string, string>();
  const seen = new Set<DemoDocument>();
  const visit = async (nodes: DemoDocument[]) => {
    const slugs = new Set<string>();
    for (const node of nodes) {
      if (seen.has(node)) throw new Error("Ciclo no seed.");
      seen.add(node);
      if (slugs.has(node.slug)) throw new Error(`Slug duplicado no seed: ${node.slug}`);
      slugs.add(node.slug);
      for (const profile of node.profiles ?? []) if (!knownProfiles.has(profile)) throw new Error(`Perfil desconhecido no seed: ${profile}`);
      if (node.contentUrl) prepared.set(node.contentUrl, await readContent(node.contentUrl));
      await visit(node.children ?? []);
    }
  };
  await visit(documents);
  return prepared;
}
