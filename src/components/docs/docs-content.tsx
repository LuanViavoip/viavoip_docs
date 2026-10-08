import { DownloadIcon, FileWarningIcon, FolderOpenIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocumentNode } from "@/features/documents/tree";
import type { DocumentContentResult } from "@/features/content/service";

import { HtmlContent } from "./html-content";

type DocsContentProps = {
  node: DocumentNode;
  content: DocumentContentResult;
};

export function DocsContent({ node, content }: DocsContentProps) {
  switch (content.status) {
    case "ok":
      return <HtmlContent html={content.html} className="doc-content" />;
    case "pdf":
      return <PdfContent node={node} url={content.url} />;
    case "empty":
      return <SectionOverview node={node} />;
    case "error":
      return (
        <div className="space-y-4">
          <DocumentTitle node={node} />
          <EmptyState
            icon={FileWarningIcon}
            title="Não foi possível carregar este documento"
            description={content.message}
            className="rounded-lg border border-dashed"
          />
        </div>
      );
    default: {
      const unhandled: never = content;
      throw new Error(`Estado de conteúdo não tratado: ${JSON.stringify(unhandled)}`);
    }
  }
}

function DocumentTitle({ node }: { node: DocumentNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">{node.title}</h1>
      {node.type ? <Badge variant="outline">{node.type}</Badge> : null}
    </div>
  );
}

/** Documentos em PDF usam o visualizador do navegador; o link de download cobre navegadores sem visualizador. */
function PdfContent({ node, url }: { node: DocumentNode; url: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DocumentTitle node={node} />
        <Button asChild variant="outline" size="sm">
          <a href={url} download>
            <DownloadIcon aria-hidden />
            Baixar PDF
          </a>
        </Button>
      </div>
      <iframe src={url} title={node.title} className="h-[80svh] w-full rounded-lg border bg-muted" />
    </div>
  );
}

/** Nós sem HTML próprio (agrupadores do índice) exibem a lista dos filhos visíveis. */
function SectionOverview({ node }: { node: DocumentNode }) {
  return (
    <div className="space-y-6">
      <DocumentTitle node={node} />
      {node.children.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="Seção vazia"
          description="Esta seção não possui conteúdo nem documentos disponíveis para o seu perfil."
          className="rounded-lg border border-dashed"
        />
      ) : (
        <>
          <p className="text-muted-foreground">Esta seção agrupa os documentos abaixo.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {node.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={child.href}
                  className="flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-accent/40"
                >
                  <span className="font-medium">{child.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {child.children.length > 0 ? `${child.children.length} subitens` : (child.type ?? "documento")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
