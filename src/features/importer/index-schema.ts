import { z } from "zod";

import { MAX_EXAMPLE_BYTES } from "./constants";

/**
 * Formato PROVISÓRIO do arquivo `docs-index.json`. Será substituído pelo contrato oficial
 * quando recebermos os índices reais (ROADMAP, Fase 3). Exemplo:
 *
 * {
 *   "system": { "name": "Sol-Maker", "description": "..." },
 *   "documents": [
 *     { "title": "Introdução", "file": "index.html" },
 *     { "title": "APIs", "type": "module", "profiles": ["developer"], "children": [
 *       { "file": "api/clientes.html", "examples": [
 *         { "title": "Consultar", "language": "javascript", "file": "exemplos/consultar.js" }
 *       ] }
 *     ] }
 *   ]
 * }
 */

const exampleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    language: z.string().trim().min(1).max(40).optional(),
    content: z.string().max(MAX_EXAMPLE_BYTES).optional(),
    file: z.string().trim().min(1).optional(),
  })
  .refine((example) => example.content !== undefined || example.file !== undefined, {
    message: 'informe "content" ou "file" no exemplo',
  });

export type DocsIndexExample = z.infer<typeof exampleSchema>;

export type DocsIndexDocument = {
  title?: string;
  slug?: string;
  type?: string;
  file?: string;
  contentUrl?: string;
  profiles?: string[];
  examples?: DocsIndexExample[];
  children?: DocsIndexDocument[];
};

const documentSchema: z.ZodType<DocsIndexDocument> = z.lazy(() =>
  z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      slug: z.string().trim().min(1).max(80).optional(),
      type: z.string().trim().min(1).max(40).optional(),
      file: z.string().trim().min(1).optional(),
      contentUrl: z.string().trim().min(1).max(2048).optional(),
      profiles: z.array(z.string().trim().min(1)).optional(),
      examples: z.array(exampleSchema).optional(),
      children: z.array(documentSchema).optional(),
    })
    .refine((document) => document.title !== undefined || document.file !== undefined, {
      message: 'informe "title" ou "file" no documento',
    })
    .refine(document => !(document.file && document.contentUrl), { message: 'use "file" ou "contentUrl", nunca ambos' }),
);

export const docsIndexSchema = z.object({
  system: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(500).optional(),
    })
    .optional(),
  documents: z.array(documentSchema).min(1, "o índice precisa ter ao menos um documento"),
});

export type DocsIndex = z.infer<typeof docsIndexSchema>;
