import "next/dist/compiled/server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, AdminUnauthorizedError, assertAdminSession, getAdminConfig } from "./core";

/** Fronteira substituível por SSO sem alterar o importador. */
/**
 * Somente para testes locais: `ADMIN_AUTH_DISABLED=true` dispensa a senha do /admin.
 * Ignorado em produção (falha fechada); remover quando houver autenticação real.
 */
const DEV_ADMIN_SESSION = { sid: "00000000-0000-4000-8000-000000000000", issued: 0, exp: Number.MAX_SAFE_INTEGER };

export function isAdminAuthDisabled(): boolean {
  return process.env.ADMIN_AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
}

export async function requireAdmin() {
  if (isAdminAuthDisabled()) return DEV_ADMIN_SESSION;
  let token: string | undefined;
  try { token = (await cookies()).get(ADMIN_COOKIE)?.value; }
  catch { throw new AdminUnauthorizedError(); }
  return assertAdminSession(token, getAdminConfig());
}

export async function requireAdminPage() {
  try { return await requireAdmin(); }
  catch (error) {
    if (error instanceof AdminUnauthorizedError) redirect("/admin/login");
    throw error;
  }
}
