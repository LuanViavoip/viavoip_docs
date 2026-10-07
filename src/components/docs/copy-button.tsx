"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permissão negada ou documento sem foco: tenta o fallback abaixo.
    }
  }
  copyWithTextarea(text);
}

/** Fallback para acesso via HTTP em rede interna, onde a Clipboard API não está disponível. */
function copyWithTextarea(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) {
    throw new Error("Falha ao copiar");
  }
}

const LABELS: Record<CopyState, string> = {
  idle: "Copiar",
  copied: "Copiado",
  failed: "Falhou",
};

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function handleCopy() {
    try {
      await copyToClipboard(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), 1800);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={handleCopy}
      aria-live="polite"
      className="text-muted-foreground hover:text-foreground"
    >
      {state === "copied" ? <CheckIcon /> : <CopyIcon />}
      {LABELS[state]}
    </Button>
  );
}
