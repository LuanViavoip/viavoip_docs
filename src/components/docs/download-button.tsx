import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DownloadButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="rounded-md">
          <Button variant="outline" size="sm" disabled aria-label="Download (em breve)">
            <DownloadIcon />
            <span className="hidden lg:inline">Download</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Exportação disponível em uma fase futura</TooltipContent>
    </Tooltip>
  );
}
