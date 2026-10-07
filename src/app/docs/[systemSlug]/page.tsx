import { FileTextIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/layout/empty-state";
import { getDocsContext } from "@/features/documents/docs-context";

export default async function SystemIndexPage({ params }: PageProps<"/docs/[systemSlug]">) {
  const { systemSlug } = await params;
  const { system, profile, navigation } = await getDocsContext(systemSlug);

  const firstDocument = navigation.visibleTree[0];
  if (firstDocument) {
    redirect(firstDocument.href);
  }

  return (
    <EmptyState
      icon={FileTextIcon}
      title="Nenhum documento disponível"
      description={`O sistema ${system.name} não possui documentos para o perfil ${profile.name}.`}
      className="py-24"
    />
  );
}
