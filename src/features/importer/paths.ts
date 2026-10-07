import { IGNORED_SEGMENTS } from "./constants";

/**
 * Normaliza o caminho relativo de um arquivo enviado ("docs\\api\\x.html" -> "docs/api/x.html").
 * Retorna `null` para caminhos inválidos/perigosos (absolutos, "..", bytes nulos) ou ignorados.
 */
export function normalizeUploadPath(rawPath: string): string | null {
  if (rawPath.includes("\0")) {
    return null;
  }
  const segments = rawPath.replace(/\\/g, "/").split("/").filter((segment) => segment && segment !== ".");

  if (segments.length === 0 || /^[a-z]:$/i.test(segments[0]) || rawPath.startsWith("/")) {
    return null;
  }
  if (segments.some((segment) => segment === ".." || IGNORED_SEGMENTS.has(segment) || segment.startsWith("._"))) {
    return null;
  }
  return segments.join("/");
}

/** Caminho que tenta sair da pasta do envio (absoluto, "..", byte nulo), e não apenas um arquivo ignorado. */
export function isUnsafeUploadPath(rawPath: string): boolean {
  const segments = rawPath.replace(/\\/g, "/").split("/");
  return rawPath.includes("\0") || /^[\\/]/.test(rawPath) || /^[a-z]:$/i.test(segments[0]) || segments.includes("..");
}

/**
 * Se todos os arquivos estiverem dentro de uma mesma pasta raiz (caso comum ao enviar uma pasta
 * ou um .zip com pasta), remove esse prefixo.
 */
export function stripCommonRoot(paths: string[]): { root: string | null; paths: string[] } {
  const first = paths[0]?.split("/")[0];
  const shared = first && paths.every((value) => value.includes("/") && value.split("/")[0] === first);
  if (!shared) {
    return { root: null, paths };
  }
  return { root: first, paths: paths.map((value) => value.slice(first.length + 1)) };
}

/** Converte um texto em slug de URL ("Visão Geral" -> "visao-geral"). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Remove a extensão e um prefixo numérico de ordenação ("02-clientes.html" -> "clientes"). */
export function baseNameWithoutOrder(fileOrFolder: string): { name: string; order: number | null } {
  const withoutExtension = fileOrFolder.replace(/\.[^./]+$/, "");
  const match = /^(\d+)[-_. ]+(.+)$/.exec(withoutExtension);
  return match ? { name: match[2], order: Number(match[1]) } : { name: withoutExtension, order: null };
}

/** "visao_geral-api" -> "Visao geral api". Usado quando o HTML não tem título. */
export function humanize(value: string): string {
  const text = value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

export function extensionOf(filePath: string): string {
  const match = /\.[^./]+$/.exec(filePath);
  return match ? match[0].toLowerCase() : "";
}
