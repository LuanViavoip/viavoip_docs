/** Tipos compartilhados entre o servidor e a interface do importador (sem dependências de servidor). */

export type ImportExample = {
  title: string;
  language: string | null;
  content: string;
};

/** Nó da árvore a importar (já normalizado, independente da origem: índice ou pastas). */
export type ImportNode = {
  title: string;
  slug: string;
  type: string | null;
  /** Caminho do HTML dentro do envio (ex.: "api/clientes.html"); `null` para nós estruturais. */
  file: string | null;
  /** Referência a HTML já disponível, sem exigir o envio do arquivo. */
  contentUrl?: string | null;
  searchableContent?: string | null;
  profiles: string[];
  examples: ImportExample[];
  children: ImportNode[];
};

export type ImportStructureSource = "index" | "folders";

export type ImportSystemTarget = {
  name: string;
  slug: string;
  description: string | null;
  /** Já existe um sistema com esse slug (a documentação dele será substituída). */
  exists: boolean;
  currentDocumentCount: number;
};

export type ImportPreview = {
  stagingId: string;
  system: ImportSystemTarget;
  source: ImportStructureSource;
  tree: ImportNode[];
  documentCount: number;
  htmlCount: number;
  imageCount: number;
  warnings: string[];
  errors: string[];
  exampleCount: number;
  profileSlugs: string[];
  changes: { added: number; updated: number; removed: number };
};

export type PrepareImportResult =
  | { status: "ok"; preview: ImportPreview }
  | { status: "invalid"; errors: string[] };

export type ApplyImportResult = { status: "ok"; href: string; cleanupPending: boolean } | { status: "error"; message: string };
