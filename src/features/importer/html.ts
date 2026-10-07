import { extractSearchableText } from "@/features/content/sanitize";

/**
 * Decodifica o HTML respeitando o `charset` declarado (muitos HTMLs antigos são ISO-8859-1 /
 * Windows-1252). Sem declaração, assume UTF-8. O resultado é sempre armazenado em UTF-8.
 */
export function decodeHtml(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const charset =
    /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1]?.toLowerCase() ?? "utf-8";

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Título do documento: `<title>`, senão o primeiro `<h1>`. */
export function extractHtmlTitle(html: string): string | null {
  for (const pattern of [/<title[^>]*>([\s\S]*?)<\/title>/i, /<h1[^>]*>([\s\S]*?)<\/h1>/i]) {
    const match = pattern.exec(html);
    const text = match ? extractSearchableText(match[1]).slice(0, 200) : "";
    if (text) {
      return text;
    }
  }
  return null;
}
