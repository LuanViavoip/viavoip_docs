import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentLoading() {
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]" aria-busy="true" aria-label="Carregando">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10 lg:px-10">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-2/3" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="space-y-4 border-t p-5 xl:border-t-0 xl:border-l">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}
