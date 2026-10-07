/**
 * Resolução de URLs de documentos HTML.
 *
 * Um `contentUrl` pode ser:
 * - local: caminho absoluto servido pela própria aplicação (ex.: "/demo-docs/api/clients.html");
 * - remoto: URL http(s) (ex.: "https://docs.exemplo.com/apis/clientes/index.html").
 *
 * Referências relativas dentro do HTML ("./fluxo.png", "../auth/login.html") são resolvidas
 * em relação ao `contentUrl` do próprio documento.
 */

export type ContentLocation =
  | { kind: "local"; pathname: string }
  | { kind: "remote"; url: URL };

const LOCAL_ORIGIN = "http://local.invalid";
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function parseContentUrl(contentUrl: string): ContentLocation | null {
  const value = contentUrl.trim();

  if (value.startsWith("/") && !value.startsWith("//")) {
    try {
      const url = new URL(value, LOCAL_ORIGIN);
      if (url.origin !== LOCAL_ORIGIN) return null;
      return { kind: "local", pathname: decodeURIComponent(url.pathname) };
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { kind: "remote", url };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve `reference` em relação a `baseUrl` (o contentUrl do documento).
 * Valores com esquema próprio (mailto:, javascript:, ...) e âncoras são devolvidos como estão;
 * a decisão de aceitá-los ou não é do sanitizador.
 */
export function resolveReference(reference: string, baseUrl: string): string {
  const value = reference.trim();
  // Não converter //host em http antes da allowlist de protocolos.
  if (value.startsWith("//")) return value;
  if (!value || value.startsWith("#") || SCHEME_PATTERN.test(value)) {
    return value;
  }

  const isLocalBase = baseUrl.startsWith("/") && !baseUrl.startsWith("//");

  let resolved: URL;
  try {
    resolved = new URL(value, isLocalBase ? `${LOCAL_ORIGIN}${baseUrl}` : baseUrl);
  } catch {
    return value;
  }

  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return value;
  }

  if (isLocalBase && resolved.origin === LOCAL_ORIGIN) {
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  }
  return resolved.toString();
}

/** Chave usada para comparar URLs de documentos (sem âncora). */
export function contentUrlKey(url: string): string {
  const hashIndex = url.indexOf("#");
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
