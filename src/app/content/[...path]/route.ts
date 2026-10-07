import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { IMAGE_CONTENT_TYPES } from "@/features/importer/constants";
import { resolveInside, SYSTEMS_STORAGE_DIR } from "@/lib/storage/paths";

/**
 * Serve apenas IMAGENS da documentação importada (referenciadas pelos HTMLs).
 * O HTML importado nunca é servido cru: ele só chega ao navegador pela camada de conteúdo,
 * já sanitizado.
 */
export async function GET(_request: Request, ctx: RouteContext<"/content/[...path]">) {
  const { path: segments } = await ctx.params;
  const filePath = resolveInside(SYSTEMS_STORAGE_DIR, segments.join("/"));
  const contentType = filePath ? IMAGE_CONTENT_TYPES[path.extname(filePath).toLowerCase()] : undefined;

  if (!filePath || !contentType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    if (!(await stat(filePath)).isFile()) {
      return new Response("Not found", { status: 404 });
    }
    const body = await readFile(filePath);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // SVG pode conter scripts: se aberto diretamente, nada é executado.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
