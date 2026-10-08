import type { SafeHtml } from "@/lib/html/safe-html";

import { ContentError, type ContentErrorReason } from "./errors";
import { extractSearchableText, sanitizeDocumentHtml, type SanitizeOptions } from "./sanitize";
import { extractPdfText, isPdfPath } from "./pdf";
import { assertPdfAvailable, loadRawHtml, loadRawPdf } from "./sources";

export type DocumentContentResult =
  | { status: "ok"; html: SafeHtml }
  /** Documento em PDF: a interface exibe o arquivo em um visualizador, sem passar pela sanitização de HTML. */
  | { status: "pdf"; url: string }
  | { status: "empty" }
  | { status: "error"; reason: ContentErrorReason; message: string };

type GetDocumentContentInput = {
  contentUrl: string | null;
  resolveDocumentHref?: SanitizeOptions["resolveDocumentHref"];
};

/** Fluxo: contentUrl -> origem -> HTML bruto -> sanitização -> HTML seguro para renderização. */
export async function getDocumentContent({
  contentUrl,
  resolveDocumentHref,
}: GetDocumentContentInput): Promise<DocumentContentResult> {
  if (!contentUrl) {
    return { status: "empty" };
  }

  try {
    if (isPdfPath(contentUrl)) {
      await assertPdfAvailable(contentUrl);
      return { status: "pdf", url: contentUrl };
    }
    const { html, baseUrl } = await loadRawHtml(contentUrl);
    const safe = sanitizeDocumentHtml(html, { baseUrl, resolveDocumentHref });
    const hasVisualContent = /<hr\b|<img\b[^>]*\bsrc="[^"]+"/i.test(safe);
    return extractSearchableText(safe) || hasVisualContent ? { status: "ok", html: safe } : { status: "empty" };
  } catch (error) {
    if (error instanceof ContentError) {
      return { status: "error", reason: error.reason, message: error.message };
    }
    throw error;
  }
}

/**
 * Fluxo de indexação: contentUrl -> HTML bruto -> sanitização -> texto puro (ou texto extraído do PDF).
 * Usado pelo seed para preencher `Document.searchableContent`; o importador reutiliza sanitização e extração.
 */
export async function getDocumentSearchableText(contentUrl: string): Promise<string> {
  if (isPdfPath(contentUrl)) {
    return extractPdfText(await loadRawPdf(contentUrl));
  }
  const { html, baseUrl } = await loadRawHtml(contentUrl);
  return extractSearchableText(sanitizeDocumentHtml(html, { baseUrl }));
}
