import { validateHierarchy } from "./invariants";

/** Funções puras para montar e navegar na árvore de documentos (sem acesso a banco). */

export type DocumentRecord = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  type: string | null;
  contentUrl: string | null;
  position: number;
  profileSlugs: string[];
  systemId?: string;
};

export type DocumentNode = {
  id: string;
  title: string;
  slug: string;
  type: string | null;
  contentUrl: string | null;
  href: string;
  children: DocumentNode[];
};

export type DocumentMatch = {
  node: DocumentNode;
  ancestors: DocumentNode[];
};

/**
 * Regra provisória (mocks): documento sem perfis associados é visível para todos;
 * caso contrário, apenas para os perfis associados.
 */
export function isVisibleForProfile(record: DocumentRecord, profileSlug: string): boolean {
  return record.profileSlugs.length === 0 || record.profileSlugs.includes(profileSlug);
}

/**
 * Monta a árvore recursivamente a partir de `parentId`, sem limite de profundidade.
 * Registros cujo pai não está na lista são descartados, então ocultar um nó oculta sua subárvore.
 */
export function buildDocumentTree(records: DocumentRecord[], basePath: string): DocumentNode[] {
  validateHierarchy(records);
  const childrenByParent = new Map<string | null, DocumentRecord[]>();
  for (const record of records) {
    const siblings = childrenByParent.get(record.parentId) ?? [];
    siblings.push(record);
    childrenByParent.set(record.parentId, siblings);
  }

  const build = (parentId: string | null, parentHref: string): DocumentNode[] =>
    (childrenByParent.get(parentId) ?? [])
      .toSorted((a, b) => a.position - b.position || a.title.localeCompare(b.title))
      .map((record) => {
        const href = `${parentHref}/${record.slug}`;
        return {
          id: record.id,
          title: record.title,
          slug: record.slug,
          type: record.type,
          contentUrl: record.contentUrl,
          href,
          children: build(record.id, href),
        };
      });

  return build(null, basePath);
}

/** Pai invisível esconde seus descendentes, sem gerar órfãos artificiais na validação. */
export function filterTreeForProfile(tree: DocumentNode[], records: DocumentRecord[], profileSlug: string): DocumentNode[] {
  const visible = new Set(records.filter(record => isVisibleForProfile(record, profileSlug)).map(record => record.id));
  const filter = (nodes: DocumentNode[]): DocumentNode[] => nodes.filter(node => visible.has(node.id)).map(node => ({ ...node, children: filter(node.children) }));
  return filter(tree);
}

export function findNodeByPath(tree: DocumentNode[], segments: string[]): DocumentMatch | null {
  const ancestors: DocumentNode[] = [];
  let level = tree;
  let current: DocumentNode | undefined;

  for (const [index, segment] of segments.entries()) {
    current = level.find((node) => node.slug === segment);
    if (!current) {
      return null;
    }
    if (index < segments.length - 1) {
      ancestors.push(current);
    }
    level = current.children;
  }

  return current ? { node: current, ancestors } : null;
}

export function flattenTree(tree: DocumentNode[]): DocumentNode[] {
  return tree.flatMap((node) => [node, ...flattenTree(node.children)]);
}

export function flattenWithAncestors(tree: DocumentNode[], ancestors: DocumentNode[] = []): DocumentMatch[] {
  return tree.flatMap((node) => [
    { node, ancestors },
    ...flattenWithAncestors(node.children, [...ancestors, node]),
  ]);
}
