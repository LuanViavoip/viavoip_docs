import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { DocumentNode } from "@/features/documents/tree";

type DocsBreadcrumbsProps = {
  systemName: string;
  systemHref: string;
  ancestors: DocumentNode[];
  current: DocumentNode;
};

export function DocsBreadcrumbs({ systemName, systemHref, ancestors, current }: DocsBreadcrumbsProps) {
  const items = [{ title: systemName, href: systemHref }, ...ancestors];

  return (
    <nav aria-label="Navegação estrutural" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-1">
            <Link href={item.href} className="hover:text-foreground">
              {item.title}
            </Link>
            <ChevronRightIcon className="size-3" />
          </li>
        ))}
        <li aria-current="page" className="text-foreground">
          {current.title}
        </li>
      </ol>
    </nav>
  );
}
