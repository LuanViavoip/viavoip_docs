import { ArrowRightIcon, SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { requireAdminPage } from "@/features/admin/session";
import { logoutAdminAction } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Administração" };

const PLANNED_SECTIONS = [
  { title: "Sistemas", description: "Cadastro e organização dos sistemas documentados." },
  { title: "Documentos", description: "Estrutura do índice, perfis e exemplos laterais." },
  { title: "Perfis", description: "Perfis de visualização e associação com documentos." },
  { title: "Versões", description: "Histórico e versões da documentação." },
  { title: "Configurações", description: "Origens de HTML permitidas, indexação e preferências." },
];

export default async function AdminPage() {
  await requireAdminPage();
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader redirectTo="/admin" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        <form action={logoutAdminAction} className="mb-4 flex justify-end"><Button variant="outline" type="submit">Sair da administração</Button></form>
        <div className="mb-8 flex items-start gap-4">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
            <SettingsIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Administração do ViaVOIP Docs</h1>
            <p className="text-sm text-muted-foreground">
              Área em construção. Por enquanto, apenas a importação de documentação está disponível.
            </p>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/admin/import"
              className="group flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-ring hover:bg-muted/30"
            >
              <p className="flex items-center justify-between font-medium">
                Importar documentação
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="text-sm text-muted-foreground">
                Envie uma pasta ou um .zip com os HTMLs do seu computador.
              </p>
              <p className="mt-2 text-xs text-(--link)">Disponível (provisório)</p>
            </Link>
          </li>
          {PLANNED_SECTIONS.map((section) => (
            <li key={section.title} className="rounded-lg border border-dashed p-4">
              <p className="font-medium">{section.title}</p>
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <p className="mt-2 text-xs text-muted-foreground/70">Planejado</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
