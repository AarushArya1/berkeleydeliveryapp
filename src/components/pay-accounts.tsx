"use client";

import { useState, useTransition } from "react";
import { savePayAccounts } from "@/app/actions";
import { Button, ErrorText, Input, Label } from "./ui";

/** Venmo username + Zelle phone/email. At least one is required. */
export function PayAccountFields({
  venmo,
  zelle,
  onVenmo,
  onZelle,
}: {
  venmo: string;
  zelle: string;
  onVenmo: (v: string) => void;
  onZelle: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <div>
        <p className="text-sm font-bold text-ink">Venmo or Zelle</p>
        <p className="text-xs text-muted">How you pay runners, and get paid when you run. Add one or both. Only shown on your orders.</p>
      </div>
      <div>
        <Label htmlFor="venmo">Venmo username</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">@</span>
          <Input
            id="venmo"
            className="pl-8"
            autoCapitalize="none"
            autoCorrect="off"
            value={venmo}
            onChange={(e) => onVenmo(e.target.value.replace(/^@/, ""))}
            placeholder="Oski-Bear"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="zelle">Zelle phone or email</Label>
        <Input
          id="zelle"
          autoCapitalize="none"
          autoCorrect="off"
          value={zelle}
          onChange={(e) => onZelle(e.target.value)}
          placeholder="(510) 555-0123 or you@berkeley.edu"
        />
      </div>
    </div>
  );
}

/** Edit form for the profile page and runner setup. */
export function PayAccountsEditor({
  initialVenmo,
  initialZelle,
  submitLabel = "Save",
  onSaved,
}: {
  initialVenmo: string;
  initialZelle: string;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [venmo, setVenmo] = useState(initialVenmo);
  const [zelle, setZelle] = useState(initialZelle);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const changed = venmo !== initialVenmo || zelle !== initialZelle;

  return (
    <div className="space-y-3">
      <PayAccountFields
        venmo={venmo}
        zelle={zelle}
        onVenmo={(v) => (setVenmo(v), setSaved(false))}
        onZelle={(v) => (setZelle(v), setSaved(false))}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        full
        variant={changed || onSaved ? "primary" : "secondary"}
        disabled={!(venmo.trim() || zelle.trim()) || (!changed && !onSaved)}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await savePayAccounts({ venmo, zelle });
            setError(r.ok ? null : r.error);
            if (r.ok) {
              setSaved(true);
              onSaved?.();
            }
          })
        }
      >
        {saved && !onSaved ? "Saved" : submitLabel}
      </Button>
    </div>
  );
}
