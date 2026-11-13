"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, MapPin, NotebookPen, Star } from "lucide-react";
import { StoreAvatar } from "@/components/order-bits";
import { Button, Card } from "@/components/ui";
import { getStore } from "@/lib/config";
import type { ActionResult, DartRequest } from "@/lib/types";
import type { Counterpart } from "./page";

/** Runs a server action with a pending state and an error message. */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown> | void>, onOk?: (r: ActionResult<unknown>) => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r && !r.ok) setError(r.error);
      else if (r && onOk) onOk(r);
    });
  };
  return { pending, error, setError, run };
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}

export function OrderHeader({ req }: { req: DartRequest }) {
  const store = getStore(req.store);
  return (
    <div className="flex items-center gap-3.5">
      <StoreAvatar storeId={req.store} size={52} />
      <div>
        <p className="text-lg font-extrabold leading-tight">{store?.name ?? req.store}</p>
        <p className="text-sm text-muted">
          {store?.where} → {req.dropoff_zone}
        </p>
      </div>
    </div>
  );
}

export function ItemsCard({ req, spot, showSpot }: { req: DartRequest; spot: string | null; showSpot: boolean }) {
  return (
    <Card className="divide-y divide-line">
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Items</p>
        <p className="mt-1.5 whitespace-pre-line text-[17px] font-semibold leading-relaxed">{req.items}</p>
        {req.notes ? (
          <p className="mt-3 flex gap-2 rounded-xl bg-lime-25 p-3 text-sm text-muted">
            <NotebookPen className="mt-0.5 size-4 shrink-0" /> {req.notes}
          </p>
        ) : null}
      </div>
      <div className="flex items-start gap-3 p-4">
        <MapPin className="mt-0.5 size-5 shrink-0 text-action" />
        <div>
          <p className="font-bold">{req.dropoff_zone}</p>
          {showSpot && spot ? (
            <p className="text-sm text-muted">{spot}</p>
          ) : (
            <p className="flex items-center gap-1 text-sm text-muted">
              <Lock className="size-3.5" /> Exact spot shown after you claim
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PersonRow({ label, person, extra }: { label: string; person: Counterpart; extra?: React.ReactNode }) {
  if (!person) return null;
  const initials = person.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-full bg-action text-sm font-extrabold text-white">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="font-bold">{person.name}</p>
      </div>
      <div className="text-right text-sm">
        {person.rating ? (
          <p className="flex items-center justify-end gap-1 font-bold">
            <Star className="size-4 fill-lime-400 text-lime-500" /> {person.rating.toFixed(1)}
          </p>
        ) : (
          <p className="text-xs font-semibold text-muted">New</p>
        )}
        {extra}
      </div>
    </div>
  );
}

/** Two-tap button for actions that can't be undone. */
export function ConfirmButton({
  children,
  confirmText,
  onConfirm,
  pending,
  variant = "danger",
}: {
  children: React.ReactNode;
  confirmText: React.ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  variant?: "danger" | "secondary";
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button full variant={variant} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }
  return (
    <div className="animate-rise space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="text-sm leading-relaxed text-ink">{confirmText}</div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setArmed(false)}>
          Keep it
        </Button>
        <Button variant="danger" className="flex-1" loading={pending} onClick={onConfirm}>
          Yes, continue
        </Button>
      </div>
    </div>
  );
}

export function PhotoCard({ src, caption }: { src: string | null; caption: string }) {
  if (!src) return null;
  return (
    <figure className="overflow-hidden rounded-card border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={caption} className="max-h-80 w-full object-cover" />
      <figcaption className="px-4 py-2.5 text-xs font-semibold text-muted">{caption}</figcaption>
    </figure>
  );
}
