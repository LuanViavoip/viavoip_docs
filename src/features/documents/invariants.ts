export type HierarchyRecord = { id: string; parentId: string | null; slug: string; systemId?: string };

/** Valida a coleção completa, antes de qualquer filtro de visibilidade. */
export function validateHierarchy(records: HierarchyRecord[]): void {
  const byId = new Map<string, HierarchyRecord>();
  const siblings = new Set<string>();
  for (const record of records) {
    if (byId.has(record.id)) throw new Error("Identificador de documento duplicado.");
    byId.set(record.id, record);
    const key = JSON.stringify([record.systemId ?? "", record.parentId, record.slug]);
    if (siblings.has(key)) throw new Error(`Slug duplicado entre irmãos: ${record.slug}.`);
    siblings.add(key);
  }
  const finished = new Set<string>();
  for (const record of records) {
    const trail = new Set<string>();
    let current: HierarchyRecord | undefined = record;
    while (current && !finished.has(current.id)) {
      if (trail.has(current.id)) throw new Error(`Ciclo na hierarquia: ${current.id}.`);
      trail.add(current.id);
      if (current.parentId === null) break;
      const parent: HierarchyRecord | undefined = byId.get(current.parentId);
      if (!parent) throw new Error(`Pai inexistente para ${current.id}.`);
      if (parent.systemId !== current.systemId) throw new Error("Pai e filho devem pertencer ao mesmo System.");
      current = parent;
    }
    for (const id of trail) finished.add(id);
  }
}
