import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
        <Skeleton className="mx-auto h-10 w-64 rounded-md" />
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
