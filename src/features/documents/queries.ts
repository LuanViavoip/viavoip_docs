import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

import {
  buildDocumentTree,
  findNodeByPath,
  flattenTree,
  filterTreeForProfile,
  type DocumentMatch,
  type DocumentNode,
  type DocumentRecord,
} from "./tree";

export function systemBasePath(systemSlug: string): string {
  return `/docs/${systemSlug}`;
}

const getSystemDocumentRecords = cache(async (systemId: string): Promise<DocumentRecord[]> => {
  const documents = await prisma.document.findMany({
    where: { systemId },
    select: {
      id: true,
      systemId: true,
      parentId: true,
      title: true,
      slug: true,
      type: true,
      contentUrl: true,
      position: true,
      profiles: { select: { profile: { select: { slug: true } } } },
    },
  });

  return documents.map(({ profiles, ...document }) => ({
    ...document,
    profileSlugs: profiles.map(({ profile }) => profile.slug),
  }));
});

export type SystemNavigation = {
  /** Árvore filtrada pelo perfil atual (exibida na sidebar). */
  visibleTree: DocumentNode[];
  /** Árvore completa, usada para diferenciar "não existe" de "não disponível para o perfil". */
  fullTree: DocumentNode[];
  /** contentUrl (sem âncora) -> rota interna, para reescrever links entre documentos HTML. */
  hrefByContentUrl: Map<string, string>;
};

export const getSystemNavigation = cache(
  async (systemId: string, systemSlug: string, profileSlug: string): Promise<SystemNavigation> => {
    const records = await getSystemDocumentRecords(systemId);
    const basePath = systemBasePath(systemSlug);

    const fullTree = buildDocumentTree(records, basePath);
    const visibleTree = filterTreeForProfile(fullTree, records, profileSlug);

    const hrefByContentUrl = new Map<string, string>();
    for (const node of flattenTree(fullTree)) {
      if (node.contentUrl) {
        hrefByContentUrl.set(node.contentUrl, node.href);
      }
    }

    return { visibleTree, fullTree, hrefByContentUrl };
  },
);

export type ResolvedDocument =
  | { status: "found"; match: DocumentMatch }
  | { status: "restricted" }
  | { status: "not-found" };

export function resolveDocumentPath(navigation: SystemNavigation, segments: string[]): ResolvedDocument {
  const match = findNodeByPath(navigation.visibleTree, segments);
  if (match) {
    return { status: "found", match };
  }
  return findNodeByPath(navigation.fullTree, segments) ? { status: "restricted" } : { status: "not-found" };
}

export type PanelItemRecord = {
  id: string;
  kind: string;
  title: string;
  language: string | null;
  content: string;
};

export async function getDocumentExamples(documentId: string): Promise<PanelItemRecord[]> {
  return prisma.example.findMany({
    where: { documentId },
    select: { id: true, kind: true, title: true, language: true, content: true },
    orderBy: { position: "asc" },
  });
}
