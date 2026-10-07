import { ArrowRightIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/layout/empty-state";
import { ImportButton } from "@/components/layout/import-button";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentProfile } from "@/features/profiles/queries";
import { listSystems } from "@/features/systems/queries";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/profile?next=/");
  }
  const systems = await listSystems();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader redirectTo="/" showImport={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Documentação interna</h1>
            <p className="text-muted-foreground">
              Selecione um sistema para navegar. Exibindo conteúdo para o perfil{" "}
              <span className="font-medium text-foreground">{profile.name}</span>.
            </p>
          </div>
          <ImportButton variant="default" size="default" alwaysShowLabel />
        </div>

        {systems.length === 0 ? (
          <EmptyState
            icon={DatabaseIcon}
            title="Nenhum sistema cadastrado"
            description="Importe a documentação de um sistema a partir de uma pasta ou de um arquivo .zip."
            action={<ImportButton variant="default" size="default" alwaysShowLabel />}
            className="rounded-lg border border-dashed"
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {systems.map((system) => (
              <li key={system.id}>
                <Link
                  href={`/docs/${system.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20"
                >
                  <span className="flex items-center justify-between font-medium">
                    {system.name}
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  {system.description ? (
                    <span className="text-sm text-muted-foreground">{system.description}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
