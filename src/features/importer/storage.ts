import { randomUUID } from "node:crypto";
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { IMPORTED_CONTENT_PREFIX, resolveInside, STAGING_STORAGE_DIR, SYSTEMS_STORAGE_DIR } from "@/lib/storage/paths";
import { parseContentUrl } from "@/features/content/urls";
import { STAGING_TTL_MS } from "./constants";
import type { ImportNode, ImportStructureSource, ImportSystemTarget } from "./types";

export type StagedPlan = {
  createdAt: number;
  ownerId: string;
  baseFingerprint: string;
  system: Pick<ImportSystemTarget, "name" | "slug" | "description">;
  source: ImportStructureSource;
  tree: ImportNode[];
};
const nodeSchema: z.ZodType<ImportNode> = z.lazy(() => z.object({
  title: z.string().min(1).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.string().nullable(), file: z.string().nullable(), contentUrl: z.string().nullable().optional(),
  searchableContent: z.string().nullable().optional(), profiles: z.array(z.string()),
  examples: z.array(z.object({ title: z.string(), language: z.string().nullable(), content: z.string() })),
  children: z.array(nodeSchema),
}));
const planSchema = z.object({
  createdAt: z.number().int(), ownerId: z.uuid(), baseFingerprint: z.string(),
  system: z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable() }),
  source: z.enum(["index", "folders"]), tree: z.array(nodeSchema).min(1),
});
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isValidStagingId(value: unknown): value is string { return typeof value === "string" && ID_PATTERN.test(value); }
function stagingDir(id: string, claimed = false): string {
  if (!isValidStagingId(id)) throw new Error("Identificador de importação inválido.");
  return path.join(STAGING_STORAGE_DIR, claimed ? `${id}.working` : id);
}
function systemDir(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug de sistema inválido.");
  return path.join(SYSTEMS_STORAGE_DIR, slug);
}
export async function createStaging(files: Map<string, Uint8Array>, plan: Omit<StagedPlan, "createdAt">) {
  const id = randomUUID();
  const root = `${stagingDir(id)}.creating`;
  try {
    await mkdir(path.join(root, "files"), { recursive: true });
    for (const [relative, data] of files) {
      const target = resolveInside(path.join(root, "files"), relative);
      if (!target) throw new Error("Caminho de upload inválido.");
      await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data);
    }
    await writeFile(path.join(root, "plan.json"), JSON.stringify({ ...plan, createdAt: Date.now() }));
    await rename(root, stagingDir(id));
    return id;
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}
export async function readStagedPlan(id: string, claimed = false): Promise<StagedPlan | null> {
  try {
    const parsed = planSchema.safeParse(JSON.parse(await readFile(path.join(stagingDir(id, claimed), "plan.json"), "utf8")));
    if (!parsed.success || Date.now() - parsed.data.createdAt > STAGING_TTL_MS) return null;
    return parsed.data;
  } catch { return null; }
}
/** Rename é o claim exclusivo. Cancelamento/expiração nunca tocam .working. */
export async function claimStaging(id: string): Promise<void> { await rename(stagingDir(id), stagingDir(id, true)); }
export async function readClaimedHtml(id: string, relative: string): Promise<string> {
  const target = resolveInside(path.join(stagingDir(id, true), "files"), relative);
  if (!target || !/\.html?$/i.test(target)) throw new Error("Caminho HTML inválido.");
  const data = await readFile(target);
  if (data.byteLength > 2 * 1024 * 1024) throw new Error("HTML excede o limite de tamanho.");
  return data.toString("utf8");
}
export async function promoteClaimedStaging(id: string, slug: string) {
  const importId = randomUUID();
  const target = path.join(systemDir(slug), importId);
  await mkdir(systemDir(slug), { recursive: true });
  await rename(path.join(stagingDir(id, true), "files"), target);
  return { importId, contentBase: `${IMPORTED_CONTENT_PREFIX}${slug}/${importId}/` };
}
export async function restoreClaim(id: string, promoted?: { slug: string; importId: string }) {
  // Não apagar a pasta promovida: uma falha de conexão no commit pode ter resultado ambíguo.
  if (promoted) await cp(path.join(systemDir(promoted.slug), promoted.importId), path.join(stagingDir(id, true), "files"), { recursive: true });
  await rename(stagingDir(id, true), stagingDir(id));
}
export async function finishClaim(id: string) { await rm(stagingDir(id, true), { recursive: true, force: true }); }
/** Só após commit confirmado; nunca marcar um staging em aplicação. */
export async function markClaimActivated(id: string, slug: string) {
  await writeFile(path.join(stagingDir(id, true), "activated.json"), JSON.stringify({ systemSlug: slug }));
}
export async function cleanupActivatedClaims(slug: string) {
  const entries = await readdir(STAGING_STORAGE_DIR).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return []; throw error;
  });
  for (const entry of entries) {
    if (!entry.endsWith(".working") || !isValidStagingId(entry.slice(0, -8))) continue;
    const id = entry.slice(0, -8);
    const marker = await readFile(path.join(stagingDir(id, true), "activated.json"), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null; throw error;
    });
    if (marker && JSON.parse(marker).systemSlug === slug) await finishClaim(id);
  }
}
export async function removeStaging(id: string) {
  const discard = `${stagingDir(id)}.discard-${randomUUID()}`;
  try { await rename(stagingDir(id), discard); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  await rm(discard, { recursive: true, force: true });
}
/** Deve ser chamado apenas sob o mesmo lock de aplicação por sistema, com referências atuais do banco. */
export async function removeOtherImports(slug: string, activeContentUrls: ReadonlySet<string>) {
  const keep = new Set<string>();
  const prefix = `${IMPORTED_CONTENT_PREFIX}${slug}/`;
  for (const url of activeContentUrls) {
    const location = parseContentUrl(url);
    if (location?.kind === "local" && location.pathname.startsWith(prefix)) keep.add(location.pathname.slice(prefix.length).split("/")[0]);
  }
  const entries = await readdir(systemDir(slug), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return []; throw error;
  });
  for (const entry of entries) {
    if (entry.isDirectory() && !keep.has(entry.name)) await rm(path.join(systemDir(slug), entry.name), { recursive: true, force: true });
  }
}
export async function cleanupExpiredStaging() {
  const entries = await readdir(STAGING_STORAGE_DIR).catch(() => []);
  for (const id of entries.filter(isValidStagingId)) {
    // Um claim concorrente move o diretório; removeStaging então vira no-op.
    if (!(await readStagedPlan(id))) await removeStaging(id);
  }
}
export function importedContentUrl(base: string, relative: string): string { return base + relative.split("/").map(encodeURIComponent).join("/"); }
