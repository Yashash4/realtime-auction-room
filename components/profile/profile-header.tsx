"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Mail, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialsOf } from "@/components/nav-user-menu";

/** Profile header: big avatar, inline-editable display name (saves to profiles), email, member-since. */
export function ProfileHeader({
  userId,
  initialName,
  email,
  memberSince,
}: {
  userId: string;
  initialName: string;
  email: string;
  memberSince: string;
}) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = draft.trim();
    if (!next) return toast.error("Display name can't be empty");
    if (next.length > 40) return toast.error("Keep it under 40 characters");
    setSaving(true);
    const { error } = await createClient().from("profiles").update({ display_name: next }).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    setName(next);
    setEditing(false);
    toast.success("Name updated");
  };

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-lg sm:flex-row sm:text-left">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-[0_0_44px_-8px_var(--color-primary)] ring-1 ring-primary/40">
        {initialsOf(name)}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={40}
              autoFocus
              className="max-w-xs text-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(name);
                }
              }}
            />
            <Button size="icon-sm" onClick={save} disabled={saving} aria-label="Save name">
              <Check className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(name);
              }}
              aria-label="Cancel"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              aria-label="Edit display name"
            >
              <Pencil className="size-4" />
            </Button>
          </div>
        )}
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
          <Mail className="size-3.5" /> {email}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Member since {memberSince}</p>
      </div>
    </div>
  );
}
