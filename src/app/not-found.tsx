import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <EmptyState
        icon={FileQuestionIcon}
        title="Página não encontrada"
        description="O endereço acessado não existe ou foi removido."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">Voltar ao início</Link>
          </Button>
        }
        className="flex-1"
      />
    </div>
  );
}
