import assert from "node:assert/strict";
import test from "node:test";

test("Credenciais administrativas e sessões assinadas são independentes de Profile", async () => {
  const modulePath = "../src/features/admin/core";
  const auth = await import(modulePath).catch(() => null);
  assert.ok(auth, "autenticador administrativo ausente");
  const password = "Only-a-test-password-2026!";
  const hash = await auth.hashAdminPassword(password);
  assert.ok(!hash.includes(password));
  assert.ok(await auth.verifyAdminPassword(password, hash));
  assert.equal(await auth.verifyAdminPassword("wrong", hash), false);
  const config = { passwordHash: hash, sessionSecret: "test-secret-only-".repeat(4) };
  const now = 1_800_000_000;
  const token = auth.createAdminToken(config, now);
  assert.ok(auth.verifyAdminToken(token, config, now));
  assert.equal(auth.verifyAdminToken("admin", config, now), null);
  assert.equal(auth.verifyAdminToken(token + "tampered", config, now), null);
  assert.equal(auth.verifyAdminToken(token, config, now + 8 * 3600), null);
  assert.equal(auth.verifyAdminToken(token, { ...config, sessionSecret: "other-secret".repeat(4) }, now), null);
  assert.equal(auth.verifyAdminToken(token, { ...config, passwordHash: hash + "changed" }, now), null);
});
