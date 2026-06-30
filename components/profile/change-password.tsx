"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Change password via supabase.auth.updateUser — min 8 chars, must match. */
export function ChangePassword() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const dirty = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDone(false);
    fn(e.target.value);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPw("");
    setConfirm("");
    setDone(true);
    toast.success("Password updated");
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h3 className="font-semibold">Change password</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newpw">New password</Label>
          <Input
            id="newpw"
            type="password"
            value={pw}
            onChange={dirty(setPw)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmpw">Confirm new password</Label>
          <Input
            id="confirmpw"
            type="password"
            value={confirm}
            onChange={dirty(setConfirm)}
            autoComplete="new-password"
            placeholder="Re-enter password"
          />
        </div>
      </div>
      {done && <p className="text-sm font-medium text-emerald-400">Password updated successfully.</p>}
      <Button type="submit" disabled={saving || !pw || !confirm}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
