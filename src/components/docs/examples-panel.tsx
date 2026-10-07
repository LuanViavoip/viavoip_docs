import { CodeIcon } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import type { PanelItemRecord } from "@/features/documents/queries";

import { CodeBlock } from "./code-block";

/** Tipos de conteúdo suportados no painel lateral. Novos tipos entram aqui e no `switch` abaixo. */
const PANEL_ITEM_KINDS = ["code"] as const;
type PanelItemKind = (typeof PANEL_ITEM_KINDS)[number];

function parseKind(kind: string): PanelItemKind | null {
  return (PANEL_ITEM_KINDS as readonly string[]).includes(kind) ? (kind as PanelItemKind) : null;
}

function PanelItem({ item }: { item: PanelItemRecord }) {
  const kind = parseKind(item.kind);
  if (!kind) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Tipo de conteúdo não suportado: <code>{item.kind}</code>
      </p>
    );
  }

  switch (kind) {
    case "code":
      return <CodeBlock code={item.content} language={item.language} title={item.title} />;
    default: {
      const unhandled: never = kind;
      throw new Error(`Tipo de item não tratado: ${String(unhandled)}`);
    }
  }
}

export function ExamplesPanel({ items }: { items: PanelItemRecord[] }) {
  return (
    <section aria-labelledby="examples-heading" className="flex flex-col gap-4 p-5">
      <h2 id="examples-heading" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Exemplos
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon={CodeIcon}
          title="Sem exemplos"
          description="Este documento ainda não possui exemplos de código."
          className="py-8"
        />
      ) : (
        items.map((item) => <PanelItem key={item.id} item={item} />)
      )}
    </section>
  );
}
