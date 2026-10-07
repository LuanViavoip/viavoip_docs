import type { ReactNode } from "react";

import { AppLogo } from "./app-logo";

type AppHeaderProps = {
  /** Elementos antes do logo (ex.: botão do menu mobile). */
  leading?: ReactNode;
  /** Elementos logo após o logo (ex.: seletor de sistema). */
  children?: ReactNode;
  /** Elementos alinhados à direita (pesquisa, perfil, ações). */
  actions?: ReactNode;
};

export function AppHeader({ leading, children, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-3 px-4">
        {leading}
        <AppLogo />
        {children ? <div className="flex min-w-0 items-center gap-2">{children}</div> : null}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
