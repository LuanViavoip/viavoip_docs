import { highlightCode } from "@/lib/html/highlight";

import { CopyButton } from "./copy-button";
import { HtmlContent } from "./html-content";

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Shell",
  sh: "Shell",
  shell: "Shell",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  php: "PHP",
  json: "JSON",
  http: "HTTP",
  html: "HTML",
  sql: "SQL",
  python: "Python",
};

export function languageLabel(language: string | null): string {
  if (!language) {
    return "Texto";
  }
  return LANGUAGE_LABELS[language.toLowerCase()] ?? language;
}

type CodeBlockProps = {
  code: string;
  language: string | null;
  title?: string;
};

export async function CodeBlock({ code, language, title }: CodeBlockProps) {
  const html = await highlightCode(code, language);

  return (
    <div className="code-block overflow-hidden rounded-lg border bg-[var(--code-background)]">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{languageLabel(language)}</span>
          {title ? <span className="truncate text-muted-foreground">{title}</span> : null}
        </div>
        <CopyButton text={code} />
      </div>
      <HtmlContent html={html} />
    </div>
  );
}
