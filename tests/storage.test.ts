import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { access, mkdir, writeFile, rm } from "node:fs/promises";
import test from "node:test";
import * as storage from "../src/features/importer/storage";
import { SYSTEMS_STORAGE_DIR } from "../src/lib/storage/paths";

test("Cleanup conserva todas as versões referenciadas e remove apenas órfãs", async () => {
  const root = `${SYSTEMS_STORAGE_DIR}/safe-cleanup`;
  for (const id of ["a", "b", "orphan"]) { await mkdir(`${root}/${id}`, { recursive: true }); await writeFile(`${root}/${id}/x.html`, id); }
  const refs = new Set(["/content/safe-cleanup/a/x.html", "/content/safe-cleanup/b/x.html"]);
  const cleanup = storage.removeOtherImports as unknown as (slug: string, refs: Set<string>) => Promise<void>;
  await cleanup("safe-cleanup", refs);
  await access(`${root}/a/x.html`); await access(`${root}/b/x.html`);
  await assert.rejects(access(`${root}/orphan`));
  await rm(root, { recursive: true, force: true });
});

test("Claim de staging é exclusivo e não pode ser cancelado/expirado durante aplicação", async () => {
  const ownerId = randomUUID();
  const id = await storage.createStaging(new Map([["x.html", new TextEncoder().encode("<p>X</p>")]]), {
    ownerId, baseFingerprint: "initial", system: { name: "Claims", slug: "claims", description: null }, source: "folders",
    tree: [{ title: "X", slug: "x", type: null, file: "x.html", profiles: [], examples: [], children: [] }],
  });
  const claims = await Promise.allSettled([storage.claimStaging(id), storage.claimStaging(id)]);
  assert.equal(claims.filter(result => result.status === "fulfilled").length, 1);
  await storage.removeStaging(id); await storage.cleanupExpiredStaging();
  assert.equal(await storage.readClaimedHtml(id, "x.html"), "<p>X</p>");
  // Sem prova de ativação a recuperação não pode apagar trabalho em andamento.
  await storage.cleanupActivatedClaims("claims");
  assert.ok(await storage.readStagedPlan(id, true));
  await storage.markClaimActivated(id, "claims");
  await storage.cleanupActivatedClaims("claims");
  assert.equal(await storage.readStagedPlan(id, true), null);
});
