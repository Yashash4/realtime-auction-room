import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </main>
    </div>
  );
}
