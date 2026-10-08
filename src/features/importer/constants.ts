/** Valor do seletor de destino que indica "criar um novo sistema". */
export const NEW_SYSTEM_TARGET = "__new__";

/** Nome do arquivo de índice opcional na raiz do envio (formato PROVISÓRIO). */
export const INDEX_FILE_NAME = "docs-index.json";

/** Limite do envio inteiro (pasta ou .zip). `next.config.ts` usa uma folga acima disso. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Limite da soma dos arquivos extraídos de um .zip (proteção contra "zip bomb"). */
export const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
export const MAX_FILES = 3000;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_EXAMPLE_BYTES = 200 * 1024;
export const MAX_INDEX_BYTES = 2 * 1024 * 1024;

/** Uploads não confirmados são descartados depois desse tempo. */
export const STAGING_TTL_MS = 60 * 60 * 1000;

export const HTML_EXTENSIONS = new Set([".html", ".htm"]);
export const PDF_EXTENSION = ".pdf";
export const PDF_CONTENT_TYPE = "application/pdf";
/** Arquivos que podem ser o conteúdo de um documento da árvore. */
export const PAGE_FILE_PATTERN = /\.(?:html?|pdf)$/i;

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Pastas/arquivos ignorados no envio (lixo de sistema operacional, controle de versão, etc.). */
export const IGNORED_SEGMENTS = new Set(["__MACOSX", ".git", "node_modules", ".DS_Store", "Thumbs.db"]);
