import assert from "node:assert/strict";
import test from "node:test";

import { claimStaging, createStaging, finishClaim, promoteClaimedStaging, readClaimedHtml, readStagedPlan, removeOtherImports, removeStaging, restoreClaim } from "../src/features/importer/storage";
import { locateContentFile, readContentFile, statContentFile } from "../src/lib/storage/files";

/** Storage do Supabase em memória (apenas os endpoints usados pelo cliente). */
function fakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const route = url.pathname.replace("/storage/v1", "");
    const method = init?.method ?? "GET";
    const key = (prefix: string) => decodeURIComponent(route.slice(prefix.length));
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (route.startsWith("/object/authenticated/")) {
      const data = objects.get(key("/object/authenticated/viavoip-docs/"));
      if (!data) return new Response("{}", { status: 404 });
      const range = new Headers(init?.headers).get("range")?.match(/bytes=(\d+)-(\d+)/);
      if (method === "HEAD") return new Response(null, { headers: { "content-length": String(data.byteLength) } });
      return range ? new Response(new Uint8Array(data.slice(Number(range[1]), Number(range[2]) + 1)), { status: 206 }) : new Response(new Uint8Array(data));
    }
    if (route === "/object/list/viavoip-docs") {
      const { prefix } = JSON.parse(String(init?.body)) as { prefix: string };
      const names = new Map<string, boolean>();
      for (const k of objects.keys()) if (k.startsWith(`${prefix}/`)) {
        const [head, ...rest] = k.slice(prefix.length + 1).split("/");
        names.set(head, names.get(head) || rest.length > 0);
      }
      return json([...names].map(([name, folder]) => ({ name, id: folder ? null : "x" })));
    }
    if (route === "/object/copy") {
      const { sourceKey, destinationKey } = JSON.parse(String(init?.body)) as { sourceKey: string; destinationKey: string };
      if (!objects.has(sourceKey)) return json({}, 404);
      objects.set(destinationKey, objects.get(sourceKey)!);
      return json({});
    }
    if (route.startsWith("/object/viavoip-docs/") && method === "POST") {
      const k = key("/object/viavoip-docs/");
      if (objects.has(k) && new Headers(init?.headers).get("x-upsert") !== "true") return json({ statusCode: "409", error: "Duplicate" }, 400);
      objects.set(k, new Uint8Array(init?.body as Uint8Array));
      return json({});
    }
    if (route === "/object/viavoip-docs" && method === "DELETE") {
      for (const k of (JSON.parse(String(init?.body)) as { prefixes: string[] }).prefixes) objects.delete(k);
      return json([]);
    }
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  Object.assign(process.env, { CONTENT_STORAGE: "supabase", SUPABASE_URL: "https://fake.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "fake" });
  return {
    objects,
    restore() {
      globalThis.fetch = original;
      for (const name of ["CONTENT_STORAGE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[name];
    },
  };
}

const owner = "00000000-0000-4000-8000-000000000000";
const planFor = (slug: string) => ({
  system: { name: "T", slug, description: null }, source: "folders" as const, ownerId: owner, baseFingerprint: "fp",
  tree: [{ title: "Início", slug: "inicio", type: null, file: "início.html", profiles: [], examples: [], children: [] }],
});
const bytes = (text: string) => new TextEncoder().encode(text);

test("Staging no Storage: preview, claim exclusivo, promoção, restauração e limpeza", async () => {
  const fake = fakeStorage();
  try {
    const files = new Map([["início.html", bytes("<h1>Olá</h1>")], ["img/a b.png", bytes("png")], ["notas.txt", bytes("ignorado")]]);
    const id = await createStaging(files, planFor("remote-sys"));

    assert.ok((await readStagedPlan(id))?.system.slug === "remote-sys");
    assert.equal(await readStagedPlan(id, true), null, "ainda não reivindicado");

    await claimStaging(id);
    await assert.rejects(claimStaging(id), /andamento/, "segundo claim deve falhar");
    assert.equal(await readStagedPlan(id), null, "reivindicado deixa de ser visível como não reivindicado");
    assert.ok(await readStagedPlan(id, true));
    assert.equal(await readClaimedHtml(id, "início.html"), "<h1>Olá</h1>");
    await assert.rejects(readClaimedHtml(id, "../../x.html"), /inválido/);
    await removeStaging(id); // não pode apagar um staging em aplicação
    assert.ok(await readStagedPlan(id, true));

    const { importId } = await promoteClaimedStaging(id, "remote-sys");
    const published = [...fake.objects.keys()].filter(key => key.startsWith(`systems/remote-sys/${importId}/`));
    assert.equal(published.length, 2, "apenas html e imagem são publicados");
    assert.ok([...fake.objects.keys()].some(key => key.startsWith(`staging/${id}/files/`)), "staging permanece após promover");

    // Caminho com acento/espaço é lido pela mesma rota que a importação grava.
    const file = locateContentFile(`/content/remote-sys/${importId}/img/a b.png`);
    assert.ok(file && (await statContentFile(file))?.size === 3);
    assert.equal(new TextDecoder().decode(await readContentFile(file!, { start: 1, end: 2 })), "ng");
    assert.equal(locateContentFile("/content/../x.png"), null);

    await restoreClaim(id, { slug: "remote-sys", importId });
    assert.ok(await readStagedPlan(id), "volta a não reivindicado após restaurar");

    await removeOtherImports("remote-sys", new Set());
    assert.equal([...fake.objects.keys()].some(key => key.startsWith("systems/remote-sys/")), false, "limpeza remove versões sem referência");
    await finishClaim(id);
    assert.equal([...fake.objects.keys()].some(key => key.startsWith("staging/")), false);
  } finally { fake.restore(); }
});
