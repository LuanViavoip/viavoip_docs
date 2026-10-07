import { prisma } from "@/lib/db/prisma";

import type { SearchMatchSource } from "./schema";

export type SearchHit = {
  documentId: string;
  matchedIn: SearchMatchSource;
  snippet: string | null;
};

type SearchDocumentsParams = {
  query: string;
  /** Documentos que o perfil atual pode ver; a busca nunca retorna nada fora desta lista. */
  documentIds: string[];
  limit: number;
};

/**
 * Implementação demonstrativa: `ILIKE` sobre título, `searchableContent` (texto extraído do HTML)
 * e exemplos. Este é o ponto a substituir por PostgreSQL Full Text Search (tsvector + GIN),
 * mantendo a mesma assinatura. Nenhum HTML é baixado durante a consulta.
 */
export async function searchDocuments({ query, documentIds, limit }: SearchDocumentsParams): Promise<SearchHit[]> {
  if (documentIds.length === 0) {
    return [];
  }

  const contains = { contains: escapeLikePattern(query), mode: "insensitive" as const };

  const documents = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      OR: [
        { title: contains },
        { searchableContent: contains },
        { examples: { some: { OR: [{ title: contains }, { content: contains }] } } },
      ],
    },
    select: {
      id: true,
      title: true,
      searchableContent: true,
      examples: {
        where: { OR: [{ title: contains }, { content: contains }] },
        select: { title: true, content: true },
        take: 1,
      },
    },
  });

  const order = new Map(documentIds.map((id, index) => [id, index]));
  const priority: Record<SearchMatchSource, number> = { title: 0, content: 1, example: 2 };
  return documents.map((document): SearchHit => {
    const contentSnippet = buildSnippet(document.searchableContent, query);
    if (includesInsensitive(document.title, query)) {
      return { documentId: document.id, matchedIn: "title", snippet: contentSnippet };
    }
    if (contentSnippet) {
      return { documentId: document.id, matchedIn: "content", snippet: contentSnippet };
    }
    const [example] = document.examples;
    return {
      documentId: document.id,
      matchedIn: "example",
      snippet: example ? buildSnippet(`${example.title}: ${example.content}`, query) : null,
    };
  }).toSorted((a, b) => priority[a.matchedIn] - priority[b.matchedIn] ||
    (order.get(a.documentId) ?? 0) - (order.get(b.documentId) ?? 0)).slice(0, limit);
}

/** `contains` vira ILIKE no PostgreSQL: sem escape, `%` e `_` da consulta atuariam como curingas. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function includesInsensitive(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function buildSnippet(text: string | null, query: string, radius = 70): string | null {
  if (!text) {
    return null;
  }
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index === -1) {
    return null;
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`;
}
