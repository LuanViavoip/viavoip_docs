import { FileQuestionIcon } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";

export default function DocumentNotFound() {
  return (
    <EmptyState
      icon={FileQuestionIcon}
      title="Documento não encontrado"
      description="Este documento não existe neste sistema. Use o índice ao lado ou a pesquisa."
      className="py-24"
    />
  );
}
