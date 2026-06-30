import { createClient } from "@/lib/supabase/server";

/** Quote a CSV field if it contains a comma, quote, or newline. */
function esc(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { data: room } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (!room) return new Response("Not found", { status: 404 });

    const [{ data: items }, { data: participants }] = await Promise.all([
      supabase.from("items").select("*").eq("room_id", room.id).order("order_index"),
      supabase.from("room_participants").select("*").eq("room_id", room.id),
    ]);

    const teamById = new Map((participants ?? []).map((p) => [p.id, p]));

    const rows: string[] = ["Player,Role,Country,Won By,Price"];
    for (const it of items ?? []) {
      const wonBy =
        it.status === "sold" ? (teamById.get(it.sold_to ?? "")?.team_name ?? "—") : "Unsold";
      const price = it.status === "sold" ? it.sold_price : null;
      rows.push(
        [esc(it.name), esc(it.role ?? ""), esc(it.country ?? ""), esc(wonBy), esc(price)].join(","),
      );
    }

    rows.push("");
    rows.push("Team,Players Won,Total Spend,Budget Left");
    for (const p of participants ?? []) {
      const won = (items ?? []).filter((i) => i.sold_to === p.id);
      const spend = won.reduce((s, i) => s + (i.sold_price ?? 0), 0);
      rows.push(
        [esc(p.team_name), esc(won.length), esc(spend), esc(p.budget_remaining)].join(","),
      );
    }

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${room.code}-results.csv"`,
      },
    });
  } catch {
    return new Response("Failed to build results", { status: 500 });
  }
}
