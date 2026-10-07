"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SystemSummary } from "@/features/systems/queries";

type SystemSwitcherProps = {
  systems: SystemSummary[];
  currentSlug: string;
};

export function SystemSwitcher({ systems, currentSlug }: SystemSwitcherProps) {
  const current = systems.find((system) => system.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-56 font-medium">
          <span className="truncate">{current?.name ?? "Selecionar sistema"}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Sistemas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {systems.map((system) => (
          <DropdownMenuItem key={system.id} asChild>
            <Link href={`/docs/${system.slug}`}>
              <span className="truncate">{system.name}</span>
              {system.slug === currentSlug ? <CheckIcon className="ml-auto" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
