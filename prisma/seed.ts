import "dotenv/config";

import { demoProfiles } from "@/data/demo/profiles";
import { solMakerDemo, type DemoDocument } from "@/data/demo/sol-maker-demo";
import { prepareSeed } from "@/features/demo/prepare-seed";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

async function seedProfiles(tx: Prisma.TransactionClient): Promise<Map<string, string>> {
  const idsBySlug = new Map<string, string>();
  for (const [position, profile] of demoProfiles.entries()) {
    const saved = await tx.profile.upsert({
      where: { slug: profile.slug },
      update: { name: profile.name, position },
      create: { ...profile, position },
    });
    idsBySlug.set(saved.slug, saved.id);
  }
  return idsBySlug;
}

async function seedDocuments(
  tx: Prisma.TransactionClient,
  documents: DemoDocument[],
  context: { systemId: string; parentId: string | null; profileIds: Map<string, string> },
): Promise<number> {
  let count = 0;

  for (const [position, document] of documents.entries()) {
    const searchableContent = document.contentUrl ? preparedContent.get(document.contentUrl)! : null;

    const created = await tx.document.create({
      data: {
        systemId: context.systemId,
        parentId: context.parentId,
        title: document.title,
        slug: document.slug,
        type: document.type ?? null,
        contentUrl: document.contentUrl ?? null,
        position,
        searchableContent,
        metadata: { demo: true },
        profiles: {
          create: (document.profiles ?? []).map((slug) => {
            const profileId = context.profileIds.get(slug);
            if (!profileId) {
              throw new Error(`Perfil desconhecido no seed: ${slug}`);
            }
            return { profileId };
          }),
        },
        examples: {
          create: (document.examples ?? []).map((example, examplePosition) => ({
            kind: "code",
            title: example.title,
            language: example.language ?? null,
            content: example.content,
            position: examplePosition,
          })),
        },
      },
    });

    count += 1;
    if (document.children?.length) {
      count += await seedDocuments(tx, document.children, { ...context, parentId: created.id });
    }
  }

  return count;
}

let preparedContent: Map<string, string>;
async function main() {
  preparedContent = await prepareSeed(solMakerDemo.documents, new Set(demoProfiles.map(profile => profile.slug)));
  const documentCount = await prisma.$transaction(async tx => {
    // Mesmo protocolo de locks do importador para não disputar ativação/cleanup.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('viavoip-import-references', 0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`viavoip-import:${solMakerDemo.slug}`}, 0))`;
    const profileIds = await seedProfiles(tx);
    const system = await tx.system.upsert({ where: { slug: solMakerDemo.slug },
      update: { name: solMakerDemo.name, description: solMakerDemo.description },
      create: { name: solMakerDemo.name, slug: solMakerDemo.slug, description: solMakerDemo.description } });
    await tx.document.deleteMany({ where: { systemId: system.id } });
    return seedDocuments(tx, solMakerDemo.documents, { systemId: system.id, parentId: null, profileIds });
  }, { timeout: 120_000, maxWait: 120_000 });
  console.log(`Seed concluído: sistema demonstrativo com ${documentCount} documentos.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
