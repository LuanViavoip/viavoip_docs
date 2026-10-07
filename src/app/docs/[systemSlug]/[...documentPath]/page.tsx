import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsBreadcrumbs } from "@/components/docs/docs-breadcrumbs";
import { DocsContent } from "@/components/docs/docs-content";
import { ExamplesPanel } from "@/components/docs/examples-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { getDocumentContent } from "@/features/content/service";
import { getDocsContext } from "@/features/documents/docs-context";
import { getDocumentExamples, resolveDocumentPath, systemBasePath } from "@/features/documents/queries";

type DocumentPageProps = PageProps<"/docs/[systemSlug]/[...documentPath]">;

export async function generateMetadata({ params }: DocumentPageProps): Promise<Metadata> {
  const { systemSlug, documentPath } = await params;
  const { system, navigation } = await getDocsContext(systemSlug);
  const resolved = resolveDocumentPath(navigation, documentPath);
  return { title: resolved.status === "found" ? `${resolved.match.node.title} · ${system.name}` : system.name };
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { systemSlug, documentPath } = await params;
  const { system, profile, navigation } = await getDocsContext(systemSlug);

  const resolved = resolveDocumentPath(navigation, documentPath);
  if (resolved.status === "not-found") {
    notFound();
  }
  if (resolved.status === "restricted") {
    return (
      <EmptyState
        icon={LockIcon}
        title="Documento não disponível para o seu perfil"
        description={`Este documento não faz parte da documentação exibida para o perfil ${profile.name}.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/profile?next=${encodeURIComponent(`${systemBasePath(system.slug)}/${documentPath.join("/")}`)}`}>
              Alterar perfil
            </Link>
          </Button>
        }
        className="py-24"
      />
    );
  }

  const { node, ancestors } = resolved.match;
  const [content, examples] = await Promise.all([
    getDocumentContent({
      contentUrl: node.contentUrl,
      resolveDocumentHref: (contentUrl) => navigation.hrefByContentUrl.get(contentUrl),
    }),
    getDocumentExamples(node.id),
  ]);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <article className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-10">
        <DocsBreadcrumbs
          systemName={system.name}
          systemHref={systemBasePath(system.slug)}
          ancestors={ancestors}
          current={node}
        />
        <DocsContent node={node} content={content} />
      </article>
      <aside
        aria-label="Exemplos"
        className="border-t xl:sticky xl:top-14 xl:h-[calc(100svh-3.5rem)] xl:overflow-y-auto xl:border-t-0 xl:border-l"
      >
        <ExamplesPanel items={examples} />
      </aside>
    </div>
  );
}
