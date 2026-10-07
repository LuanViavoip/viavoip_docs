import type { SafeHtml } from "@/lib/html/safe-html";
import { cn } from "@/lib/utils";

type HtmlContentProps = {
  html: SafeHtml;
  className?: string;
};

/** Único componente que usa `dangerouslySetInnerHTML`; aceita apenas `SafeHtml`. */
export function HtmlContent({ html, className }: HtmlContentProps) {
  return <div className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
