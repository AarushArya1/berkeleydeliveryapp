"use client";

import { useState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import Link from "next/link";
import clsx from "clsx";
import { Check, Home, MapPin, Store } from "lucide-react";
import { StoreAvatar } from "@/components/order-bits";
import { TimeLeft } from "@/components/time-left";
import { Card, Chip, EmptyState } from "@/components/ui";
import { LAUNCH_ZONES, STORES, getStore } from "@/lib/config";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";

// Filters are remembered between visits. null = never set, so the defaults apply.
function readFilter(key: string): string | null {
  try {
    return localStorage.getItem(`dart_filters_${key}`);
  } catch {
    return null;
  }
}
function saveFilter(key: string, v: string[]) {
  try {
    localStorage.setItem(`dart_filters_${key}`, JSON.stringify(v));
  } catch {}
}
function parseFilter(raw: string | null, fallback: string[]): string[] {
  if (raw == null) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : fallback;
  } catch {
    return fallback;
  }
}

const readStores = () => readFilter("stores");
const readZones = () => readFilter("zones");
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function Feed({
  requests,
  homeZones,
  budgetLeftCents,
}: {
  requests: DartRequest[];
  /** "Delivering to" starts on the runner's own dorm. */
  homeZones: string[];
  /** What's left of the runner's budget, or null before runner setup. */
  budgetLeftCents: number | null;
}) {
  // Nothing ticked in a row means no filter on it.
  const savedStores = useClientValue(readStores, null);
  const savedZones = useClientValue(readZones, null);
  const [pickedStores, setPickedStores] = useState<string[] | null>(null);
  const [pickedZones, setPickedZones] = useState<string[] | null>(null);
  const stores = pickedStores ?? parseFilter(savedStores, []);
  const zones = pickedZones ?? parseFilter(savedZones, homeZones);
  const toggleStore = (id: string) => {
    const next = toggle(stores, id);
    setPickedStores(next);
    saveFilter("stores", next);
  };
  const toggleZone = (z: string) => {
    const next = toggle(zones, z);
    setPickedZones(next);
    saveFilter("zones", next);
  };

  const inZone = (r: DartRequest) => zones.length === 0 || zones.includes(r.dropoff_zone);
  const counts: Record<string, number> = {};
  for (const r of requests) if (inZone(r)) counts[r.store] = (counts[r.store] ?? 0) + 1;

  const shown = requests.filter((r) => (stores.length === 0 || stores.includes(r.store)) && inZone(r));

  return (
    <div className="mt-6">
      <FilterLabel icon={<Store className="size-3.5" />} hint={stores.length === 0 ? "All stores" : null}>
        I&apos;m at or going to
      </FilterLabel>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {STORES.map((s) => (
          <CheckChip key={s.id} checked={stores.includes(s.id)} onClick={() => toggleStore(s.id)}>
            {s.name}
            {counts[s.id] ? (
              <span className={stores.includes(s.id) ? "text-white/80" : "text-lime-700"}>{counts[s.id]}</span>
            ) : null}
          </CheckChip>
        ))}
      </div>

      <FilterLabel icon={<MapPin className="size-3.5" />} hint={zones.length === 0 ? "All areas" : null} className="mt-4">
        Delivering to
      </FilterLabel>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {LAUNCH_ZONES.map((z) => (
          <CheckChip key={z} checked={zones.includes(z)} onClick={() => toggleZone(z)}>
            {z}
            {homeZones.includes(z) ? <Home className="size-3.5 opacity-70" /> : null}
          </CheckChip>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <EmptyState icon={<Store className="size-7" />} title="No open orders here yet">
            {requests.length > 0 ? "Tick more stores or areas to see more." : "New requests show up here instantly."}
          </EmptyState>
        ) : (
          shown.map((r) => (
            <FeedCard key={r.id} req={r} overBudget={budgetLeftCents != null && r.max_price_cents > budgetLeftCents} />
          ))
        )}
      </div>
    </div>
  );
}

function FilterLabel({
  icon,
  hint,
  className,
  children,
}: {
  icon: React.ReactNode;
  hint: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("mb-2 flex items-center justify-between", className)}>
      <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted">
        {icon} {children}
      </p>
      {hint ? <span className="text-xs font-semibold text-muted">{hint}</span> : null}
    </div>
  );
}

/** A chip that ticks on and off, so several can be picked at once. */
function CheckChip({ checked, children, onClick }: { checked: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Chip selected={checked} role="checkbox" aria-checked={checked} aria-pressed={undefined} onClick={onClick} className="pl-2.5">
      <span
        className={clsx(
          "flex size-[18px] items-center justify-center rounded-md border-2",
          checked ? "border-white bg-white text-action" : "border-lime-300 bg-white",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={4} /> : null}
      </span>
      {children}
    </Chip>
  );
}

function FeedCard({ req, overBudget }: { req: DartRequest; overBudget: boolean }) {
  const store = getStore(req.store);
  return (
    <Link href={`/orders/${req.id}`} className="block">
      <Card className="animate-rise p-4 transition-colors active:bg-lime-25">
        <div className="flex items-start gap-3.5">
          <StoreAvatar storeId={req.store} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 font-bold leading-snug text-ink">{req.items}</p>
              <span className="shrink-0 rounded-full bg-lime-300 px-2.5 py-1 text-xs font-extrabold text-lime-900">
                +{money(req.runner_fee_cents)}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {store?.name} · {store?.where} → <span className="font-semibold text-ink">{req.dropoff_zone}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Up to {money(req.max_price_cents)} on the Dart card · closes in <TimeLeft iso={req.expires_at} />
            </p>
            {overBudget ? <p className="mt-1.5 text-xs font-semibold text-warn-ink">Over what&apos;s left of your budget</p> : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
