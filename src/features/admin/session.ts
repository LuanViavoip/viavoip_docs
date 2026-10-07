import "next/dist/compiled/server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, AdminUnauthorizedError, assertAdminSession, getAdminConfig } from "./core";

/** Fronteira substituível por SSO sem alterar o importador. */
export async function requireAdmin() {
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
