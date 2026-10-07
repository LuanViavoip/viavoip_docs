"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { DocumentNode } from "@/features/documents/tree";
import { cn } from "@/lib/utils";

type DocsTreeProps = {
  nodes: DocumentNode[];
  onNavigate?: () => void;
};

export function DocsTree({ nodes, onNavigate }: DocsTreeProps) {
  const pathname = decodeURI(usePathname());

  return (
    <ul role="tree" className="space-y-0.5">
      {nodes.map((node) => (
        <DocsTreeItem key={node.id} node={node} pathname={pathname} depth={0} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

type DocsTreeItemProps = {
  node: DocumentNode;
  pathname: string;
  depth: number;
  onNavigate?: () => void;
};

function DocsTreeItem({ node, pathname, depth, onNavigate }: DocsTreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isActive = pathname === node.href;
  const containsActive = pathname.startsWith(`${node.href}/`);

  // `null` = segue a navegação (abre o ramo do documento ativo); boolean = escolha do usuário.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? (containsActive || isActive);

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={isActive}>
      <div
        className={cn(
          "group flex items-center rounded-md text-sm transition-colors",
          isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setUserExpanded(!expanded)}
            aria-label={expanded ? `Recolher ${node.title}` : `Expandir ${node.title}`}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <Link
          href={node.href}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
          className={cn("min-w-0 flex-1 truncate py-1.5 pr-2", (isActive || containsActive) && "font-medium")}
        >
          {node.title}
        </Link>
      </div>

      {hasChildren && expanded ? (
        <ul role="group" className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <DocsTreeItem key={child.id} node={child} pathname={pathname} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
