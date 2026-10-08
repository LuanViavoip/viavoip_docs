import path from "node:path";

/**
 * Cliente mínimo do Supabase Storage (API REST) para o bucket privado da documentação.
 * Usa a service role key, que existe apenas no servidor: variável sem prefixo NEXT_PUBLIC, portanto
 * nunca incluída no bundle do cliente. Importar este módulo somente de código de servidor.
 * Ativado por `CONTENT_STORAGE=supabase`; sem isso a aplicação usa o filesystem local.
 */
const DEFAULT_BUCKET = "viavoip-docs";

export function isRemoteStorageEnabled(): boolean {
  return process.env.CONTENT_STORAGE === "supabase";
}

type RemoteConfig = { baseUrl: string; bucket: string; key: string };

function config(): RemoteConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("CONTENT_STORAGE=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.");
  }
  return { baseUrl: `${url.replace(/\/+$/, "")}/storage/v1`, bucket: process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET, key };
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const { key } = config();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * O Storage rejeita chaves com caracteres fora de um conjunto seguro (acentos, espaços, etc.).
 * Cada segmento é codificado de forma determinística e reversível (`_` + hex UTF-8); caracteres
 * seguros passam intactos. Todas as chaves derivadas de nomes de arquivo passam por `resolveKey`,
 * então escrita e leitura sempre concordam.
 */
function safeSegment(segment: string): string {
  return segment.replace(/[^A-Za-z0-9.()-]/g, char => [...new TextEncoder().encode(char)].map(byte => `_${byte.toString(16).padStart(2, "0")}`).join(""));
}

/**
 * Junta `relative` a `prefix` como chave de objeto, mantendo o resultado dentro de `prefix`.
 * Equivalente remoto de `resolveInside`: rejeita `..`, caminhos absolutos, `\`, NUL e segmentos vazios.
 */
export function resolveKey(prefix: string, relative: string): string | null {
  if (relative.includes("\0") || relative.includes("\\") || relative.startsWith("/")) return null;
  const normalized = path.posix.normalize(relative);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.endsWith("/")) return null;
  return `${prefix.replace(/\/+$/, "")}/${normalized.split("/").map(safeSegment).join("/")}`;
}

/** Tamanho do objeto ou `null` se não existir. */
export async function remoteStat(key: string): Promise<{ size: number } | null> {
  const { baseUrl, bucket } = config();
  const response = await fetch(`${baseUrl}/object/authenticated/${bucket}/${encodeKey(key)}`, { method: "HEAD", headers: headers(), cache: "no-store" });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Falha ao consultar o Storage (${response.status}).`);
  const size = Number(response.headers.get("content-length"));
  return Number.isFinite(size) ? { size } : null;
}

/** Lê o objeto inteiro ou o intervalo `[start, end]` (inclusivo). */
export async function remoteRead(key: string, range?: { start: number; end: number }): Promise<Uint8Array> {
  const { baseUrl, bucket } = config();
  const response = await fetch(`${baseUrl}/object/authenticated/${bucket}/${encodeKey(key)}`, {
    headers: headers(range ? { Range: `bytes=${range.start}-${range.end}` } : undefined),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Falha ao ler do Storage (${response.status}).`);
  const data = new Uint8Array(await response.arrayBuffer());
  // Se o servidor ignorar o Range e devolver o objeto inteiro (200), recorta aqui.
  return range && response.status !== 206 ? data.slice(range.start, range.end + 1) : data;
}

/** A chave já existe (envio sem upsert). Usado como "criar se ausente" atômico (claims). */
export class RemoteConflictError extends Error {}

/** Envia um objeto novo. Falha se a chave já existir (nunca sobrescreve). */
export async function remoteUpload(key: string, data: Uint8Array, contentType: string, upsert = false): Promise<void> {
  const { baseUrl, bucket } = config();
  const response = await fetch(`${baseUrl}/object/${bucket}/${encodeKey(key)}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": String(upsert), "Cache-Control": "max-age=31536000" }),
    body: data as Uint8Array<ArrayBuffer>,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = response.status === 409 ? "" : await response.text().catch(() => "");
    if (response.status === 409 || /"statusCode"\s*:\s*"?409"?|Duplicate/i.test(detail)) throw new RemoteConflictError("Objeto já existe no Storage.");
    throw new Error(`Falha ao enviar para o Storage (${response.status}).`);
  }
}

/** Copia um objeto dentro do bucket, no servidor do Storage (sem baixar nem reenviar). */
export async function remoteCopy(sourceKey: string, destinationKey: string): Promise<void> {
  const { baseUrl, bucket } = config();
  const response = await fetch(`${baseUrl}/object/copy`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ bucketId: bucket, sourceKey, destinationKey }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Falha ao copiar no Storage (${response.status}).`);
}

/** Remove objetos específicos. */
export async function remoteRemoveKeys(keys: string[]): Promise<void> {
  const { baseUrl, bucket } = config();
  for (let i = 0; i < keys.length; i += 100) {
    const response = await fetch(`${baseUrl}/object/${bucket}`, {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: keys.slice(i, i + 100) }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Falha ao remover do Storage (${response.status}).`);
  }
}

type ListedEntry = { name: string; id: string | null };

async function listPage(prefix: string, offset: number): Promise<ListedEntry[]> {
  const { baseUrl, bucket } = config();
  const response = await fetch(`${baseUrl}/object/list/${bucket}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Falha ao listar o Storage (${response.status}).`);
  return (await response.json()) as ListedEntry[];
}

/** Itens diretamente sob `prefix`; pastas têm `id === null`. */
export async function remoteList(prefix: string): Promise<ListedEntry[]> {
  const entries: ListedEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await listPage(prefix.replace(/\/+$/, ""), offset);
    entries.push(...page);
    if (page.length < 100) return entries;
  }
}

/** Todas as chaves de arquivos sob `prefix`, recursivamente. */
export async function remoteListFiles(prefix: string): Promise<string[]> {
  const base = prefix.replace(/\/+$/, "");
  const keys: string[] = [];
  for (const entry of await remoteList(base)) {
    if (entry.id === null) keys.push(...(await remoteListFiles(`${base}/${entry.name}`)));
    else keys.push(`${base}/${entry.name}`);
  }
  return keys;
}

/** Remove todos os objetos sob `prefix`. */
export async function remoteRemovePrefix(prefix: string): Promise<void> {
  await remoteRemoveKeys(await remoteListFiles(prefix));
}
