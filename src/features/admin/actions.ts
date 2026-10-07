"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, getAdminConfig, verifyAdminPassword } from "./core";

// Limite global por processo, independente de cabeçalhos manipuláveis de IP.
const attempts = { started: 0, count: 0, busy: false };
export async function loginAdminAction(form: FormData): Promise<void> {
  const config = getAdminConfig();
  const password = form.get("password");
  const now = Date.now();
  if (now - attempts.started >= 60_000) { attempts.started = now; attempts.count = 0; }
  if (!config || typeof password !== "string" || !password || password.length > 1024) redirect("/admin/login?error=credentials");
  if (attempts.busy || attempts.count >= 5) redirect("/admin/login?error=rate");
  attempts.count++;
  attempts.busy = true;
  let valid = false;
  try { valid = await verifyAdminPassword(password, config.passwordHash); }
  finally { attempts.busy = false; }
  if (!valid) redirect("/admin/login?error=credentials");
  (await cookies()).set(ADMIN_COOKIE, createAdminToken(config), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/admin", maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/admin");
}
export async function logoutAdminAction(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}
