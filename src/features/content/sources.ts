import { contentFileExtension, locateContentFile, readContentFile, statContentFile, type ContentFile } from "@/lib/storage/files";

import { ContentError } from "./errors";
import { parseContentUrl, type ContentLocation } from "./urls";

export type RawHtml = {
  html: string;
  /** URL usada como base para resolver referências relativas do HTML. */
  baseUrl: string;
};

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const HTML_EXTENSIONS = new Set([".html", ".htm"]);

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
 * Caminhos `/content/...` apontam para documentação importada e `/demo-docs/...` para os HTMLs de
 * demonstração; ambos vêm do filesystem local ou, com `CONTENT_STORAGE=supabase`, do bucket privado.
 */
const localFile = locateContentFile;

/**
 * Lê um PDF local (importado ou de `public/`). Usado para indexar o texto e para confirmar que o
 * arquivo existe antes de exibir o visualizador.
 */
export async function loadRawPdf(contentUrl: string): Promise<Uint8Array> {
  const location = parseContentUrl(contentUrl);
  if (!location) {
    throw new ContentError("invalid-url", `contentUrl inválido: "${contentUrl}"`);
  }
  if (location.kind !== "local") {
    throw new ContentError("unsupported-source", "Origens remotas ainda não estão habilitadas nesta fase.");
  }
  const file = await assertLocalPdf(location.pathname);
  try {
    return await readContentFile(file);
  } catch {
    throw new ContentError("read-failed", `Falha ao ler o PDF: ${location.pathname}`);
  }
}

/** Confirma que o `contentUrl` aponta para um PDF local existente e dentro do limite de tamanho. */
export async function assertPdfAvailable(contentUrl: string): Promise<void> {
  const location = parseContentUrl(contentUrl);
  if (!location) {
    throw new ContentError("invalid-url", `contentUrl inválido: "${contentUrl}"`);
  }
  if (location.kind !== "local") {
    throw new ContentError("unsupported-source", "Origens remotas ainda não estão habilitadas nesta fase.");
  }
  await assertLocalPdf(location.pathname);
}

async function assertLocalPdf(pathname: string): Promise<ContentFile> {
  const file = localFile(pathname);
  if (!file || contentFileExtension(file) !== ".pdf") {
    throw new ContentError("invalid-url", "Caminho de PDF inválido.");
  }
  let info: { size: number } | null;
  try {
    info = await statContentFile(file);
  } catch {
    throw new ContentError("read-failed", `Falha ao consultar o PDF: ${pathname}`);
  }
  if (!info) {
    throw new ContentError("not-found", `Arquivo PDF não encontrado: ${pathname}`);
  }
  if (info.size > MAX_PDF_BYTES) {
    throw new ContentError("too-large", "Arquivo PDF excede o tamanho máximo permitido.");
  }
  return file;
}

async function readLocalHtml(pathname: string): Promise<string> {
  const file = localFile(pathname);

  if (!file) {
    throw new ContentError("invalid-url", "Caminho fora dos diretórios de conteúdo.");
  }
  if (!HTML_EXTENSIONS.has(contentFileExtension(file))) {
    throw new ContentError("invalid-url", "Apenas arquivos .html são aceitos.");
  }

  let info: { size: number } | null;
  try {
    info = await statContentFile(file);
  } catch {
    throw new ContentError("read-failed", `Falha ao consultar o HTML: ${pathname}`);
  }
  if (!info) {
    throw new ContentError("not-found", `Arquivo HTML não encontrado: ${pathname}`);
  }
  if (info.size > MAX_HTML_BYTES) {
    throw new ContentError("too-large", "Arquivo HTML excede o tamanho máximo permitido.");
  }

  try {
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await readContentFile(file));
  } catch {
    throw new ContentError("read-failed", `Falha ao ler o HTML: ${pathname}`);
  }
}
