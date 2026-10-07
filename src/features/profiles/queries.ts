import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

import { PROFILE_COOKIE_NAME } from "./constants";

export type ProfileSummary = {
  id: string;
  name: string;
  slug: string;
};

const profileSelect = { id: true, name: true, slug: true } as const;

export const listProfiles = cache(async (): Promise<ProfileSummary[]> => {
  return prisma.profile.findMany({
    select: profileSelect,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
});

export async function getProfileBySlug(slug: string): Promise<ProfileSummary | null> {
  return prisma.profile.findUnique({ where: { slug }, select: profileSelect });
}

/**
 * Perfil escolhido pelo usuário (cookie). É uma preferência de exibição, não uma credencial:
 * qualquer pessoa pode alterá-lo. Retorna `null` se não houver cookie ou se o perfil não existir mais.
 */
export const getCurrentProfile = cache(async (): Promise<ProfileSummary | null> => {
  const slug = (await cookies()).get(PROFILE_COOKIE_NAME)?.value;
  if (!slug) {
    return null;
  }
  return getProfileBySlug(slug);
});
