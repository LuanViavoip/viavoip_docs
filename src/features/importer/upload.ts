import { unzipSync } from "fflate";

import { MAX_EXTRACTED_BYTES, MAX_FILES, MAX_UPLOAD_BYTES } from "./constants";
import { isUnsafeUploadPath, normalizeUploadPath, stripCommonRoot } from "./paths";

/** Arquivos do envio, indexados pelo caminho relativo normalizado. */
export type UploadedFiles = Map<string, Uint8Array>;

/** Resultado da leitura do envio: arquivos aceitos e caminhos recusados por serem inseguros. */
export type Upload = { files: UploadedFiles; rejectedPaths: string[] };

export class UploadError extends Error {}

type RawEntry = { path: string; data: Uint8Array };

/** Envio de pasta: cada arquivo com o seu caminho relativo (enviado separadamente pelo navegador). */
export async function readFolderUpload(files: File[], paths: string[]): Promise<Upload> {
  if (files.length !== paths.length) {
    throw new UploadError("Envio inconsistente: lista de arquivos e caminhos não conferem.");
  }
  assertTotalSize(files.reduce((total, file) => total + file.size, 0));

  const entries: RawEntry[] = [];
  for (const [index, file] of files.entries()) {
    entries.push({ path: paths[index], data: new Uint8Array(await file.arrayBuffer()) });
  }
  return toUploadedFiles(entries);
}

/** Envio de .zip: extraído em memória, com limites de quantidade e de tamanho. */
export async function readZipUpload(archive: File): Promise<Upload> {
  assertTotalSize(archive.size);

  let declaredBytes = 0;
  let declaredFiles = 0;
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(new Uint8Array(await archive.arrayBuffer()), {
      filter: (file) => {
        if (file.name.endsWith("/")) {
          return false;
        }
        declaredFiles += 1;
        declaredBytes += file.originalSize;
        if (declaredFiles > MAX_FILES || declaredBytes > MAX_EXTRACTED_BYTES) {
          throw new UploadError("O .zip excede o limite de arquivos ou de tamanho descompactado.");
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }
    throw new UploadError("Não foi possível ler o arquivo .zip (arquivo inválido ou corrompido).");
  }

  const entries = Object.entries(extracted).map(([path, data]) => ({ path, data }));
  const extractedBytes = entries.reduce((total, entry) => total + entry.data.byteLength, 0);
  if (extractedBytes > MAX_EXTRACTED_BYTES) {
    throw new UploadError("O .zip excede o limite de tamanho descompactado.");
  }
  return toUploadedFiles(entries);
}

function assertTotalSize(bytes: number) {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new UploadError(`O envio excede o limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }
}

function toUploadedFiles(entries: RawEntry[]): Upload {
  // Caminhos inseguros nunca são gravados, mas são reportados em vez de sumirem do envio.
  const rejectedPaths = entries.filter((entry) => isUnsafeUploadPath(entry.path)).map((entry) => entry.path);
  const valid = entries
    .map((entry) => ({ ...entry, path: normalizeUploadPath(entry.path) }))
    .filter((entry): entry is RawEntry => entry.path !== null);

  if (valid.length === 0) {
    throw new UploadError(
      rejectedPaths.length > 0
        ? `Nenhum arquivo válido foi enviado: ${rejectedPaths.length} arquivo(s) recusado(s) por caminho inseguro.`
        : "Nenhum arquivo válido foi enviado.",
    );
  }
  if (valid.length > MAX_FILES) {
    throw new UploadError(`O envio excede o limite de ${MAX_FILES} arquivos.`);
  }

  const { paths } = stripCommonRoot(valid.map((entry) => entry.path));
  if (new Set(paths).size !== paths.length) throw new UploadError("Arquivos com caminhos duplicados no envio.");
  return { files: new Map(valid.map((entry, index) => [paths[index], entry.data])), rejectedPaths };
}
