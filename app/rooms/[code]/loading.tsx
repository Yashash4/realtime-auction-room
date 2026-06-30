import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="mx-auto grid h-[calc(100vh-3.5rem)] w-full max-w-7xl gap-4 px-4 py-3 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-full w-full rounded-2xl" />
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>
    </div>
  );
}
