import Link from "next/link";
import { redirect } from "next/navigation";
import { Gavel, Radio, ShieldCheck, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const features = [
    { icon: Radio, title: "Live bidding", body: "Bids, current player and results update across every screen in realtime." },
    { icon: Timer, title: "Countdown + anti-snipe", body: "A shared clock resolves each lot; late bids extend the timer." },
    { icon: ShieldCheck, title: "Consistent under load", body: "Every bid is an atomic DB transaction — one winner, always." },
  ];

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Gavel className="size-7" />
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Realtime auction rooms
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
          Run an IPL-style live auction. Create a room, share the code, and let
          teams bid against the clock — one player at a time, sold to the
          highest bidder.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/register" />}>
            Get started
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/login" />}>
            Log in
          </Button>
        </div>
      </div>

      <div className="mt-16 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5 text-left">
            <f.icon className="size-5 text-primary" />
            <h3 className="mt-3 font-medium">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
