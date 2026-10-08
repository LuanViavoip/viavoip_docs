import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_CONTENT_TYPES, PDF_CONTENT_TYPE, PDF_EXTENSION } from "../src/features/importer/constants";
import { SYSTEMS_STORAGE_DIR } from "../src/lib/storage/paths";

/**
 * Copia os arquivos locais para o bucket privado do Supabase Storage:
 *   <STORAGE_DIR>/systems/**  →  systems/**
 *   public/demo-docs/**       →  demo-docs/**
 * Sem `--apply` apenas lista o que seria enviado. Idempotente (upsert). Não apaga nada, local ou remoto.
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (lidos de .env.local); nunca imprime valores.
 */
try { process.loadEnvFile(".env.local"); } catch { /* variáveis podem vir do ambiente */ }
process.env.CONTENT_STORAGE = "supabase";

const apply = process.argv.includes("--apply");

function contentType(file: string): string | null {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".html" || extension === ".htm") return "text/html";
  if (extension === PDF_EXTENSION) return PDF_CONTENT_TYPE;
  return IMAGE_CONTENT_TYPES[extension] ?? null;
}

async function walk(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function main() {
  const { remoteUpload, resolveKey } = await import("../src/lib/storage/remote");
  if (apply && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (em .env.local ou no ambiente).");
  }
  const sources = [
    { root: SYSTEMS_STORAGE_DIR, prefix: "systems" },
    { root: path.join(process.cwd(), "public", "demo-docs"), prefix: "demo-docs" },
  ];
  let sent = 0;
  let skipped = 0;
  for (const { root, prefix } of sources) {
    for (const file of await walk(root)) {
      const type = contentType(file);
      if (!type) { skipped++; console.log(`ignorado (tipo não publicado): ${prefix}/${file}`); continue; }
      console.log(`${apply ? "enviando" : "enviaria"}: ${prefix}/${file}`);
      const key = resolveKey(prefix, file);
      if (!key) { skipped++; console.log(`ignorado (caminho inválido): ${prefix}/${file}`); continue; }
      if (apply) await remoteUpload(key, new Uint8Array(await readFile(path.join(root, file))), type, true);
      sent++;
    }
  }
  console.log(`${apply ? "Enviados" : "A enviar"}: ${sent}; ignorados: ${skipped}.${apply ? "" : " Rode com --apply para enviar."}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
