import { DocsHeader } from "@/components/docs/docs-header";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { getDocsContext } from "@/features/documents/docs-context";
import { listProfiles } from "@/features/profiles/queries";
import { listSystems } from "@/features/systems/queries";

export default async function DocsLayout({ children, params }: LayoutProps<"/docs/[systemSlug]">) {
  const { systemSlug } = await params;
  const [{ system, profile, navigation }, systems, profiles] = await Promise.all([
    getDocsContext(systemSlug),
    listSystems(),
    listProfiles(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <DocsHeader
        system={system}
        systems={systems}
        profiles={profiles}
        currentProfile={profile}
        tree={navigation.visibleTree}
      />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r lg:block">
          <DocsSidebar tree={navigation.visibleTree} profileName={profile.name} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
