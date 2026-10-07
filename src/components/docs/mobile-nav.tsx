"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { DocumentNode } from "@/features/documents/tree";

import { DocsSearch } from "./docs-search";
import { DocsSidebar } from "./docs-sidebar";

type MobileNavProps = {
  tree: DocumentNode[];
  systemName: string;
  systemSlug: string;
  profileName: string;
};

export function MobileNav({ tree, systemName, systemSlug, profileName }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Abrir índice">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{systemName}</SheetTitle>
          <SheetDescription>Perfil: {profileName}</SheetDescription>
        </SheetHeader>
        <div className="border-b p-4 md:hidden">
          <DocsSearch key={systemSlug} systemSlug={systemSlug} onNavigate={() => setOpen(false)} />
        </div>
        <DocsSidebar tree={tree} profileName={profileName} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
