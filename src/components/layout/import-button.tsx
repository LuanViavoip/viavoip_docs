import { UploadIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type ImportButtonProps = {
  variant?: "default" | "outline";
  size?: "sm" | "default";
  /** Mostra o texto mesmo em telas pequenas. */
  alwaysShowLabel?: boolean;
};

export function ImportButton({ variant = "outline", size = "sm", alwaysShowLabel = false }: ImportButtonProps) {
  return (
    <Button asChild variant={variant} size={size}>
      <Link href="/admin/import" aria-label="Importar documentação">
        <UploadIcon />
        <span className={alwaysShowLabel ? undefined : "hidden lg:inline"}>Importar</span>
      </Link>
    </Button>
  );
}
