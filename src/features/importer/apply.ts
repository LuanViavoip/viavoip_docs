import "next/dist/compiled/server-only";
import { prismaImportRepository } from "./repository";
import { runImportApplication } from "./workflow";
import { cleanupActivatedClaims, removeOtherImports } from "./storage";

export async function applyStagedImport(stagingId: string, ownerId: string) {
  return runImportApplication(stagingId, ownerId, prismaImportRepository);
}
export async function retryImportCleanup(systemSlug: string) {
  await prismaImportRepository.withSystemLock(systemSlug, async store => {
    await removeOtherImports(systemSlug, await store.activeContentUrls());
    await cleanupActivatedClaims(systemSlug);
  });
}
