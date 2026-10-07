import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { IMPORTED_CONTENT_PREFIX, resolveInside, SYSTEMS_STORAGE_DIR } from "@/lib/storage/paths";

import { ContentError } from "./errors";
import { parseContentUrl, type ContentLocation } from "./urls";

export type RawHtml = {
  html: string;
  /** URL usada como base para resolver referências relativas do HTML. */
  baseUrl: string;
};

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * Ponto único de leitura de HTML bruto. Novas origens (servidor HTTP interno, storage, etc.)
 * devem ser adicionadas aqui, sem que a interface precise saber de onde o HTML veio.
 */
export async function loadRawHtml(contentUrl: string): Promise<RawHtml> {
  const location = parseContentUrl(contentUrl);
  if (!location) {
    throw new ContentError("invalid-url", `contentUrl inválido: "${contentUrl}"`);
  }
  return loadFromLocation(location, contentUrl);
}

async function loadFromLocation(location: ContentLocation, contentUrl: string): Promise<RawHtml> {
  switch (location.kind) {
    case "local":
      return { html: await readLocalHtml(location.pathname), baseUrl: contentUrl };
    case "remote":
      throw new ContentError(
        "unsupported-source",
        "Origens remotas ainda não estão habilitadas nesta fase (apenas HTML local ou importado).",
      );
    default: {
      const unreachable: never = location;
      throw new Error(`Origem não tratada: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Caminhos `/content/...` apontam para documentação importada (armazenada fora de `public/`);
 * os demais, para arquivos estáticos em `public/` (HTMLs de demonstração).
 */
function localFilePath(pathname: string): string | null {
  if (pathname.startsWith(IMPORTED_CONTENT_PREFIX)) {
    return resolveInside(SYSTEMS_STORAGE_DIR, pathname.slice(IMPORTED_CONTENT_PREFIX.length));
  }
  return resolveInside(PUBLIC_DIR, `.${pathname}`);
}

async function readLocalHtml(pathname: string): Promise<string> {
  const filePath = localFilePath(pathname);

  if (!filePath) {
    throw new ContentError("invalid-url", "Caminho fora dos diretórios de conteúdo.");
  }
  if (!HTML_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    throw new ContentError("invalid-url", "Apenas arquivos .html são aceitos.");
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    throw new ContentError("not-found", `Arquivo HTML não encontrado: ${pathname}`);
  }
  if (size > MAX_HTML_BYTES) {
    throw new ContentError("too-large", "Arquivo HTML excede o tamanho máximo permitido.");
  }

  try {
    return await readFile(filePath, "utf8");
  } catch {
    throw new ContentError("read-failed", `Falha ao ler o HTML: ${pathname}`);
  }
}
