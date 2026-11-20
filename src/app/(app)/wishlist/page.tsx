import { Suspense } from "react";
import { ShoppingBasket } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequestRow } from "@/components/request-row";
import { ButtonLink, EmptyState, Notice, PageSkeleton, SectionTitle } from "@/components/ui";
import { getMember } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { runMaintenance } from "@/lib/orders";
import { owesRunner } from "@/lib/pay";
import type { DartRequest } from "@/lib/types";

export const metadata = { title: "Shopping list · Dart" };

const ACTIVE = ["open", "claimed", "purchased", "delivering", "dropped_off", "disputed"];

export default function WishlistPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Wishlist />
    </Suspense>
  );
}

async function Wishlist() {
  const { supabase, userId, profile } = await getMember();
  await runMaintenance();
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<DartRequest[]>();
  const requests = data ?? [];
  // Still owing the runner (e.g. cancelled after it was bought) keeps it up top.
  const isActive = (r: DartRequest) => ACTIVE.includes(r.status) || owesRunner(r);
  const active = requests.filter(isActive);
  const past = requests.filter((r) => !isActive(r));

  return (
    <div className="px-4 pt-5">
      <RealtimeRefresh channel={`list-${userId}`} filter={`requester_id=eq.${userId}`} />
      <h1 className="text-2xl font-extrabold tracking-tight">Hey {firstName(profile.full_name)} 👋</h1>
      <p className="mt-1 text-muted">What do you need from the store?</p>

      {profile.status !== "active" ? (
        <Notice tone="warn" className="mt-4">
          Your account is {profile.status}. You can&apos;t post new requests. Contact the Dart team if you think this is a mistake.
        </Notice>
      ) : null}

      <div className="mt-6">
        {requests.length === 0 ? (
          <EmptyState icon={<ShoppingBasket className="size-7" />} title="Your shopping list is empty">
            <p>Add what you need. A student already heading to the store will pick it up.</p>
            <ButtonLink href="/wishlist/new" className="mt-5">
              Add your first item
            </ButtonLink>
          </EmptyState>
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <SectionTitle>Active</SectionTitle>
                <div className="space-y-3">
                  {active.map((r) => (
                    <RequestRow key={r.id} req={r} as="requester" />
                  ))}
                </div>
              </>
            ) : (
              <ButtonLink href="/wishlist/new" full size="lg" className="mb-2">
                Add to your shopping list
              </ButtonLink>
            )}
            {past.length > 0 ? (
              <>
                <SectionTitle>Past</SectionTitle>
                <div className="space-y-3">
                  {past.map((r) => (
                    <RequestRow key={r.id} req={r} as="requester" />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
