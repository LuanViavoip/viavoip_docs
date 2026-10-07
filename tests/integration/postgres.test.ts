import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createPrismaImportRepository, getImportSnapshot } from "../../src/features/importer/repository";
import { runImportApplication } from "../../src/features/importer/workflow";
import { createStaging } from "../../src/features/importer/storage";
import { SYSTEMS_STORAGE_DIR } from "../../src/lib/storage/paths";

// Não usa DATABASE_URL da aplicação. Schema descartável criado exclusivamente em TEST_DATABASE_URL.
test("PostgreSQL: migrations, constraints, rollback e importações A → B → C inválida", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const connectionString = process.env.TEST_DATABASE_URL!;
  const schema = `audit_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString });
  await sql.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
  try {
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    for (const file of ["20261007144759_init", "20261007180000_document_integrity"]) {
      await sql.query(await readFile(`prisma/migrations/${file}/migration.sql`, "utf8"));
    }
    await db.profile.create({ data: { slug: "developer", name: "Developer" } });
    const system = await db.system.create({ data: { slug: "constraint-test", name: "Constraints" } });
    const other = await db.system.create({ data: { slug: "other", name: "Other" } });
    const a = await db.document.create({ data: { systemId: system.id, title: "A", slug: "a" } });
    const b = await db.document.create({ data: { systemId: system.id, parentId: a.id, title: "B", slug: "b" } });
    await assert.rejects(db.document.create({ data: { systemId: system.id, title: "Duplicate", slug: "a" } }));
    await assert.rejects(db.document.update({ where: { id: a.id }, data: { parentId: a.id } }));
    await assert.rejects(db.document.update({ where: { id: a.id }, data: { parentId: b.id } }));
    await assert.rejects(db.document.create({ data: { systemId: other.id, parentId: a.id, title: "Wrong", slug: "wrong" } }));
    await assert.rejects(db.$transaction(async tx => {
      await tx.document.deleteMany({ where: { systemId: system.id } });
      throw new Error("rollback");
    }));
    assert.equal(await db.document.count({ where: { systemId: system.id } }), 2);
    const repository = createPrismaImportRepository(db);
    const ownerId = randomUUID(), slug = "integration";
    const stage = async (label: string, profiles: string[] = []) => createStaging(new Map([["x.html", new TextEncoder().encode(`<p>${label}</p>`)]]), {
      ownerId, baseFingerprint: (await getImportSnapshot(slug, db)).fingerprint,
      system: { name: "Integration", slug, description: null }, source: "folders",
      tree: [{ title: label, slug: "x", file: "x.html", type: null, profiles, examples: [], children: [] }],
    });
    const url = async () => (await db.document.findFirstOrThrow({ where: { system: { slug } } })).contentUrl!;
    const disk = (value: string) => SYSTEMS_STORAGE_DIR + value.slice("/content".length);
    await runImportApplication(await stage("A"), ownerId, repository);
    const urlA = await url();
    await runImportApplication(await stage("B"), ownerId, repository);
    const urlB = await url();
    await access(disk(urlB)); await assert.rejects(access(disk(urlA)));
    await assert.rejects(runImportApplication(await stage("C", ["unknown"]), ownerId, repository), /Perfil/);
    assert.equal(await url(), urlB); await access(disk(urlB));
    const first = await stage("D"), second = await stage("E");
    const results = await Promise.allSettled([runImportApplication(first, ownerId, repository), runImportApplication(second, ownerId, repository)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    await access(disk(await url()));
  } finally {
    await db.$disconnect();
    await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
