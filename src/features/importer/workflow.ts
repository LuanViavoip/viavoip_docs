import { claimStaging, finishClaim, markClaimActivated, importedContentUrl, promoteClaimedStaging, readClaimedHtml, readClaimedPdf, readStagedPlan, removeOtherImports, restoreClaim, type StagedPlan } from "./storage";
import { prepareImportedNodes, validateImportNodes, type PreparedNode } from "./prepare";

export type ImportStore = {
  fingerprint(): Promise<string>;
  profiles(): Promise<ReadonlySet<string>>;
  activeContentUrls(): Promise<ReadonlySet<string>>;
  replace(plan: StagedPlan, nodes: PreparedNode[], importId: string): Promise<void>;
};
export type ImportRepository = {
  withSystemLock<T>(slug: string, operation: (store: ImportStore) => Promise<T>): Promise<T>;
};
export type ApplicationResult = { systemSlug: string; cleanupPending: boolean };

export async function runImportApplication(id: string, ownerId: string, repository: ImportRepository,
  cleanup: typeof removeOtherImports = removeOtherImports): Promise<ApplicationResult> {
  await claimStaging(id);
  let promoted: { slug: string; importId: string } | undefined;
  let slug = "";
  try {
    const plan = await readStagedPlan(id, true);
    if (!plan || plan.ownerId !== ownerId) throw new Error("Importação indisponível para esta sessão ou expirada.");
    slug = plan.system.slug;
    await repository.withSystemLock(slug, async store => {
      if (await store.fingerprint() !== plan.baseFingerprint) throw new Error("O sistema mudou desde o preview. Envie novamente para revisar as alterações.");
      validateImportNodes(plan.tree, await store.profiles());
      // Validar todos os conteúdos antes de qualquer exclusão no banco.
      const prepared = await prepareImportedNodes(plan.tree, relative => readClaimedHtml(id, relative), `/content/${slug}/preview/`, relative => readClaimedPdf(id, relative));
      const publication = await promoteClaimedStaging(id, slug);
      promoted = { slug, importId: publication.importId };
      const rebase = (nodes: PreparedNode[]): PreparedNode[] => nodes.map(node => ({
        ...node,
        contentUrl: node.file ? importedContentUrl(publication.contentBase, node.file) : node.contentUrl,
        managedReferences: node.managedReferences.map(url => url.replace(`/content/${slug}/preview/`, publication.contentBase)),
        children: rebase(node.children),
      }));
      // Arquivos já presentes quando o commit torna suas referências visíveis.
      await store.replace(plan, rebase(prepared), publication.importId);
    });
  } catch (error) {
    try { await restoreClaim(id, promoted); }
    catch (restoreError) { console.error("Não foi possível restaurar staging; arquivos publicados foram preservados.", restoreError); }
    throw error;
  }
  let cleanupPending = false;
  try {
    await markClaimActivated(id, slug);
    // Nova leitura sob lock: outra aplicação pode ter terminado depois do commit anterior.
    await repository.withSystemLock(slug, async store => cleanup(slug, await store.activeContentUrls()));
    await finishClaim(id);
  } catch (error) { cleanupPending = true; console.error("Importação ativada; limpeza pendente.", error); }
  return { systemSlug: slug, cleanupPending };
}
