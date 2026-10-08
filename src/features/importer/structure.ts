import { MAX_EXAMPLE_BYTES } from "./constants";
import { parseContentUrl } from "@/features/content/urls";
import type { DocsIndex, DocsIndexDocument, DocsIndexExample } from "./index-schema";
import { baseNameWithoutOrder, extensionOf, humanize, normalizeUploadPath, slugify } from "./paths";
import type { ImportExample, ImportNode } from "./types";
import type { UploadedFiles } from "./upload";

export type StructureContext = {
  files: UploadedFiles;
  /** Caminhos dos HTMLs e PDFs válidos do envio. */
  pagePaths: Set<string>;
  titleOf: (htmlPath: string) => string | null;
  /** Arquivos de exemplo lidos a partir do índice. */
  exampleFiles: Set<string>;
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Estrutura a partir do docs-index.json
// ---------------------------------------------------------------------------

export function treeFromIndex(index: DocsIndex, context: StructureContext): ImportNode[] {
  return index.documents.map((document, position) => nodeFromIndex(document, [position + 1], context));
}

function nodeFromIndex(document: DocsIndexDocument, trail: number[], context: StructureContext): ImportNode {
  const label = `documento ${trail.join(".")}`;
  let file: string | null = null;

  if (document.file) {
    file = normalizeUploadPath(document.file);
    if (!file || !context.pagePaths.has(file)) {
      context.errors.push(`Índice, ${label}: arquivo "${document.file}" não encontrado no envio (HTML ou PDF).`);
      file = null;
    }
  }
  if (document.contentUrl && !parseContentUrl(document.contentUrl)) {
    context.errors.push(`Índice, ${label}: contentUrl inválido.`);
  }

  const title = document.title ?? (file && context.titleOf(file)) ?? humanize(baseNameWithoutOrder(document.file ?? "").name);

  return {
    title,
    slug: slugify(document.slug ?? title),
    type: document.type ?? null,
    file,
    contentUrl: document.contentUrl ?? null,
    profiles: document.profiles ?? [],
    examples: (document.examples ?? []).flatMap((example) => exampleFromIndex(example, label, context)),
    children: (document.children ?? []).map((child, position) =>
      nodeFromIndex(child, [...trail, position + 1], context),
    ),
  };
}

function exampleFromIndex(example: DocsIndexExample, label: string, context: StructureContext): ImportExample[] {
  if (example.content !== undefined) {
    return [{ title: example.title, language: example.language ?? null, content: example.content }];
  }

  const filePath = normalizeUploadPath(example.file ?? "");
  const data = filePath ? context.files.get(filePath) : undefined;
  if (!filePath || !data) {
    context.errors.push(`Índice, ${label}: arquivo de exemplo "${example.file}" não encontrado no envio.`);
    return [];
  }
  if (data.byteLength > MAX_EXAMPLE_BYTES) {
    context.errors.push(`Índice, ${label}: o exemplo "${example.file}" excede ${MAX_EXAMPLE_BYTES / 1024} KB.`);
    return [];
  }

  context.exampleFiles.add(filePath);
  return [
    {
      title: example.title,
      language: example.language ?? (extensionOf(filePath).slice(1) || null),
      content: new TextDecoder("utf-8").decode(data),
    },
  ];
}

// ---------------------------------------------------------------------------
// Estrutura a partir das pastas (quando não há índice)
// ---------------------------------------------------------------------------

type FolderEntry = { folders: Map<string, FolderEntry>; pages: string[] };

const INDEX_PAGE = /^index\.html?$/i;

/**
 * Cada pasta vira um nó e cada HTML ou PDF vira um documento. O `index.html` de uma pasta vira o conteúdo
 * do próprio nó da pasta. Prefixos numéricos ("01-intro.html") definem a ordem e são removidos.
 */
export function treeFromFolders(context: StructureContext): ImportNode[] {
  const root: FolderEntry = { folders: new Map(), pages: [] };

  for (const htmlPath of context.pagePaths) {
    const segments = htmlPath.split("/");
    let current = root;
    for (const folder of segments.slice(0, -1)) {
      let next = current.folders.get(folder);
      if (!next) {
        next = { folders: new Map(), pages: [] };
        current.folders.set(folder, next);
      }
      current = next;
    }
    current.pages.push(htmlPath);
  }

  return folderChildren(root, context, true);
}

type OrderedNode = { node: ImportNode; order: number | null };

function folderChildren(entry: FolderEntry, context: StructureContext, isRoot: boolean): ImportNode[] {
  const ordered: OrderedNode[] = [];
  if (isRoot) {
    const indexes = entry.pages.filter(page => INDEX_PAGE.test(page.split("/").at(-1) ?? ""));
    if (indexes.length > 1) context.errors.push(`Índice ambíguo na raiz: ${indexes.join(", ")}.`);
  }

  for (const pagePath of entry.pages) {
    const fileName = pagePath.split("/").at(-1) ?? pagePath;
    if (!isRoot && INDEX_PAGE.test(fileName)) {
      continue;
    }
    const { name, order } = baseNameWithoutOrder(fileName);
    const title = context.titleOf(pagePath) ?? humanize(name);
    ordered.push({
      node: pageNode(title, slugify(INDEX_PAGE.test(fileName) ? title : name), pagePath),
      order: INDEX_PAGE.test(fileName) ? -1 : order,
    });
  }

  for (const [folderName, folder] of entry.folders) {
    const indexes = folder.pages.filter(pagePath => INDEX_PAGE.test(pagePath.split("/").at(-1) ?? ""));
    if (indexes.length > 1) context.errors.push(`Índice ambíguo na pasta "${folderName}": ${indexes.join(", ")}.`);
    const { name, order } = baseNameWithoutOrder(folderName);
    const indexPage = folder.pages.find((pagePath) => INDEX_PAGE.test(pagePath.split("/").at(-1) ?? ""));
    const title = (indexPage && context.titleOf(indexPage)) || humanize(name);
    ordered.push({
      node: { ...pageNode(title, slugify(name), indexPage ?? null), children: folderChildren(folder, context, false) },
      order,
    });
  }

  return ordered
    .toSorted(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.node.title.localeCompare(b.node.title, "pt-BR", { numeric: true }),
    )
    .map((item) => item.node);
}

function pageNode(title: string, slug: string, file: string | null): ImportNode {
  return { title, slug, type: null, file, profiles: [], examples: [], children: [] };
}

// ---------------------------------------------------------------------------
// Ajustes finais (comuns às duas origens)
// ---------------------------------------------------------------------------

/** Garante slugs válidos e únicos entre irmãos e rejeita perfis desconhecidos. */
export function finalizeTree(nodes: ImportNode[], knownProfiles: Set<string>, warnings: string[], errors: string[] = []): ImportNode[] {
  const used = new Set<string>();

  return nodes.map((node) => {
    const base = node.slug || "documento";
    let slug = base;
    for (let suffix = 2; used.has(slug); suffix += 1) {
      slug = `${base}-${suffix}`;
    }
    if (slug !== base) {
      warnings.push(`Slug repetido "${base}" renomeado para "${slug}" (${node.title}).`);
    }
    used.add(slug);

    const unknown = node.profiles.filter((profile) => !knownProfiles.has(profile));
    if (unknown.length > 0) {
      errors.push(`Perfil inexistente em "${node.title}": ${unknown.join(", ")}.`);
    }

    return {
      ...node,
      slug,
      profiles: [...new Set(node.profiles)],
      children: finalizeTree(node.children, knownProfiles, warnings, errors),
    };
  });
}

export function countNodes(nodes: ImportNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

export function collectFiles(nodes: ImportNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.file) {
      into.add(node.file);
    }
    collectFiles(node.children, into);
  }
  return into;
}
