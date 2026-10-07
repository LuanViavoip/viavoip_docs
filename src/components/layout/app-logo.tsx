import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

export function AppLogo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md border bg-muted/60">
        <BookOpenIcon className="size-4" />
      </span>
      <span className="hidden sm:inline">
        ViaVOIP <span className="text-muted-foreground">Docs</span>
      </span>
    </Link>
  );
}
