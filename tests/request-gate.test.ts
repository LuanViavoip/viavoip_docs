import assert from "node:assert/strict";
import test from "node:test";

test("Nova digitação invalida resposta anterior imediatamente, antes do debounce", async () => {
  const modulePath = "../src/features/search/request-gate";
  const gateModule = await import(modulePath).catch(() => null);
  assert.ok(gateModule, "controle de requisições ausente");
  const gate = gateModule.createRequestGate();
  const first = gate.invalidate();
  const second = gate.invalidate();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(second), false);
});
