import Link from "next/link";
import { SearchX } from "lucide-react";
import { loadRoom } from "@/lib/room-data";
import { Button } from "@/components/ui/button";
import { ProjectorView } from "@/components/room/projector-view";

export const dynamic = "force-dynamic";

export default async function ProjectorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadRoom(code);

  if (!data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Not available to watch</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This auction isn&apos;t live, or it&apos;s private and you&apos;re not a member.
          </p>
        </div>
        <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
      </main>
    );
  }

  return (
    <ProjectorView
      initial={{ room: data.room, items: data.items, participants: data.participants, bids: data.bids }}
      userId={data.userId}
    />
  );
}
