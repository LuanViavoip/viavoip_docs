"use server";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/features/admin/session";

import { applyStagedImport, retryImportCleanup } from "./apply";
import { getImportSnapshot } from "./repository";
import { summarizeImport } from "./preview";
import { prepareImportedNodes, validateImportNodes } from "./prepare";
import { NEW_SYSTEM_TARGET } from "./constants";
import { slugify } from "./paths";
import { buildImportPlan } from "./plan";
import { cleanupExpiredStaging, createStaging, isValidStagingId, readStagedPlan, removeStaging } from "./storage";
import type { ApplyImportResult, ImportSystemTarget, PrepareImportResult } from "./types";
import { readFolderUpload, readZipUpload, UploadError, type Upload } from "./upload";

const formSchema = z.object({
  mode: z.enum(["folder", "zip", "index"]),
  target: z.string().trim().min(1),
  name: z.string().trim().max(120).optional(),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

/**
 * Etapa 1: recebe a pasta ou o .zip enviados pelo navegador, valida, monta a árvore e guarda tudo
 * numa área temporária. Nada é alterado no banco até a confirmação.
 */
export async function prepareImportAction(formData: FormData): Promise<PrepareImportResult> {
  const admin = await requireAdmin();
  const parsed = formSchema.safeParse({
    mode: formData.get("mode"),
    target: formData.get("target"),
    name: formData.get("name") ?? undefined,
    slug: formData.get("slug") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "invalid", errors: ["Formulário inválido."] };
  }
  const form = parsed.data;

  await cleanupExpiredStaging();

  let upload: Upload;
  try {
    upload = await readUpload(form.mode, formData);
  } catch (error) {
    if (error instanceof UploadError) {
      return { status: "invalid", errors: [error.message] };
    }
    throw error;
  }

  const profiles = await prisma.profile.findMany({ select: { slug: true } });
  const plan = buildImportPlan(upload.files, new Set(profiles.map((profile) => profile.slug)), upload.rejectedPaths);

  const targetResult = await resolveTarget(form, plan.indexSystem);
  const errors = [...plan.errors, ...targetResult.errors];
  if (errors.length > 0 || !targetResult.system) {
    return { status: "invalid", errors };
  }
  const system = targetResult.system;
  let tree;
  const knownProfiles = new Set(profiles.map(profile => profile.slug));
  try {
    validateImportNodes(plan.tree, knownProfiles);
    tree = await prepareImportedNodes(plan.tree, async file => {
      const data = plan.storedFiles.get(file);
      if (!data) throw new Error("HTML referenciado não encontrado.");
      return new TextDecoder("utf8").decode(data);
    }, `/content/${system.slug}/preview/`, async file => {
      const data = plan.storedFiles.get(file);
      if (!data) throw new Error("PDF referenciado não encontrado.");
      return data;
    });
  } catch (error) {
    return { status: "invalid", errors: [error instanceof Error ? error.message : "Conteúdo inválido."] };
  }
  const snapshot = await getImportSnapshot(system.slug);
  const summary = summarizeImport(tree, snapshot.documents);

  const stagingId = await createStaging(plan.storedFiles, {
    system: { name: system.name, slug: system.slug, description: system.description },
    source: plan.source,
    tree: plan.tree,
    ownerId: admin.sid,
    baseFingerprint: snapshot.fingerprint,
  });

  return {
    status: "ok",
    preview: {
      stagingId,
      system,
      source: plan.source,
      tree,
      documentCount: plan.documentCount,
      htmlCount: plan.htmlCount,
      pdfCount: plan.pdfCount,
      imageCount: plan.imageCount,
      warnings: plan.warnings,
      errors: [],
      ...summary,
    },
  };
}

/** Etapa 2: aplica a importação confirmada e abre a documentação importada. */
export async function applyImportAction(stagingId: string): Promise<ApplyImportResult> {
  const admin = await requireAdmin();
  const plan = isValidStagingId(stagingId) ? await readStagedPlan(stagingId) : null;
  if (!plan || plan.ownerId !== admin.sid) {
    return { status: "error", message: "Importação não encontrada ou expirada. Envie os arquivos novamente." };
  }

  try {
    const { systemSlug, cleanupPending } = await applyStagedImport(stagingId, admin.sid);
    return { status: "ok", href: `/docs/${systemSlug}`, cleanupPending };
  } catch (error) {
    console.error("Falha ao aplicar importação", error);
    return { status: "error", message: error instanceof Error && /perfil|preview|expirada/i.test(error.message) ? error.message : "A aplicação não foi confirmada. Revise o estado do sistema antes de tentar novamente; os arquivos foram preservados." };
  }
}

export async function cancelImportAction(stagingId: string): Promise<void> {
  const admin = await requireAdmin();
  if (isValidStagingId(stagingId)) {
    const plan = await readStagedPlan(stagingId);
    if (plan?.ownerId === admin.sid) await removeStaging(stagingId);
  }
}

export async function retryCleanupAction(systemSlug: string): Promise<ApplyImportResult> {
  await requireAdmin();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(systemSlug)) return { status: "error", message: "Sistema inválido." };
  try {
    await retryImportCleanup(systemSlug);
    return { status: "ok", href: `/docs/${systemSlug}`, cleanupPending: false };
  } catch {
    return { status: "error", message: "A documentação continua ativa, mas a limpeza ainda está pendente." };
  }
}

async function readUpload(mode: "folder" | "zip" | "index", formData: FormData): Promise<Upload> {
  switch (mode) {
    case "index": {
      const index = formData.get("archive");
      if (!(index instanceof File) || !index.size) throw new UploadError("Selecione o índice JSON provisório.");
      return readFolderUpload([index], ["docs-index.json"]);
    }
    case "zip": {
      const archive = formData.get("archive");
      if (!(archive instanceof File) || archive.size === 0) {
        throw new UploadError("Selecione um arquivo .zip.");
      }
      return readZipUpload(archive);
    }
    case "folder": {
      const files = formData.getAll("files").filter((value): value is File => value instanceof File);
      const paths = formData.getAll("paths").map(String);
      if (files.length === 0) {
        throw new UploadError("Selecione uma pasta com a documentação.");
      }
      return readFolderUpload(files, paths);
    }
    default: {
      const unreachable: never = mode;
      throw new Error(`Modo de envio não tratado: ${String(unreachable)}`);
    }
  }
}

type TargetResult = { system: ImportSystemTarget | null; errors: string[] };

async function resolveTarget(
  form: z.infer<typeof formSchema>,
  indexSystem: { name?: string; description?: string } | undefined,
): Promise<TargetResult> {
  if (form.target !== NEW_SYSTEM_TARGET) {
    const existing = await prisma.system.findUnique({
      where: { slug: form.target },
      include: { _count: { select: { documents: true } } },
    });
    if (!existing) {
      return { system: null, errors: ["O sistema selecionado não existe mais."] };
    }
    return {
      system: {
        name: existing.name,
        slug: existing.slug,
        description: form.description || existing.description,
        exists: true,
        currentDocumentCount: existing._count.documents,
      },
      errors: [],
    };
  }

  const name = form.name || indexSystem?.name;
  if (!name) {
    return { system: null, errors: ["Informe o nome do novo sistema."] };
  }
  const slug = slugify(form.slug || name);
  if (!slug) {
    return { system: null, errors: ["Não foi possível gerar um identificador (slug) válido para o sistema."] };
  }
  if (await prisma.system.findUnique({ where: { slug }, select: { id: true } })) {
    return {
      system: null,
      errors: [`Já existe um sistema com o identificador "${slug}". Selecione-o na lista para substituir a documentação.`],
    };
  }

  return {
    system: {
      name,
      slug,
      description: form.description || indexSystem?.description || null,
      exists: false,
      currentDocumentCount: 0,
    },
    errors: [],
  };
}
