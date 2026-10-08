import { open, stat } from "node:fs/promises";
import path from "node:path";

import { IMPORTED_CONTENT_PREFIX, resolveInside, SYSTEMS_STORAGE_DIR } from "./paths";
import { isRemoteStorageEnabled, remoteRead, remoteStat, resolveKey } from "./remote";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const DEMO_PREFIX = "/demo-docs/";

/** Arquivo de conteúdo: no filesystem local ou no bucket privado do Supabase Storage. */
export type ContentFile = { kind: "fs"; path: string } | { kind: "remote"; key: string };

/**
 * Resolve um caminho de conteúdo (`/content/...` importado ou `/demo-docs/...`) para sua origem,
 * confinando o resultado ao diretório/prefixo correspondente. Retorna `null` para caminhos que escapam.
 * Com `CONTENT_STORAGE=supabase`, importados e demos vêm do bucket; o restante de `public/` segue local.
 */
export function locateContentFile(pathname: string): ContentFile | null {
  const remote = isRemoteStorageEnabled();
  if (pathname.startsWith(IMPORTED_CONTENT_PREFIX)) {
    const relative = pathname.slice(IMPORTED_CONTENT_PREFIX.length);
    if (remote) {
      const key = resolveKey("systems", relative);
      return key ? { kind: "remote", key } : null;
    }
    const filePath = resolveInside(SYSTEMS_STORAGE_DIR, relative);
    return filePath ? { kind: "fs", path: filePath } : null;
  }
  if (remote && pathname.startsWith(DEMO_PREFIX)) {
    const key = resolveKey("demo-docs", pathname.slice(DEMO_PREFIX.length));
    return key ? { kind: "remote", key } : null;
  }
  const filePath = resolveInside(PUBLIC_DIR, `.${pathname}`);
  return filePath ? { kind: "fs", path: filePath } : null;
}

export function contentFileExtension(file: ContentFile): string {
  return path.extname(file.kind === "fs" ? file.path : file.key).toLowerCase();
}

/** Tamanho do arquivo, ou `null` se não existir (ou não for arquivo regular). */
export async function statContentFile(file: ContentFile): Promise<{ size: number } | null> {
  if (file.kind === "remote") return remoteStat(file.key);
  try {
    const info = await stat(file.path);
    return info.isFile() ? { size: info.size } : null;
  } catch {
    return null;
  }
}

/** Lê o arquivo inteiro ou o intervalo `[start, end]` (inclusivo). */
export async function readContentFile(file: ContentFile, range?: { start: number; end: number }): Promise<Uint8Array<ArrayBuffer>> {
  if (file.kind === "remote") {
    const data = await remoteRead(file.key, range);
    return new Uint8Array(data);
  }
  if (!range) {
    const handle = await open(file.path, "r");
    try {
      const { size } = await handle.stat();
      return await readRange(handle, 0, size - 1);
    } finally {
      await handle.close();
    }
  }
  const handle = await open(file.path, "r");
  try {
    return await readRange(handle, range.start, range.end);
  } finally {
    await handle.close();
  }
}

async function readRange(handle: Awaited<ReturnType<typeof open>>, start: number, end: number): Promise<Uint8Array<ArrayBuffer>> {
  const length = Math.max(end - start + 1, 0);
  const buffer = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, start + offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset === length ? buffer : buffer.slice(0, offset);
}
