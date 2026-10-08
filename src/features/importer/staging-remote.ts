import { randomUUID } from "node:crypto";
import {
  RemoteConflictError, remoteCopy, remoteList, remoteListFiles, remoteRead, remoteRemoveKeys, remoteRemovePrefix, remoteStat, remoteUpload, resolveKey,
} from "@/lib/storage/remote";
import { MAX_HTML_BYTES, MAX_PDF_BYTES, STAGING_TTL_MS } from "./constants";
import { isValidStagingId, planSchema, publishedContentType, type StagedPlan } from "./staging-shared";

/**
 * Staging no bucket (necessário na Vercel, onde o disco é somente leitura e não é compartilhado):
 *   staging/<id>/init.json     criado primeiro (idade do envio, mesmo antes do plano existir)
 *   staging/<id>/files/**      HTML, PDFs e imagens do envio
 *   staging/<id>/plan.json     gravado por último: o staging só existe depois dele
 *   staging/<id>/claim.json    claim exclusivo (criação sem sobrescrever é atômica)
 *   staging/<id>/activated.json  marker de commit confirmado
 * Equivalências com o disco: rename→claim = criar claim.json; promover = copiar no servidor.
 */
const CONCURRENCY = 4;
const JSON_TYPE = "application/json";
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

function base(id: string): string {
  if (!isValidStagingId(id)) throw new Error("Identificador de importação inválido.");
  return `staging/${id}`;
}
async function inBatches<T>(items: T[], run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
}
/** Cria o claim; retorna `false` se alguém já o detém. */
async function tryClaim(id: string): Promise<boolean> {
  try { await remoteUpload(`${base(id)}/claim.json`, encode({ claimedAt: Date.now() }), JSON_TYPE, false); return true; }
  catch (error) { if (error instanceof RemoteConflictError) return false; throw error; }
}

export async function createStagingRemote(files: Map<string, Uint8Array>, plan: Omit<StagedPlan, "createdAt">): Promise<string> {
  const id = randomUUID();
  const root = base(id);
  try {
    await remoteUpload(`${root}/init.json`, encode({ createdAt: Date.now() }), JSON_TYPE);
    const uploads = [...files].flatMap(([relative, data]) => {
      const type = publishedContentType(relative);
      return type ? [{ relative, data, type }] : [];
    });
    await inBatches(uploads, async ({ relative, data, type }) => {
      const key = resolveKey(`${root}/files`, relative);
      if (!key) throw new Error("Caminho de upload inválido.");
      await remoteUpload(key, data, type);
    });
    await remoteUpload(`${root}/plan.json`, encode({ ...plan, createdAt: Date.now() }), JSON_TYPE);
    return id;
  } catch (error) { await remoteRemovePrefix(root).catch(() => undefined); throw error; }
}

export async function readStagedPlanRemote(id: string, claimed: boolean): Promise<StagedPlan | null> {
  try {
    const root = base(id);
    // Como no disco, um staging reivindicado não é mais visível como "não reivindicado".
    if ((await remoteStat(`${root}/claim.json`) !== null) !== claimed) return null;
    const parsed = planSchema.safeParse(JSON.parse(new TextDecoder().decode(await remoteRead(`${root}/plan.json`))));
    if (!parsed.success || Date.now() - parsed.data.createdAt > STAGING_TTL_MS) return null;
    return parsed.data;
  } catch { return null; }
}

export async function claimStagingRemote(id: string): Promise<void> {
  if (!(await remoteStat(`${base(id)}/plan.json`))) throw new Error("Importação indisponível ou expirada.");
  if (!(await tryClaim(id))) throw new Error("Esta importação já está em andamento.");
}

async function readClaimedFile(id: string, relative: string, pattern: RegExp, limit: number, label: string): Promise<Uint8Array> {
  const key = resolveKey(`${base(id)}/files`, relative);
  if (!key || !pattern.test(relative)) throw new Error(`Caminho ${label} inválido.`);
  const info = await remoteStat(key);
  if (!info) throw new Error(`Arquivo ${label} não encontrado.`);
  if (info.size > limit) throw new Error(`${label} excede o limite de tamanho.`);
  return remoteRead(key);
}
export async function readClaimedHtmlRemote(id: string, relative: string): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await readClaimedFile(id, relative, /\.html?$/i, MAX_HTML_BYTES, "HTML"));
}
export async function readClaimedPdfRemote(id: string, relative: string): Promise<Uint8Array> {
  return readClaimedFile(id, relative, /\.pdf$/i, MAX_PDF_BYTES, "PDF");
}

/** Copia (no servidor do Storage) o staging para `systems/<slug>/<importId>/`; o staging permanece intacto. */
export async function promoteStagingRemote(id: string, slug: string, importId: string): Promise<void> {
  const source = `${base(id)}/files`;
  const target = `systems/${slug}/${importId}`;
  try {
    const keys = await remoteListFiles(source);
    await inBatches(keys, key => remoteCopy(key, `${target}/${key.slice(source.length + 1)}`));
  } catch (error) {
    // importId é novo e nada o referencia antes do commit: a remoção parcial é segura.
    await remoteRemovePrefix(target).catch(() => undefined);
    throw error;
  }
}

/** Devolve o staging ao estado não reivindicado (os arquivos nunca saíram do lugar). */
export async function restoreClaimRemote(id: string): Promise<void> { await remoteRemoveKeys([`${base(id)}/claim.json`]); }
export async function finishClaimRemote(id: string): Promise<void> { await remoteRemovePrefix(base(id)); }
export async function markClaimActivatedRemote(id: string, slug: string): Promise<void> {
  await remoteUpload(`${base(id)}/activated.json`, encode({ systemSlug: slug }), JSON_TYPE, true);
}

async function stagingIds(): Promise<string[]> {
  return (await remoteList("staging")).filter(entry => entry.id === null && isValidStagingId(entry.name)).map(entry => entry.name);
}
export async function cleanupActivatedClaimsRemote(slug: string): Promise<void> {
  for (const id of await stagingIds()) {
    if (!(await remoteStat(`${base(id)}/claim.json`))) continue;
    const marker = await remoteRead(`${base(id)}/activated.json`).then(data => JSON.parse(new TextDecoder().decode(data)) as { systemSlug?: string }, () => null);
    if (marker?.systemSlug === slug) await finishClaimRemote(id);
  }
}

/** Remove um staging ainda não reivindicado. Reivindicar primeiro impede corrida com uma aplicação em andamento. */
export async function removeStagingRemote(id: string): Promise<void> {
  if (!(await tryClaim(id))) return;
  await remoteRemovePrefix(base(id));
}

async function createdAtOf(id: string): Promise<number | null> {
  for (const name of ["plan.json", "init.json"]) {
    try {
      const value = (JSON.parse(new TextDecoder().decode(await remoteRead(`${base(id)}/${name}`))) as { createdAt?: unknown }).createdAt;
      if (typeof value === "number") return value;
    } catch { /* tenta o próximo */ }
  }
  return null;
}
export async function cleanupExpiredStagingRemote(): Promise<void> {
  for (const id of await stagingIds()) {
    if (await remoteStat(`${base(id)}/claim.json`)) continue; // trabalho em andamento nunca é removido
    const createdAt = await createdAtOf(id);
    if (createdAt !== null && Date.now() - createdAt > STAGING_TTL_MS) await removeStagingRemote(id);
  }
}
