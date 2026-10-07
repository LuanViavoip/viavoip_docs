import path from "node:path";

/**
 * Diretório de dados da aplicação (fora de `public/`). Guarda os arquivos importados e a área
 * temporária de importação. Configurável por `STORAGE_DIR`.
 */
export const STORAGE_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"),
);

/** Documentação importada: `<STORAGE_DIR>/systems/<systemSlug>/<importId>/...`. */
export const SYSTEMS_STORAGE_DIR = path.join(STORAGE_DIR, "systems");

/** Uploads aguardando confirmação: `<STORAGE_DIR>/staging/<stagingId>/...`. */
export const STAGING_STORAGE_DIR = path.join(STORAGE_DIR, "staging");

/** Prefixo dos `contentUrl` (e das URLs de imagens) de documentação importada. */
export const IMPORTED_CONTENT_PREFIX = "/content/";

/**
 * Junta `relativePath` a `baseDir`, garantindo que o resultado continue dentro de `baseDir`.
 * Retorna `null` para caminhos que tentam escapar do diretório.
 */
export function resolveInside(baseDir: string, relativePath: string): string | null {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved.startsWith(baseDir + path.sep) ? resolved : null;
}
