import { AppHeader } from "@/components/layout/app-header";
import { ImportButton } from "@/components/layout/import-button";
import { ProfileSwitcher } from "@/components/profiles/profile-switcher";
import type { DocumentNode } from "@/features/documents/tree";
import type { ProfileSummary } from "@/features/profiles/queries";
import type { SystemSummary } from "@/features/systems/queries";

import { DocsSearch } from "./docs-search";
import { DownloadButton } from "./download-button";
import { MobileNav } from "./mobile-nav";
import { SystemSwitcher } from "./system-switcher";

type DocsHeaderProps = {
  system: SystemSummary;
  systems: SystemSummary[];
  profiles: ProfileSummary[];
  currentProfile: ProfileSummary;
  tree: DocumentNode[];
};

export function DocsHeader({ system, systems, profiles, currentProfile, tree }: DocsHeaderProps) {
  return (
    <AppHeader
      leading={
        <MobileNav
          tree={tree}
          systemName={system.name}
          systemSlug={system.slug}
          profileName={currentProfile.name}
        />
      }
      actions={
        <>
          <DocsSearch key={system.slug} systemSlug={system.slug} className="hidden w-72 md:block lg:w-96" />
          <ProfileSwitcher profiles={profiles} currentProfile={currentProfile} redirectTo={`/docs/${system.slug}`} />
          <ImportButton />
          <DownloadButton />
        </>
      }
    >
      <span className="hidden text-border sm:inline">/</span>
      <SystemSwitcher systems={systems} currentSlug={system.slug} />
    </AppHeader>
  );
}
