import { Suspense } from "react";
import { Notice, PageSkeleton } from "@/components/ui";
import { getMember } from "@/lib/auth";
import { LAUNCH_ZONES } from "@/lib/config";
import { payMethods } from "@/lib/pay";
import { NewRequestForm } from "./form";

export const metadata = { title: "Add to shopping list · Dart" };

export default function NewRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewRequest />
    </Suspense>
  );
}

async function NewRequest() {
  const { profile } = await getMember();
  if (profile.status !== "active") {
    return (
      <div className="px-4 pt-6">
        <Notice tone="warn">Your account is {profile.status}, so you can&apos;t post requests right now.</Notice>
      </div>
    );
  }
  return (
    <NewRequestForm
      defaultZone={profile.dorm && LAUNCH_ZONES.includes(profile.dorm) ? profile.dorm : LAUNCH_ZONES[0]}
      defaultSpot={profile.default_spot ?? ""}
      payMethods={payMethods(profile)}
    />
  );
}
