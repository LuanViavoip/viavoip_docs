import assert from "node:assert/strict";
import test from "node:test";
import { prepareImportAction, applyImportAction, cancelImportAction } from "../src/features/importer/actions";

test("Server Actions recusam visitante antes de tocar banco/arquivos, mesmo com Profile=admin", async () => {
  // Não há contexto de sessão administrativa; perfil não participa da autorização.
  for (const action of [() => prepareImportAction(new FormData()), () => applyImportAction("invalid"), () => cancelImportAction("invalid")]) {
    await assert.rejects(action, error => error instanceof Error && error.name === "AdminUnauthorizedError");
  }
});
