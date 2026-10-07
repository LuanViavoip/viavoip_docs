import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getCurrentProfile } from "@/features/profiles/queries";
import { getSystemBySlug } from "@/features/systems/queries";

import { getSystemNavigation, systemBasePath } from "./queries";

/** Dados comuns ao layout e à página de documentação (deduplicados por requisição). */
export const getDocsContext = cache(async (systemSlug: string) => {
  const [system, profile] = await Promise.all([getSystemBySlug(systemSlug), getCurrentProfile()]);

  if (!system) {
    notFound();
  }
  if (!profile) {
    redirect(`/profile?next=${encodeURIComponent(systemBasePath(systemSlug))}`);
  }

  const navigation = await getSystemNavigation(system.id, system.slug, profile.slug);
  return { system, profile, navigation };
});
