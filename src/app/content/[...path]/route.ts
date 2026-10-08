import { IMAGE_CONTENT_TYPES, PDF_CONTENT_TYPE, PDF_EXTENSION } from "@/features/importer/constants";
import { contentFileExtension, locateContentFile, readContentFile, statContentFile } from "@/lib/storage/files";
import { IMPORTED_CONTENT_PREFIX } from "@/lib/storage/paths";

/**
 * Serve apenas IMAGENS e PDFs da documentação importada (filesystem local ou bucket privado do
 * Supabase Storage, conforme `CONTENT_STORAGE`). O navegador nunca acessa o bucket diretamente.
 * O HTML importado nunca é servido cru: ele só chega ao navegador pela camada de conteúdo,
 * já sanitizado.
 */
export async function GET(request: Request, ctx: RouteContext<"/content/[...path]">) {
  const { path: segments } = await ctx.params;
  const file = locateContentFile(`${IMPORTED_CONTENT_PREFIX}${segments.join("/")}`);
  const extension = file ? contentFileExtension(file) : "";
  const isPdf = extension === PDF_EXTENSION;
  const contentType = isPdf ? PDF_CONTENT_TYPE : IMAGE_CONTENT_TYPES[extension];

  if (!file || !contentType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await statContentFile(file);
    if (!info) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG pode conter scripts: se aberto diretamente, nada é executado. O `sandbox` impediria o
      // visualizador de PDF do navegador, então PDFs só restringem quem pode incorporá-los.
      "Content-Security-Policy": isPdf ? "frame-ancestors 'self'" : "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    if (!isPdf) {
      return new Response(await readContentFile(file), { headers });
    }

    // Visualizadores de PDF pedem trechos do arquivo para abrir documentos grandes sem baixá-los inteiros.
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Disposition", "inline");
    const range = parseRange(request.headers.get("range"), info.size);
    if (range === "invalid") {
      headers.set("Content-Range", `bytes */${info.size}`);
      return new Response(null, { status: 416, headers });
    }
    if (!range) {
      return new Response(await readContentFile(file), { headers });
    }
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
    return new Response(await readContentFile(file, range), { status: 206, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

type ByteRange = { start: number; end: number };

/** Aceita um único intervalo ("bytes=0-99", "bytes=100-", "bytes=-50"); outros formatos são ignorados. */
function parseRange(header: string | null, size: number): ByteRange | "invalid" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (!match[1] && !match[2])) {
    return null;
  }
  if (!match[1]) {
    const suffix = Number(match[2]);
    return suffix > 0 && size > 0 ? { start: Math.max(size - suffix, 0), end: size - 1 } : "invalid";
  }
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : "invalid";
}
