import { InfoIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { selectProfileAction } from "@/features/profiles/actions";
import { getCurrentProfile, listProfiles } from "@/features/profiles/queries";
import { safeInternalPath } from "@/lib/validation/redirect";

export const metadata: Metadata = { title: "Escolha seu perfil" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const { next } = await searchParams;
  const redirectTo = safeInternalPath(next);
  const [profiles, currentProfile] = await Promise.all([listProfiles(), getCurrentProfile()]);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Qual é o seu perfil?</h1>
            <p className="text-sm text-muted-foreground">
              A documentação exibida será adaptada ao perfil escolhido. Você pode alterá-lo depois pelo topo da
              página.
            </p>
          </div>

          {profiles.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Nenhum perfil cadastrado"
              description={
                <>
                  Rode <code>pnpm db:seed</code> para criar os perfis demonstrativos.
                </>
              }
              className="rounded-lg border border-dashed"
            />
          ) : (
            <form action={selectProfileAction} className="grid gap-2">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              {profiles.map((profile) => (
                <Button
                  key={profile.id}
                  type="submit"
                  name="profileSlug"
                  value={profile.slug}
                  variant={profile.slug === currentProfile?.slug ? "default" : "outline"}
                  size="lg"
                  className="h-11 justify-start px-4 text-sm"
                >
                  {profile.name}
                  {profile.slug === currentProfile?.slug ? (
                    <span className="ml-auto text-xs opacity-70">atual</span>
                  ) : null}
                </Button>
              ))}
            </form>
          )}

          <p className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            Os perfis são demonstrativos e servem apenas para filtrar a documentação. Eles não são um mecanismo de
            segurança ou controle de acesso.
          </p>
        </div>
      </main>
    </div>
  );
}
