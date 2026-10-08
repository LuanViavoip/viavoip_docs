import { contentUrlKey } from "./urls";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** O documento é um PDF quando o seu `contentUrl` (ou arquivo) termina em ".pdf". */
export function isPdfPath(value: string): boolean {
  return /\.pdf$/i.test(contentUrlKey(value).split("?")[0]);
}

export function hasPdfSignature(data: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, index) => data[index] === byte);
}

/**
 * Texto puro do PDF, com espaços normalizados, para `Document.searchableContent`.
 * PDFs digitalizados (apenas imagens) devolvem texto vazio: não há OCR.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // A biblioteca transfere o buffer recebido; a cópia preserva os bytes de quem chamou.
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  // Fontes sem mapeamento Unicode produzem caracteres de controle (inclusive NUL, que o PostgreSQL recusa).
  return text.replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, " ").replace(/\s+/g, " ").trim();
}
