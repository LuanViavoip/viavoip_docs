import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ImportWizard } from "@/components/admin/import-wizard";
import { SiteHeader } from "@/components/layout/site-header";
import { INDEX_FILE_NAME } from "@/features/importer/constants";
import { listProfiles } from "@/features/profiles/queries";
import { listSystems } from "@/features/systems/queries";
import { requireAdminPage } from "@/features/admin/session";

export const metadata: Metadata = { title: "Importar documentação" };

export default async function ImportPage() {
  await requireAdminPage();
  const [systems, profiles] = await Promise.all([listSystems(), listProfiles()]);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader redirectTo="/admin/import" showImport={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Administração
        </Link>

        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Importar documentação</h1>
          <p className="text-sm text-muted-foreground">
            Envie a documentação que está no seu computador (uma pasta ou um arquivo .zip com os HTMLs e imagens).
            Antes de gravar, você verá uma prévia da árvore que será criada.
          </p>
        </div>

        <ImportWizard systems={systems.map(({ name, slug }) => ({ name, slug }))} />

        <details className="mt-10 rounded-lg border bg-muted/20 p-4 text-sm">
          <summary className="cursor-pointer font-medium">Como a estrutura é montada</summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Sem índice:</strong> cada pasta vira uma seção e cada HTML vira um
              documento. O <code>index.html</code> de uma pasta é o conteúdo da própria seção. O título vem do{" "}
              <code>&lt;title&gt;</code> ou do primeiro <code>&lt;h1&gt;</code>. Prefixos numéricos (
              <code>01-introducao.html</code>) definem a ordem.
            </p>
            <p>
              <strong className="text-foreground">Com índice:</strong> se a raiz tiver um <code>{INDEX_FILE_NAME}</code>,
              ele define títulos, ordem, perfis e exemplos de código. Formato provisório:
            </p>
            <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
              {`{
  "system": { "name": "Sol-Maker", "description": "Opcional" },
  "documents": [
    { "title": "Introdução", "file": "index.html" },
    { "title": "APIs", "type": "module", "profiles": ["developer"],
      "children": [
        { "file": "api/clientes.html",
          "examples": [
            { "title": "Consultar", "language": "javascript", "file": "exemplos/consultar.js" }
          ] }
      ] }
  ]
}`}
            </pre>
            <p>
              Perfis disponíveis: {profiles.map((profile) => <code key={profile.id} className="mr-1">{profile.slug}</code>)}
              . Documentos sem perfis ficam visíveis para todos.
            </p>
          </div>
        </details>

        <p className="mt-4 flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
          Importação provisória: o formato oficial do índice ainda será definido com base nos exemplos reais. Esta área
          exige uma sessão administrativa válida. O perfil de documentação não concede acesso administrativo.
        </p>
      </main>
    </div>
  );
}
