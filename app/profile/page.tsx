import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Gavel, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ChangePassword } from "@/components/profile/change-password";
import { Button } from "@/components/ui/button";
import type { RoomStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type RoomLite = { code: string; name: string; status: RoomStatus };
type PartRow = { id: string; team_name: string; room_id: string; rooms: RoomLite | RoomLite[] | null };
type WonRow = { id: string; name: string; sold_price: number | null; room_id: string };

const STATUS_BADGE: Record<RoomStatus, { label: string; cls: string }> = {
  active: { label: "Live", cls: "bg-primary/15 text-primary" },
  lobby: { label: "Lobby", cls: "bg-blue-500/15 text-blue-400" },
  paused: { label: "Paused", cls: "bg-amber-500/15 text-amber-400" },
  completed: { label: "Done", cls: "bg-muted text-muted-foreground" },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS-safe: profiles (self), rooms I admin, and my own participations (+ their rooms).
  const [{ data: profile }, { data: hosted }, { data: partsRaw }] = await Promise.all([
    supabase.from("profiles").select("display_name, created_at").eq("id", user.id).single(),
    supabase.from("rooms").select("code, name, status").eq("admin_id", user.id).order("created_at", { ascending: false }),
    supabase.from("room_participants").select("id, team_name, room_id, rooms(code, name, status)").eq("user_id", user.id),
  ]);

  const parts = (partsRaw ?? []) as unknown as PartRow[];
  const roomOf = (p: PartRow): RoomLite | null => (Array.isArray(p.rooms) ? (p.rooms[0] ?? null) : p.rooms);
  const myPartIds = parts.map((p) => p.id);

  // Players I won = SOLD items assigned to one of my teams (only in rooms I can see).
  const { data: wonRaw } = myPartIds.length
    ? await supabase.from("items").select("id, name, sold_price, room_id").eq("status", "sold").in("sold_to", myPartIds)
    : { data: [] as WonRow[] };
  const won = (wonRaw ?? []) as WonRow[];

  const totalSpent = won.reduce((s, i) => s + (i.sold_price ?? 0), 0);
  const biggest = won.reduce<WonRow | null>((m, i) => (!m || (i.sold_price ?? 0) > (m.sold_price ?? 0) ? i : m), null);
  const wonByRoom = new Map<string, number>();
  for (const w of won) wonByRoom.set(w.room_id, (wonByRoom.get(w.room_id) ?? 0) + 1);

  const displayName = profile?.display_name ?? "Player";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Gavel, label: "Auctions hosted", value: String((hosted ?? []).length) },
    { icon: Users, label: "Auctions played", value: String(parts.length) },
    { icon: Trophy, label: "Players won", value: String(won.length) },
    { icon: Wallet, label: "Total spent", value: formatAmount(totalSpent, "₹") },
  ];

  type MyRoom = { code: string; name: string; status: RoomStatus; role: string; won: number };
  const myRooms: MyRoom[] = [
    ...(hosted ?? []).map((r) => ({ ...r, role: "Host", won: 0 })),
    ...parts
      .map((p) => {
        const r = roomOf(p);
        return r ? { ...r, role: p.team_name, won: wonByRoom.get(p.room_id) ?? 0 } : null;
      })
      .filter((r): r is MyRoom => r !== null),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader displayName={displayName} email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <ProfileHeader userId={user.id} initialName={displayName} email={user.email ?? ""} memberSince={memberSince} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Career stats</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-lg">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-3.5 text-primary" /> {s.label}
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p>
                </div>
              );
            })}
            <div className="col-span-2 rounded-2xl border bg-card p-4 shadow-lg lg:col-span-1">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <Crown className="size-3.5 text-primary" /> Biggest buy
              </div>
              {biggest ? (
                <>
                  <p className="mt-2 truncate font-semibold">{biggest.name}</p>
                  <p className="tabular-nums text-sm text-primary">{formatAmount(biggest.sold_price ?? 0, "₹")}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No wins yet</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">My rooms</h2>
          {myRooms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Gavel className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">You haven&apos;t hosted or joined any auctions yet.</p>
              <Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-lg">
              {myRooms.map((r) => {
                const b = STATUS_BADGE[r.status];
                return (
                  <li key={`${r.code}-${r.role}`}>
                    <Link
                      href={`/rooms/${r.code}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.role === "Host" ? "Host" : `Team: ${r.role} · ${r.won} won`}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", b.cls)}>
                        {b.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Account &amp; security</h2>
          <ChangePassword />
        </section>
      </main>
    </div>
  );
}
