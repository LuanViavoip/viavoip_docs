"use client";

import { ChevronDownIcon, Loader2Icon, UserRoundIcon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { selectProfileAction } from "@/features/profiles/actions";
import type { ProfileSummary } from "@/features/profiles/queries";

type ProfileSwitcherProps = {
  profiles: ProfileSummary[];
  currentProfile: ProfileSummary;
  /** Para onde voltar após trocar o perfil. */
  redirectTo: string;
};

export function ProfileSwitcher({ profiles, currentProfile, redirectTo }: ProfileSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(profileSlug: string) {
    if (profileSlug === currentProfile.slug) {
      return;
    }
    const formData = new FormData();
    formData.set("profileSlug", profileSlug);
    formData.set("redirectTo", redirectTo);
    startTransition(() => selectProfileAction(formData));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending} aria-label="Alterar perfil">
          {isPending ? <Loader2Icon className="animate-spin" /> : <UserRoundIcon />}
          <span className="hidden md:inline">{currentProfile.name}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Perfil de visualização</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentProfile.slug} onValueChange={handleChange}>
          {profiles.map((profile) => (
            <DropdownMenuRadioItem key={profile.id} value={profile.slug}>
              {profile.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          O perfil filtra a documentação exibida. Não é um controle de acesso.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
