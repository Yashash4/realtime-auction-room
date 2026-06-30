import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <main className="grid h-[calc(100vh-4rem)] lg:grid-cols-[1fr_26rem]">
        <div className="flex flex-col items-center justify-center gap-6 p-8">
          <Skeleton className="size-48 rounded-full" />
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-6 w-40 rounded-md" />
        </div>
        <Skeleton className="m-4 h-auto rounded-2xl" />
      </main>
    </div>
  );
}
