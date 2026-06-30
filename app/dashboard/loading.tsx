import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-12">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-16 rounded-xl" />
      <section className="space-y-5">
        <Skeleton className="h-6 w-40 rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
