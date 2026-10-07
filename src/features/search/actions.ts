"use server";

import { getSystemNavigation } from "@/features/documents/queries";
import { flattenWithAncestors } from "@/features/documents/tree";
import { getCurrentProfile } from "@/features/profiles/queries";
import { getSystemBySlug } from "@/features/systems/queries";

import { searchDocuments } from "./engine";
import { searchInputSchema, type SearchMatchSource, type SearchResponse, type SearchResult } from "./schema";

const RESULT_LIMIT = 20;

const MATCH_PRIORITY: Record<SearchMatchSource, number> = { title: 0, content: 1, example: 2 };

export async function searchDocumentsAction(input: unknown): Promise<SearchResponse> {
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid" };
  }

  try {
    const [profile, system] = await Promise.all([getCurrentProfile(), getSystemBySlug(parsed.data.systemSlug)]);
    if (!profile) {
      return { status: "no-profile" };
    }
    if (!system) {
      return { status: "ok", results: [] };
    }

    const navigation = await getSystemNavigation(system.id, system.slug, profile.slug);
    const visible = flattenWithAncestors(navigation.visibleTree);
    const orderById = new Map(visible.map((entry, index) => [entry.node.id, { ...entry, index }]));

    const hits = await searchDocuments({
      query: parsed.data.query,
      documentIds: [...orderById.keys()],
      limit: RESULT_LIMIT,
    });

    const treeOrder = (documentId: string) => orderById.get(documentId)?.index ?? Number.MAX_SAFE_INTEGER;

    const results = hits
      .toSorted(
        (a, b) =>
          MATCH_PRIORITY[a.matchedIn] - MATCH_PRIORITY[b.matchedIn] ||
          treeOrder(a.documentId) - treeOrder(b.documentId),
      )
      .flatMap((hit): SearchResult[] => {
        const entry = orderById.get(hit.documentId);
        if (!entry) {
          return [];
        }
        return [
          {
            id: entry.node.id,
            title: entry.node.title,
            href: entry.node.href,
            breadcrumb: entry.ancestors.map((ancestor) => ancestor.title),
            snippet: hit.snippet,
            matchedIn: hit.matchedIn,
          },
        ];
      });

    return { status: "ok", results };
  } catch (error) {
    console.error("[search] falha na pesquisa", error);
    return { status: "error" };
  }
}
