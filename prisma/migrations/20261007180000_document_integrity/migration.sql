-- Falhar, sem corrigir/apagar dados, se já existir uma hierarquia inválida.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Document" WHERE "parentId" IS NULL GROUP BY "systemId", "slug" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Slugs raiz duplicados: saneie os dados antes de aplicar a migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Document" c JOIN "Document" p ON p.id = c."parentId" WHERE c."systemId" <> p."systemId") THEN
    RAISE EXCEPTION 'Pai e filho pertencem a sistemas diferentes';
  END IF;
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT id, "parentId", ARRAY[id] AS trail, false AS cycle FROM "Document"
      UNION ALL
      SELECT c.id, d."parentId", c.trail || d.id, d.id = ANY(c.trail)
      FROM chain c JOIN "Document" d ON d.id = c."parentId" WHERE NOT c.cycle
    ) SELECT 1 FROM chain WHERE cycle
  ) THEN RAISE EXCEPTION 'Ciclo de documentos: saneie a hierarquia antes da migration'; END IF;
END $$;

CREATE UNIQUE INDEX "Document_root_slug_key" ON "Document" ("systemId", "slug") WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "Document_systemId_id_key" ON "Document" ("systemId", id);
ALTER TABLE "Document" DROP CONSTRAINT "Document_parentId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey"
  FOREIGN KEY ("systemId", "parentId") REFERENCES "Document" ("systemId", id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_no_self_parent" CHECK ("parentId" IS DISTINCT FROM id);

CREATE FUNCTION validate_document_cycle() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  -- Serializa mudanças da hierarquia do mesmo sistema para evitar ciclos por write skew.
  PERFORM pg_advisory_xact_lock(hashtextextended('viavoip-tree:' || NEW."systemId", 0));
  IF NEW."parentId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentId" FROM "Document" WHERE id = NEW."parentId"
      UNION
      SELECT d.id, d."parentId" FROM "Document" d JOIN ancestors a ON d.id = a."parentId"
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'Ciclo na hierarquia de documentos' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_cycle_guard BEFORE INSERT OR UPDATE OF "parentId", "systemId" ON "Document"
  FOR EACH ROW EXECUTE FUNCTION validate_document_cycle();
