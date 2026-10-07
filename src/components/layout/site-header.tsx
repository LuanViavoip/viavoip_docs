import { ProfileSwitcher } from "@/components/profiles/profile-switcher";
import { getCurrentProfile, listProfiles } from "@/features/profiles/queries";

import { AppHeader } from "./app-header";
import { ImportButton } from "./import-button";

type SiteHeaderProps = {
  redirectTo: string;
  /** Exibe o atalho para a importação (oculto na própria página de importação). */
  showImport?: boolean;
};

/** Header das páginas fora da documentação (home, admin). */
export async function SiteHeader({ redirectTo, showImport = true }: SiteHeaderProps) {
  const [profiles, currentProfile] = await Promise.all([listProfiles(), getCurrentProfile()]);

  return (
    <AppHeader
      actions={
        <>
          {showImport ? <ImportButton /> : null}
          {currentProfile ? (
            <ProfileSwitcher profiles={profiles} currentProfile={currentProfile} redirectTo={redirectTo} />
          ) : null}
        </>
      }
    />
  );
}
