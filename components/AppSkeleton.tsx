import { Skeleton } from "@/components/ui/skeleton";

export function AppSkeleton({
  variant = "page",
}: {
  variant?: "page" | "auth" | "detail";
}) {
  if (variant === "auth") {
    return (
      <div className="min-h-[100dvh] bg-neutral-950 px-4 py-10 text-neutral-100">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl shadow-black/20">
          <div className="space-y-3">
            <Skeleton className="h-8 w-40 rounded-xl" />
            <Skeleton className="h-5 w-72 rounded-xl" />
          </div>
          <div className="mt-8 space-y-4">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl bg-neutral-700/80" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100">
        <Skeleton className="h-[62vh] w-full rounded-none" />
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-xl" />
            <Skeleton className="h-6 w-20 rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-6 w-1/3 rounded-xl" />
            <Skeleton className="h-5 w-1/2 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-xl" />
            <Skeleton className="h-4 w-11/12 rounded-xl" />
            <Skeleton className="h-4 w-4/5 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl bg-neutral-700/80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <Skeleton className="h-6 w-32 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-2xl" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Skeleton className="h-44 w-full rounded-[28px]" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-neutral-800 bg-neutral-900/40 p-3">
                <Skeleton className="h-40 w-full rounded-[20px]" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-xl" />
                  <Skeleton className="h-4 w-1/2 rounded-xl" />
                  <Skeleton className="h-5 w-1/3 rounded-xl bg-neutral-700/80" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
