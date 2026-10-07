import { FolderTreeIcon } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import type { DocumentNode } from "@/features/documents/tree";

import { DocsTree } from "./docs-tree";

type DocsSidebarProps = {
  tree: DocumentNode[];
  profileName: string;
  onNavigate?: () => void;
};

export function DocsSidebar({ tree, profileName, onNavigate }: DocsSidebarProps) {
  return (
    <nav aria-label="Índice da documentação" className="flex flex-col gap-3 p-4">
      <p className="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Índice</p>
      {tree.length === 0 ? (
        <EmptyState
          icon={FolderTreeIcon}
          title="Nenhum documento"
          description={`Não há documentos disponíveis para o perfil ${profileName}.`}
          className="py-8"
        />
      ) : (
        <DocsTree nodes={tree} onNavigate={onNavigate} />
      )}
    </nav>
  );
}
