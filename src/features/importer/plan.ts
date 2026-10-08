import {
  HTML_EXTENSIONS,
  IMAGE_CONTENT_TYPES,
  INDEX_FILE_NAME,
  MAX_HTML_BYTES,
  MAX_IMAGE_BYTES,
  MAX_INDEX_BYTES,
  MAX_FILES,
  MAX_PDF_BYTES,
  PDF_EXTENSION,
} from "./constants";
import { hasPdfSignature } from "@/features/content/pdf";
import { decodeHtml, extractHtmlTitle } from "./html";
import { docsIndexSchema, type DocsIndex } from "./index-schema";
import { extensionOf } from "./paths";
import { collectFiles, countNodes, finalizeTree, treeFromFolders, treeFromIndex } from "./structure";
import type { ImportNode, ImportStructureSource } from "./types";
import type { UploadedFiles } from "./upload";

export type ImportPlan = {
  source: ImportStructureSource;
  tree: ImportNode[];
  indexSystem: DocsIndex["system"];
  /** Arquivos que serão armazenados (HTMLs em UTF-8, PDFs e imagens). */
  storedFiles: Map<string, Uint8Array>;
  documentCount: number;
  htmlCount: number;
  pdfCount: number;
  imageCount: number;
  warnings: string[];
  errors: string[];
};

const encoder = new TextEncoder();
const MAX_REJECTED_WARNINGS = 20;

/** Analisa o envio e monta a árvore a importar, sem gravar nada. */
export function buildImportPlan(files: UploadedFiles, knownProfiles: Set<string>, rejectedPaths: string[] = []): ImportPlan {
  const errors: string[] = [];
  const warnings = rejectedPaths.slice(0, MAX_REJECTED_WARNINGS).map((rejected) => `Arquivo ignorado por caminho inseguro: ${rejected}`);
  if (rejectedPaths.length > MAX_REJECTED_WARNINGS) {
    warnings.push(`Outros ${rejectedPaths.length - MAX_REJECTED_WARNINGS} arquivo(s) também foram ignorados por caminho inseguro.`);
  }
  const storedFiles = new Map<string, Uint8Array>();
  const titles = new Map<string, string | null>();
  const pdfPaths = new Set<string>();
  const otherFiles: string[] = [];
  let imageCount = 0;

  for (const [filePath, data] of files) {
    const extension = extensionOf(filePath);
    if (HTML_EXTENSIONS.has(extension)) {
      if (data.byteLength > MAX_HTML_BYTES) {
        errors.push(`"${filePath}" excede o limite de ${MAX_HTML_BYTES / 1024 / 1024} MB por HTML.`);
        continue;
      }
      const html = decodeHtml(data);
      const utf8 = encoder.encode(html);
      if (utf8.byteLength > MAX_HTML_BYTES) { errors.push(`"${filePath}" excede o limite após conversão para UTF-8.`); continue; }
      titles.set(filePath, extractHtmlTitle(html));
      storedFiles.set(filePath, utf8);
    } else if (extension === PDF_EXTENSION) {
      if (data.byteLength > MAX_PDF_BYTES) {
        errors.push(`"${filePath}" excede o limite de ${MAX_PDF_BYTES / 1024 / 1024} MB por PDF.`);
        continue;
      }
      if (!hasPdfSignature(data)) {
        errors.push(`"${filePath}" não é um PDF válido.`);
        continue;
      }
      storedFiles.set(filePath, data);
      pdfPaths.add(filePath);
    } else if (extension in IMAGE_CONTENT_TYPES) {
      if (data.byteLength > MAX_IMAGE_BYTES) {
        warnings.push(`Imagem "${filePath}" ignorada: excede ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
        continue;
      }
      storedFiles.set(filePath, data);
      imageCount += 1;
    } else if (filePath !== INDEX_FILE_NAME) {
      otherFiles.push(filePath);
    }
  }

  const htmlPaths = new Set(titles.keys());
  const pagePaths = new Set([...htmlPaths, ...pdfPaths]);
  if (pagePaths.size === 0 && !files.has(INDEX_FILE_NAME)) {
    errors.push("Nenhum arquivo HTML (.html/.htm) ou PDF foi encontrado no envio.");
  }

  const exampleFiles = new Set<string>();
  const context = {
    files,
    pagePaths,
    titleOf: (p: string) => titles.get(p) ?? null,
    exampleFiles,
    errors,
    warnings,
  };
  const index = parseIndex(files.get(INDEX_FILE_NAME), errors);
  const source: ImportStructureSource = files.has(INDEX_FILE_NAME) ? "index" : "folders";

  const rawTree = index ? treeFromIndex(index, context) : source === "folders" ? treeFromFolders(context) : [];
  const tree = finalizeTree(rawTree, knownProfiles, warnings, errors);

  if (source === "index") {
    const referenced = collectFiles(tree);
    const unreferenced = [...pagePaths].filter((pagePath) => !referenced.has(pagePath));
    if (unreferenced.length > 0) {
      warnings.push(
        `${unreferenced.length} arquivo(s) HTML/PDF não citados no índice não aparecerão na navegação: ${preview(unreferenced)}.`,
      );
    }
  }
  const ignored = otherFiles.filter((filePath) => !exampleFiles.has(filePath));
  if (ignored.length > 0) {
    warnings.push(`${ignored.length} arquivo(s) de outros tipos foram ignorados: ${preview(ignored)}.`);
  }

  return {
    source,
    tree,
    indexSystem: index?.system,
    storedFiles,
    documentCount: countNodes(tree),
    htmlCount: htmlPaths.size,
    pdfCount: pdfPaths.size,
    imageCount,
    warnings,
    errors,
  };
}

function parseIndex(data: Uint8Array | undefined, errors: string[]): DocsIndex | null {
  if (!data) {
    return null;
  }
  if (data.byteLength > MAX_INDEX_BYTES) {
    errors.push(`${INDEX_FILE_NAME} excede o tamanho máximo.`);
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8").decode(data));
  } catch {
    errors.push(`${INDEX_FILE_NAME} não é um JSON válido.`);
    return null;
  }

  // Limite de recursos antes do schema recursivo; não limita a árvore a quatro níveis.
  const pending = [{ value: json, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > MAX_FILES * 100 || depth > 512) { errors.push("Índice excede os limites de processamento."); return null; }
    if (value && typeof value === "object") for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
  }
  const parsed = docsIndexSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) {
      errors.push(`${INDEX_FILE_NAME}, ${issue.path.join(".") || "raiz"}: ${issue.message}`);
    }
    return null;
  }
  return parsed.data;
}

function preview(values: string[]): string {
  return values.length > 5 ? `${values.slice(0, 5).join(", ")} e mais ${values.length - 5}` : values.join(", ");
}
