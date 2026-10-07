"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeInternalPath } from "@/lib/validation/redirect";

import { PROFILE_COOKIE_MAX_AGE_SECONDS, PROFILE_COOKIE_NAME } from "./constants";
import { getProfileBySlug } from "./queries";

const selectProfileSchema = z.object({
  profileSlug: z.string().trim().min(1).max(64),
  redirectTo: z.string().optional(),
});

export async function selectProfileAction(formData: FormData): Promise<void> {
  const parsed = selectProfileSchema.safeParse({
    profileSlug: formData.get("profileSlug"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });
  if (!parsed.success) {
    redirect("/profile");
  }

  const profile = await getProfileBySlug(parsed.data.profileSlug);
  if (!profile) {
    redirect("/profile");
  }

  (await cookies()).set(PROFILE_COOKIE_NAME, profile.slug, {
    path: "/",
    maxAge: PROFILE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
  });

  redirect(safeInternalPath(parsed.data.redirectTo));
}
