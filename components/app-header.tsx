import Link from "next/link";
import { Gavel } from "lucide-react";
import { NavUserMenu } from "@/components/nav-user-menu";

/** App top bar: brand on the left, the account avatar menu on the right. */
export function AppHeader({ displayName, email }: { displayName: string; email: string }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gavel className="size-4" />
          </span>
          Auction Room
        </Link>
        <NavUserMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}
