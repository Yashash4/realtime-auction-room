"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { genRoomCode } from "@/lib/codes";

export type CreateRoomState = { error?: string };

const tierSchema = z
  .array(z.object({ min_price: z.number().int().min(0), step: z.number().int().positive() }))
  .min(1)
  .refine((t) => t.some((x) => x.min_price === 0), "Tiers must include a min_price of 0");

const formSchema = z.object({
  name: z.string().trim().min(1, "Room name is required").max(60),
  currency: z.string().trim().min(1).max(3),
  teamBudget: z.coerce.number().int().positive("Budget must be positive"),
  timerSeconds: z.coerce.number().int().min(10).max(300),
  tiers: tierSchema,
  players: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().nullable(),
        country: z.string().nullable(),
        base_price: z.number().int().min(0),
      }),
    )
    .min(1, "Add at least one player"),
});

/** Parse the players textarea: one line "Name, Role, Country, BasePrice". */
function parsePlayers(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role, country, price] = line.split(",").map((p) => p?.trim());
      return {
        name: name ?? "",
        role: role || null,
        country: country || null,
        base_price: Number.isFinite(Number(price)) ? parseInt(price, 10) : 0,
      };
    })
    .filter((p) => p.name.length > 0);
}

export async function createRoom(
  _prev: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let tiers: unknown;
  try {
    tiers = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    return { error: "Invalid increment tiers" };
  }

  const parsed = formSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    teamBudget: formData.get("teamBudget"),
    timerSeconds: formData.get("timerSeconds"),
    tiers,
    players: parsePlayers(String(formData.get("players") ?? "")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  const sortedTiers = [...data.tiers].sort((a, b) => a.min_price - b.min_price);

  // Insert the room, retrying on the (unlikely) code collision.
  let code = "";
  let roomId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = genRoomCode();
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        code,
        name: data.name,
        admin_id: user.id,
        team_budget: data.teamBudget,
        currency: data.currency,
        timer_seconds: data.timerSeconds,
        increment_tiers: sortedTiers,
      })
      .select("id")
      .single();

    if (!error && room) {
      roomId = room.id;
      break;
    }
    if (error && error.code !== "23505") {
      return { error: error.message };
    }
  }
  if (!roomId) return { error: "Could not generate a unique room code, try again" };

  const items = data.players.map((p, i) => ({
    room_id: roomId,
    name: p.name,
    role: p.role,
    country: p.country,
    base_price: p.base_price,
    order_index: i,
  }));
  const { error: itemsError } = await supabase.from("items").insert(items);
  if (itemsError) return { error: itemsError.message };

  redirect(`/rooms/${code}`);
}
