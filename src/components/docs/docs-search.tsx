"use client";

import { FileTextIcon, Loader2Icon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { searchDocumentsAction } from "@/features/search/actions";
import { createRequestGate } from "@/features/search/request-gate";
import { SEARCH_MIN_LENGTH, type SearchResponse, type SearchResult } from "@/features/search/schema";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; response: SearchResponse };

const MATCH_LABELS: Record<SearchResult["matchedIn"], string> = {
  title: "título",
  content: "conteúdo",
  example: "exemplo",
};

type DocsSearchProps = {
  systemSlug: string;
  className?: string;
  onNavigate?: () => void;
};

export function DocsSearch({ systemSlug, className, onNavigate }: DocsSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGate = useRef(createRequestGate());
  const listId = useId();

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if ((event.key === "k" && (event.ctrlKey || event.metaKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    const gate = requestGate.current;
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer.current) clearTimeout(timer.current);
      gate.invalidate();
    };
  }, []);

  function handleChange(value: string) {
    const requestId = requestGate.current.invalidate();
    setQuery(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);

    const trimmed = value.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    timer.current = setTimeout(async () => {
      let response: SearchResponse;
      try {
        response = await searchDocumentsAction({ systemSlug, query: trimmed });
      } catch {
        response = { status: "error" };
      }
      if (requestGate.current.isCurrent(requestId)) {
        setState({ status: "done", response });
      }
    }, DEBOUNCE_MS);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function closeAndReset() {
    requestGate.current.invalidate();
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setQuery("");
    setState({ status: "idle" });
    onNavigate?.();
  }

  const showPanel = open && query.trim().length >= SEARCH_MIN_LENGTH;

  return (
    <div className={cn("relative w-full", className)} onBlur={handleBlur}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Pesquisar na documentação..."
        aria-label="Pesquisar na documentação"
        aria-expanded={showPanel}
        aria-controls={listId}
        autoComplete="off"
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-8 pr-12 pl-8"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground md:block">
        Ctrl K
      </kbd>

      {showPanel ? (
        <div
          id={listId}
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
        >
          <SearchPanelBody state={state} onNavigate={closeAndReset} />
        </div>
      ) : null}
    </div>
  );
}

function SearchPanelBody({ state, onNavigate }: { state: SearchState; onNavigate: () => void }) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Pesquisando...
      </p>
    );
  }

  const { response } = state;
  switch (response.status) {
    case "invalid":
      return <PanelMessage>Digite entre {SEARCH_MIN_LENGTH} e 100 caracteres.</PanelMessage>;
    case "no-profile":
      return <PanelMessage>Selecione um perfil para pesquisar.</PanelMessage>;
    case "error":
      return <PanelMessage>Não foi possível pesquisar agora. Tente novamente.</PanelMessage>;
    case "ok":
      if (response.results.length === 0) {
        return <PanelMessage>Nenhum resultado encontrado para o seu perfil.</PanelMessage>;
      }
      return (
        <ul role="listbox" aria-label="Resultados da pesquisa">
          {response.results.map((result) => (
            <li key={result.id}>
              <Link
                href={result.href}
                onClick={onNavigate}
                className="flex gap-3 rounded-md px-3 py-2.5 outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 space-y-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{result.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      em {MATCH_LABELS[result.matchedIn]}
                    </span>
                  </span>
                  {result.breadcrumb.length > 0 ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {result.breadcrumb.join(" / ")}
                    </span>
                  ) : null}
                  {result.snippet ? (
                    <span className="line-clamp-2 block text-xs text-muted-foreground/90">{result.snippet}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
    default: {
      const unhandled: never = response;
      throw new Error(`Resposta de pesquisa não tratada: ${JSON.stringify(unhandled)}`);
    }
  }
}

function PanelMessage({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
