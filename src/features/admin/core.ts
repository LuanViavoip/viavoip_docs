import "next/dist/compiled/server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
export const ADMIN_COOKIE = "viavoip-admin-session";
export type AdminConfig = { passwordHash: string; sessionSecret: string };
export type AdminSession = { sid: string; issued: number; exp: number };
const sessionSchema = z.object({ sid: z.uuid(), issued: z.number().int(), exp: z.number().int() }).strict();
export { hashAdminPassword, verifyAdminPassword } from "./password";
import { hashPattern } from "./password";

export function getAdminConfig(): AdminConfig | null {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  return passwordHash && hashPattern.test(passwordHash) && sessionSecret && Buffer.byteLength(sessionSecret) >= 32
    ? { passwordHash, sessionSecret } : null;
}

function signature(payload: string, config: AdminConfig): Buffer {
  const key = createHmac("sha256", config.sessionSecret).update(config.passwordHash).digest();
  return createHmac("sha256", key).update(`viavoip-admin-v1.${payload}`).digest();
}

export function createAdminToken(config: AdminConfig, now = Math.floor(Date.now() / 1000)): string {
  const payload = Buffer.from(JSON.stringify({ sid: randomUUID(), issued: now, exp: now + ADMIN_SESSION_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}

export function verifyAdminToken(token: string | undefined, config: AdminConfig, now = Math.floor(Date.now() / 1000)): AdminSession | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, encodedSignature] = parts;
  const supplied = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, config);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    const session = parsed.data;
    return session.issued <= now && session.exp > now && session.exp - session.issued === ADMIN_SESSION_SECONDS ? session : null;
  } catch { return null; }
}

export class AdminUnauthorizedError extends Error {
  constructor() { super("Autenticação administrativa necessária."); this.name = "AdminUnauthorizedError"; }
}

export function assertAdminSession(token: string | undefined, config: AdminConfig | null): AdminSession {
  const session = config ? verifyAdminToken(token, config) : null;
  if (!session) throw new AdminUnauthorizedError();
  return session;
}
