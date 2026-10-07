import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export type SystemSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

const systemSelect = { id: true, name: true, slug: true, description: true } as const;

export const listSystems = cache(async (): Promise<SystemSummary[]> => {
  return prisma.system.findMany({ select: systemSelect, orderBy: { name: "asc" } });
});

export const getSystemBySlug = cache(async (slug: string): Promise<SystemSummary | null> => {
  return prisma.system.findUnique({ where: { slug }, select: systemSelect });
});
