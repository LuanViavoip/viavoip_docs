import path from "node:path";
import { z } from "zod";
import { IMAGE_CONTENT_TYPES, PDF_CONTENT_TYPE, PDF_EXTENSION } from "./constants";
import type { ImportNode, ImportStructureSource, ImportSystemTarget } from "./types";

export type StagedPlan = {
  createdAt: number;
  ownerId: string;
  baseFingerprint: string;
  system: Pick<ImportSystemTarget, "name" | "slug" | "description">;
  source: ImportStructureSource;
  tree: ImportNode[];
};
const nodeSchema: z.ZodType<ImportNode> = z.lazy(() => z.object({
  title: z.string().min(1).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.string().nullable(), file: z.string().nullable(), contentUrl: z.string().nullable().optional(),
  searchableContent: z.string().nullable().optional(), profiles: z.array(z.string()),
  examples: z.array(z.object({ title: z.string(), language: z.string().nullable(), content: z.string() })),
  children: z.array(nodeSchema),
}));
export const planSchema = z.object({
  createdAt: z.number().int(), ownerId: z.uuid(), baseFingerprint: z.string(),
  system: z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable() }),
  source: z.enum(["index", "folders"]), tree: z.array(nodeSchema).min(1),
});
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isValidStagingId(value: unknown): value is string { return typeof value === "string" && ID_PATTERN.test(value); }

/** Tipos servidos pela aplicação (HTML lido pela camada de conteúdo; imagens e PDFs pela rota). Outros arquivos não vão ao bucket. */
export function publishedContentType(relative: string): string | null {
  const extension = path.extname(relative).toLowerCase();
  if (extension === ".html" || extension === ".htm") return "text/html";
  if (extension === PDF_EXTENSION) return PDF_CONTENT_TYPE;
  return IMAGE_CONTENT_TYPES[extension] ?? null;
}
