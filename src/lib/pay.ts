import type { PayMethod } from "./config";
import { normalizePhone } from "./format";
import type { DartRequest } from "./types";

// Venmo and Zelle accounts. Each user enters theirs once (sign-up or profile);
// at handoff the requester sees the runner's, with the amount filled in.

export type PayAccounts = { venmo_username: string | null; zelle_contact: string | null };

export function hasPayAccount(p: PayAccounts) {
  return Boolean(p.venmo_username || p.zelle_contact);
}

export function payMethods(p: PayAccounts): PayMethod[] {
  return [...(p.venmo_username ? (["venmo"] as const) : []), ...(p.zelle_contact ? (["zelle"] as const) : [])];
}

/** "@Oski-Bear" -> "Oski-Bear", or null if it can't be a Venmo username. */
export function normalizeVenmo(input: string) {
  const v = input.trim().replace(/^@/, "");
  return /^[A-Za-z0-9_-]{5,30}$/.test(v) ? v : null;
}

/** A US phone number (stored +1XXXXXXXXXX) or an email address. */
export function normalizeZelle(input: string) {
  const v = input.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v.toLowerCase();
  return normalizePhone(v);
}

export function formatZelle(contact: string) {
  return contact.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
}

/** Opens Venmo with the runner, amount and note filled in (falls back to the website). */
export function venmoPayUrl(username: string, cents: number, note: string) {
  const q = new URLSearchParams({ txn: "pay", audience: "private", recipients: username, amount: (cents / 100).toFixed(2), note });
  return `https://venmo.com/?${q.toString()}`;
}

/** Bought, and the runner hasn't confirmed being paid back yet. */
export function owesRunner(req: DartRequest) {
  if (req.charged_cents == null || req.completed_at) return false;
  return (
    ["delivering", "dropped_off"].includes(req.status) ||
    (req.status === "cancelled" && req.cancelled_stage === "after_purchase") ||
    (req.status === "disputed" && req.status_before_dispute !== "completed")
  );
}
