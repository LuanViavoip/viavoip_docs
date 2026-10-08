"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileArchiveIcon,
  FileCodeIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyImportAction, cancelImportAction, prepareImportAction, retryCleanupAction } from "@/features/importer/actions";
import { MAX_UPLOAD_BYTES, NEW_SYSTEM_TARGET } from "@/features/importer/constants";
import { normalizeUploadPath, slugify } from "@/features/importer/paths";
import type { ImportNode, ImportPreview } from "@/features/importer/types";
import { cn } from "@/lib/utils";

type UploadMode = "folder" | "zip" | "index";
type SelectedFile = { file: File; path: string };

type ImportWizardProps = { systems: { name: string; slug: string }[] };

export function ImportWizard({ systems }: ImportWizardProps) {
  const [mode, setMode] = useState<UploadMode>("folder");
  const [target, setTarget] = useState(NEW_SYSTEM_TARGET);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [folderFiles, setFolderFiles] = useState<SelectedFile[]>([]);
  const [archive, setArchive] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [activated, setActivated] = useState<{ href: string; cleanupPending: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isNewSystem = target === NEW_SYSTEM_TARGET;
  const uploadBytes =
    mode !== "folder" ? (archive?.size ?? 0) : folderFiles.reduce((total, item) => total + item.file.size, 0);
  const hasSelection = mode !== "folder" ? archive !== null : folderFiles.length > 0;
  const tooLarge = uploadBytes > MAX_UPLOAD_BYTES;

  function handleFolderChange(fileList: FileList | null) {
    const selected = Array.from(fileList ?? []).flatMap((file) => {
      const path = normalizeUploadPath(file.webkitRelativePath || file.name);
      return path ? [{ file, path }] : [];
    });
    setFolderFiles(selected);
    setErrors([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("target", target);
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("description", description);
    if (mode !== "folder" && archive) {
      formData.set("archive", archive);
    } else {
      for (const item of folderFiles) {
        formData.append("files", item.file);
        formData.append("paths", item.path);
      }
    }

    setErrors([]);
    startTransition(async () => {
      try {
        const result = await prepareImportAction(formData);
        if (result.status === "ok") {
          setPreview(result.preview);
        } else {
          setErrors(result.errors);
        }
      } catch {
        setErrors(["Falha ao enviar os arquivos. Verifique o tamanho do envio e tente novamente."]);
      }
    });
  }

  function handleConfirm(stagingId: string) {
    setErrors([]);
    startTransition(async () => {
      try {
        const result = await applyImportAction(stagingId);
        switch (result.status) {
          case "ok":
            if (result.cleanupPending) setActivated(result);
            else router.push(result.href);
            return;
          case "error":
            setErrors([result.message]);
            return;
          default: {
            const unreachable: never = result;
            throw new Error(`Resultado não tratado: ${JSON.stringify(unreachable)}`);
          }
        }
      } catch {
        setErrors(["Falha ao concluir a importação."]);
      }
    });
  }

  function handleCancel(stagingId: string) {
    setPreview(null);
    setErrors([]);
    void cancelImportAction(stagingId).catch(() => setErrors(["Não foi possível cancelar o envio."]));
  }

  if (activated && preview) {
    return <div role="status" className="space-y-4 rounded-lg border p-5">
      <h2 className="font-semibold">Documentação importada e ativa</h2>
      <p>{activated.cleanupPending ? "A ativação foi concluída. A limpeza de arquivos antigos está pendente e pode ser repetida." : "A limpeza foi concluída."}</p>
      <ErrorList errors={errors} />
      <div className="flex gap-2"><Button asChild><Link href={activated.href}>Ver documentação</Link></Button>
        {activated.cleanupPending ? <Button variant="outline" disabled={isPending} onClick={() => startTransition(async () => {
          try {
            const result = await retryCleanupAction(preview.system.slug);
            if (result.status === "ok") { setActivated(result); setErrors([]); }
            else setErrors([result.message]);
          } catch { setErrors(["A sessão pode ter expirado. Entre novamente para repetir a limpeza."]); }
        })}>Repetir limpeza</Button> : null}
      </div>
    </div>;
  }

  if (preview) {
    return (
      <ImportPreviewPanel
        preview={preview}
        errors={errors}
        isPending={isPending}
        onConfirm={() => handleConfirm(preview.stagingId)}
        onCancel={() => handleCancel(preview.stagingId)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">1. Sistema</h2>
        <select
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Sistema de destino"
        >
          <option value={NEW_SYSTEM_TARGET}>Novo sistema</option>
          {systems.map((system) => (
            <option key={system.slug} value={system.slug}>
              Substituir documentação de: {system.name}
            </option>
          ))}
        </select>

        {isNewSystem ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" hint="Opcional se o docs-index.json informar o nome.">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Sol-Maker" />
            </Field>
            <Field label="Identificador na URL" hint={`/docs/${slug || slugify(name) || "..."}`}>
              <Input
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                placeholder={slugify(name) || "gerado a partir do nome"}
              />
            </Field>
          </div>
        ) : null}
        <Field label="Descrição" hint="Opcional.">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">2. Arquivos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de envio">
          <ModeOption
            active={mode === "folder"}
            icon={FolderOpenIcon}
            title="Pasta"
            description="Selecione a pasta da documentação"
            onSelect={() => setMode("folder")}
          />
          <ModeOption
            active={mode === "zip"}
            icon={FileArchiveIcon}
            title="Arquivo .zip"
            description="A documentação compactada"
            onSelect={() => { setArchive(null); setMode("zip"); }}
          />
          <ModeOption active={mode === "index"} icon={FileArchiveIcon} title="Índice JSON"
            description="Referências contentUrl já disponíveis" onSelect={() => { setArchive(null); setMode("index"); }} />
        </div>

        {mode === "folder" ? (
          <input
            key="folder"
            type="file"
            multiple
            ref={(element) => element?.setAttribute("webkitdirectory", "")}
            onChange={(event) => handleFolderChange(event.target.files)}
            className={fileInputClass}
            aria-label="Pasta da documentação"
          />
        ) : (
          <input
            key={mode}
            type="file"
            accept={mode === "zip" ? ".zip,application/zip" : ".json,application/json"}
            onChange={(event) => {
              setArchive(event.target.files?.[0] ?? null);
              setErrors([]);
            }}
            className={fileInputClass}
            aria-label={mode === "zip" ? "Arquivo .zip da documentação" : "Índice JSON provisório"}
          />
        )}

        {hasSelection ? (
          <p className={cn("text-xs", tooLarge ? "text-destructive" : "text-muted-foreground")}>
            {mode === "folder" ? `${folderFiles.length} arquivo(s), ` : ""}
            {formatBytes(uploadBytes)}
            {tooLarge ? ` — acima do limite de ${formatBytes(MAX_UPLOAD_BYTES)}` : ""}
          </p>
        ) : null}
      </section>

      <ErrorList errors={errors} />

      <Button type="submit" disabled={!hasSelection || tooLarge || isPending}>
        {isPending ? <Loader2Icon className="animate-spin" /> : null}
        {isPending ? "Analisando..." : "Analisar e pré-visualizar"}
      </Button>
    </form>
  );
}

const fileInputClass =
  "block w-full cursor-pointer rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground";

type ImportPreviewPanelProps = {
  preview: ImportPreview;
  errors: string[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ImportPreviewPanel({ preview, errors, isPending, onConfirm, onCancel }: ImportPreviewPanelProps) {
  const { system } = preview;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{system.name}</h2>
          <code className="text-xs text-muted-foreground">/docs/{system.slug}</code>
          <Badge variant={system.exists ? "destructive" : "secondary"}>
            {system.exists ? "Substituir" : "Novo sistema"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {preview.documentCount} documento(s) · {preview.htmlCount} HTML(s) · {preview.pdfCount} PDF(s) · {preview.imageCount} imagem(ns) ·
          estrutura definida {preview.source === "index" ? "pelo docs-index.json" : "pelas pastas"}
        </p>
        <p className="mt-2 text-sm">Exemplos: {preview.exampleCount} · Perfis: {preview.profileSlugs.join(", ") || "globais"}</p>
        <p className="mt-2 text-sm">+ {preview.changes.added} documentos · ~ {preview.changes.updated} documentos · − {preview.changes.removed} documentos</p>
        <p className="mt-2 text-xs text-muted-foreground">Warnings: {preview.warnings.length} · Errors: {preview.errors.length} · Import Format — Provisional</p>
        {system.exists ? (
          <p className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            Os {system.currentDocumentCount} documento(s) atuais deste sistema serão substituídos.
          </p>
        ) : null}
      </div>

      {preview.warnings.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          {preview.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-lg border">
        <p className="border-b px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Prévia do índice
        </p>
        <ul className="max-h-[28rem] overflow-y-auto p-2 text-sm" role="tree">
          {preview.tree.map((node) => (
            <PreviewNode key={node.slug} node={node} depth={0} />
          ))}
        </ul>
      </div>

      <ErrorList errors={[...preview.errors, ...errors]} />

      <div className="flex gap-2">
        <Button onClick={onConfirm} disabled={isPending || preview.errors.length > 0}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
          {isPending ? "Importando..." : "Confirmar importação"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function PreviewNode({ node, depth }: { node: ImportNode; depth: number }) {
  const Icon = node.children.length > 0 ? FolderIcon : FileTextIcon;

  return (
    <li role="treeitem" aria-selected={false}>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.title}</span>
        {node.file ? <code className="truncate text-xs text-muted-foreground">{node.file}</code> : null}
        <span className="ml-auto flex shrink-0 gap-1">
          {node.examples.length > 0 ? (
            <Badge variant="outline" className="gap-1">
              <FileCodeIcon className="size-3" />
              {node.examples.length}
            </Badge>
          ) : null}
          {node.profiles.map((profile) => (
            <Badge key={profile} variant="secondary">
              {profile}
            </Badge>
          ))}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul role="group">
          {node.children.map((child) => (
            <PreviewNode key={child.slug} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ModeOption({
  active,
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  active: boolean;
  icon: typeof FolderIcon;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        active ? "border-ring bg-muted/50" : "hover:bg-muted/30",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground/70">{hint}</span> : null}
    </label>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
      {errors.map((error) => (
        <li key={error} className="flex gap-2">
          <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          {error}
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
