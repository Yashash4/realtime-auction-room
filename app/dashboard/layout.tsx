import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader displayName={profile?.display_name ?? "Player"} email={user?.email ?? ""} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
