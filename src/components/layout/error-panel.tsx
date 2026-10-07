"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPanelProps = {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
};

export function ErrorPanel({ error, retry, title = "Algo deu errado" }: ErrorPanelProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg border bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Verifique se o PostgreSQL está em execução (<code>pnpm db:up</code>) e se as migrations e o seed foram
          aplicados.
        </p>
        {error.digest ? <p className="text-xs text-muted-foreground/70">Código: {error.digest}</p> : null}
      </div>
      <Button variant="outline" size="sm" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
