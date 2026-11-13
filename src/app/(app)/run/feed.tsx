"use client";

import { useMemo, useState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import Link from "next/link";
import { MapPin, Store } from "lucide-react";
import { StoreAvatar } from "@/components/order-bits";
import { TimeLeft } from "@/components/time-left";
import { Card, Chip, EmptyState } from "@/components/ui";
import { LAUNCH_ZONES, STORES, getStore } from "@/lib/config";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";

function readFilter(key: string) {
  try {
    return localStorage.getItem(`dart_filter_${key}`) ?? "all";
  } catch {
    return "all";
  }
}

const readStore = () => readFilter("store");
const readZone = () => readFilter("zone");

export function Feed({ requests }: { requests: DartRequest[] }) {
  // Remember the runner's filters between visits.
  const savedStore = useClientValue(readStore, "all");
  const savedZone = useClientValue(readZone, "all");
  const [pickedStore, setStoreState] = useState<string | null>(null);
  const [pickedZone, setZoneState] = useState<string | null>(null);
  const store = pickedStore ?? savedStore;
  const zone = pickedZone ?? savedZone;
  const save = (key: string, v: string) => {
    try {
      localStorage.setItem(`dart_filter_${key}`, v);
    } catch {}
  };
  const setStore = (v: string) => (setStoreState(v), save("store", v));
  const setZone = (v: string) => (setZoneState(v), save("zone", v));

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of requests) if (zone === "all" || r.dropoff_zone === zone) c[r.store] = (c[r.store] ?? 0) + 1;
    return c;
  }, [requests, zone]);

  const shown = requests.filter((r) => (store === "all" || r.store === store) && (zone === "all" || r.dropoff_zone === zone));

  return (
    <div className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted">
        <Store className="size-3.5" /> I&apos;m at
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={store === "all"} onClick={() => setStore("all")}>
          Any store
        </Chip>
        {STORES.map((s) => (
          <Chip key={s.id} selected={store === s.id} onClick={() => setStore(s.id)}>
            {s.name}
            {counts[s.id] ? (
              <span className={store === s.id ? "text-white/80" : "text-lime-700"}>{counts[s.id]}</span>
            ) : null}
          </Chip>
        ))}
      </div>

      <p className="mb-2 mt-4 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-muted">
        <MapPin className="size-3.5" /> Delivering to
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip selected={zone === "all"} onClick={() => setZone("all")}>
          Anywhere
        </Chip>
        {LAUNCH_ZONES.map((z) => (
          <Chip key={z} selected={zone === z} onClick={() => setZone(z)}>
            {z}
          </Chip>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <EmptyState icon={<Store className="size-7" />} title="No open orders here yet">
            {requests.length > 0 ? "Try another store or area." : "New requests show up here instantly."}
          </EmptyState>
        ) : (
          shown.map((r) => <FeedCard key={r.id} req={r} />)
        )}
      </div>
    </div>
  );
}

function FeedCard({ req }: { req: DartRequest }) {
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
          </div>
        </div>
      </Card>
    </Link>
  );
}
