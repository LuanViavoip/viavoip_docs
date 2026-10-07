import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAdminAction } from "@/features/admin/actions";
import { getAdminConfig } from "@/features/admin/core";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  const configured = Boolean(getAdminConfig());
  return <div className="min-h-svh"><AppHeader /><main className="mx-auto max-w-sm space-y-6 px-4 py-16">
    <h1 className="text-2xl font-semibold">Acesso administrativo</h1>
    <p className="text-sm text-muted-foreground">Acesso separado dos perfis de consulta da documentação.</p>
    {!configured ? <p role="alert">A administração ainda não foi configurada. Contate o responsável pelo sistema.</p> : <form action={loginAdminAction} className="space-y-4">
      <label className="block space-y-2"><span>Senha administrativa</span><Input name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>
      {error ? <p role="alert" className="text-sm text-destructive">{error === "rate" ? "Muitas tentativas. Aguarde um minuto e tente novamente." : "Não foi possível autenticar. Verifique a credencial."}</p> : null}
      <Button type="submit">Entrar</Button>
    </form>}
  </main></div>;
}
