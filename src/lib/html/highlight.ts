import { bundledLanguages, codeToHtml, type BundledLanguage } from "shiki";

import { markAsSafeHtml, type SafeHtml } from "./safe-html";

const THEME = "github-dark-default";

function isBundledLanguage(language: string): language is BundledLanguage {
  return Object.hasOwn(bundledLanguages, language);
}

/** Realce de sintaxe no servidor. O Shiki escapa o código, então a saída é segura por construção. */
export async function highlightCode(code: string, language: string | null): Promise<SafeHtml> {
  const lang = language && isBundledLanguage(language) ? language : "text";
  return markAsSafeHtml(await codeToHtml(code, { lang, theme: THEME }));
}
