import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { money } from "@/lib/format";
import type { DartRequest } from "@/lib/types";
import { StatusPill, StoreAvatar, storeLabel } from "./order-bits";
import { ClockTime, TimeLeft } from "./time-left";
import { Card } from "./ui";

/** One order in a list, from the requester's or runner's point of view. */
export function RequestRow({ req, as }: { req: DartRequest; as: "requester" | "runner" }) {
  let meta: React.ReactNode;
  if (req.status === "open") meta = <>Up to {money(req.max_price_cents)} · closes in <TimeLeft iso={req.expires_at} /></>;
  else if (as === "runner" && req.deliver_by && ["claimed", "purchased", "delivering"].includes(req.status))
    meta = <>Deliver by <ClockTime iso={req.deliver_by} /></>;
  else if (req.status === "claimed" && req.eta_at) meta = <>Arriving ~<ClockTime iso={req.eta_at} /></>;
  else if (req.charged_cents != null && as === "requester") meta = <>Charged {money(req.charged_cents)}</>;
  else if (as === "runner" && ["completed", "cancelled"].includes(req.status) && req.payout_status === "released") meta = <>Earned {money(req.runner_fee_cents)}</>;
  else meta = storeLabel(req.store);

  return (
    <Link href={`/orders/${req.id}`} className="block">
      <Card className="flex items-center gap-3.5 p-4 transition-colors active:bg-lime-25">
        <StoreAvatar storeId={req.store} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-bold text-ink">{req.items}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{meta}</p>
          <div className="mt-2">
            <StatusPill status={req.status} as={as} />
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted/60" />
      </Card>
    </Link>
  );
}
