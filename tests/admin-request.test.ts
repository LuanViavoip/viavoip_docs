import assert from "node:assert/strict";
import test from "node:test";
import { workAsyncStorage, type WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import { createRequestStore } from "next/dist/server/async-storage/request-store";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { requireAdmin, requireAdminPage } from "../src/features/admin/session";
import { ADMIN_COOKIE, createAdminToken } from "../src/features/admin/core";
import { loginAdminAction } from "../src/features/admin/actions";
import { hashAdminPassword } from "../src/features/admin/password";
import { prepareImportAction, retryCleanupAction } from "../src/features/importer/actions";

function request<T>(cookie: string, action: () => Promise<T>, onUpdateCookies?: (cookies: string[]) => void) {
  const store = createRequestStore({ phase: "action", headers: new Headers({ cookie }), onUpdateCookies,
    url: { pathname: "/admin/import" }, rootParams: {}, implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    resumeDataCache: null, previewProps: undefined, isHmrRefresh: undefined, serverComponentsHmrCache: undefined,
    hmrRefreshHash: undefined, fallbackParams: undefined });
  // Contexto mínimo de renderização; o request store e cookies são os do Next.
  const work = { route: "/admin/import", isStaticGeneration: false } as WorkStore;
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, action));
}
test("Requisição Next: Profile admin não autentica; sessão válida acessa administração", async () => {
  const previousHash = process.env.ADMIN_PASSWORD_HASH, previousSecret = process.env.ADMIN_SESSION_SECRET;
  const config = { passwordHash: await hashAdminPassword("Test-only-admin-password!"), sessionSecret: "test-only-session-secret-".repeat(3) };
  Object.assign(process.env, { ADMIN_PASSWORD_HASH: config.passwordHash, ADMIN_SESSION_SECRET: config.sessionSecret });
  try {
    await assert.rejects(request("viavoip-docs-profile=admin", requireAdmin), { name: "AdminUnauthorizedError" });
    await assert.rejects(request("viavoip-docs-profile=admin", () => prepareImportAction(new FormData())), { name: "AdminUnauthorizedError" });
    await assert.rejects(request("", () => retryCleanupAction("x")), { name: "AdminUnauthorizedError" });
    await assert.rejects(request("", requireAdminPage), /NEXT_REDIRECT/);
    const form = new FormData(); form.set("password", "Test-only-admin-password!");
    let emitted: string[] = [];
    await assert.rejects(request("", () => loginAdminAction(form), cookies => { emitted = cookies; }), /NEXT_REDIRECT/);
    const sessionCookie = emitted.find(cookie => cookie.startsWith(`${ADMIN_COOKIE}=`));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Strict/i);
    assert.match(sessionCookie, /Path=\/admin/i);
    assert.match(sessionCookie, /Max-Age=28800/i);
    const cookie = `${ADMIN_COOKIE}=${createAdminToken(config)}`;
    assert.ok((await request(cookie, requireAdminPage)).sid);
    assert.deepEqual(await request(cookie, () => prepareImportAction(new FormData())), { status: "invalid", errors: ["Formulário inválido."] });
  } finally {
    if (previousHash === undefined) delete process.env.ADMIN_PASSWORD_HASH; else process.env.ADMIN_PASSWORD_HASH = previousHash;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
