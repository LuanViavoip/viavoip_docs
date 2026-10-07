import "next/dist/compiled/server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildDocumentTree, flattenTree } from "@/features/documents/tree";
import { documentSignature, fingerprint, type DocumentSnapshot } from "./preview";
import type { PreparedNode } from "./prepare";
import type { StagedPlan } from "./storage";
import type { ImportRepository } from "./workflow";

export async function getImportSnapshot(slug: string, db: Prisma.TransactionClient = prisma): Promise<{ fingerprint: string; documents: DocumentSnapshot[] }> {
  const system = await db.system.findUnique({ where: { slug } });
  if (!system) return { fingerprint: fingerprint(null), documents: [] };
  const documents = await db.document.findMany({
    where: { systemId: system.id }, orderBy: { id: "asc" },
    include: { profiles: { include: { profile: true }, orderBy: { profileId: "asc" } }, examples: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
  });
  const records = documents.map(document => ({ ...document, profileSlugs: document.profiles.map(link => link.profile.slug) }));
  const paths = new Map(flattenTree(buildDocumentTree(records, "")).map(node => [node.id, node.href]));
  return {
    fingerprint: fingerprint({ system, documents }),
    documents: documents.map(document => {
      const metadata = document.metadata as { file?: string } | null;
      return { path: paths.get(document.id)!, signature: documentSignature({
        title: document.title, type: document.type, profiles: document.profiles.map(link => link.profile.slug),
        searchableContent: document.searchableContent,
        examples: document.examples.map(example => ({ title: example.title, language: example.language, content: example.content })),
      }, metadata?.file ?? document.contentUrl, document.position) };
    }),
  };
}

async function replaceDocuments(tx: Prisma.TransactionClient, plan: StagedPlan, nodes: PreparedNode[], importId: string) {
  const profiles = await tx.profile.findMany({ select: { id: true, slug: true } });
  const profileIds = new Map(profiles.map(profile => [profile.slug, profile.id]));
  const system = await tx.system.upsert({ where: { slug: plan.system.slug }, update: { name: plan.system.name, description: plan.system.description }, create: plan.system });
  await tx.document.deleteMany({ where: { systemId: system.id } });
  const create = async (nodes: PreparedNode[], parentId: string | null) => {
    for (const [position, node] of nodes.entries()) {
      const document = await tx.document.create({ data: {
        systemId: system.id, parentId, title: node.title, slug: node.slug, type: node.type,
        contentUrl: node.contentUrl, position, searchableContent: node.searchableContent,
        metadata: { source: "import", importId, file: node.file, managedReferences: node.managedReferences },
        profiles: { create: node.profiles.map(slug => {
          const profileId = profileIds.get(slug);
          if (!profileId) throw new Error(`Perfil inexistente: ${slug}.`);
          return { profileId };
        }) },
        examples: { create: node.examples.map((example, position) => ({ ...example, kind: "code", position })) },
      } });
      await create(node.children, document.id);
    }
  };
  await create(nodes, null);
}

export function createPrismaImportRepository(client: typeof prisma = prisma): ImportRepository { return {
  async withSystemLock(slug, operation) {
    return client.$transaction(async tx => {
      // Ordem única dos locks. O lock global protege referências cruzadas durante ativação/cleanup.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('viavoip-import-references', 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`viavoip-import:${slug}`}, 0))`;
      return operation({
        async fingerprint() { return (await getImportSnapshot(slug, tx)).fingerprint; },
        async profiles() { return new Set((await tx.profile.findMany({ select: { slug: true } })).map(profile => profile.slug)); },
        async activeContentUrls() {
          const records = await tx.document.findMany({ select: { contentUrl: true, metadata: true } });
          const refs = new Set<string>();
          for (const record of records) {
            if (record.contentUrl) refs.add(record.contentUrl);
            const metadata = record.metadata as { managedReferences?: unknown } | null;
            if (Array.isArray(metadata?.managedReferences)) for (const value of metadata.managedReferences) if (typeof value === "string") refs.add(value);
          }
          return refs;
        },
        replace: (plan, nodes, importId) => replaceDocuments(tx, plan, nodes, importId),
      });
    }, { timeout: 120_000, maxWait: 120_000 });
  },
}; }

export const prismaImportRepository = createPrismaImportRepository();
