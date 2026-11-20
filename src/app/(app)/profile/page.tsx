import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronRight, FileText, LayoutDashboard, Star } from "lucide-react";
import { signOut } from "@/app/actions";
import { PayAccountsEditor } from "@/components/pay-accounts";
import { PushButton } from "@/components/push-button";
import { Button, Card, PageSkeleton, SectionTitle } from "@/components/ui";
import { getMember, isRunnerReady } from "@/lib/auth";
import { ratingFor } from "@/lib/orders";
import { formatZelle } from "@/lib/pay";

export const metadata = { title: "Profile · Dart" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const { userId, profile } = await getMember();
  const rating = await ratingFor(userId);
  const phone = profile.phone?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-action text-xl font-extrabold text-white">
          {(profile.full_name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2)}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{profile.full_name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted">
            <BadgeCheck className="size-4 text-lime-500" /> {profile.email}
          </p>
        </div>
      </div>

      <Card className="mt-5 grid grid-cols-2 divide-x divide-line py-4 text-center">
        <div>
          <p className="flex items-center justify-center gap-1 text-xl font-extrabold">
            <Star className="size-5 fill-lime-400 text-lime-500" /> {rating.avg ? rating.avg.toFixed(1) : "—"}
          </p>
          <p className="text-xs font-semibold text-muted">{rating.count} ratings</p>
        </div>
        <div>
          <p className="text-xl font-extrabold">{profile.dorm}</p>
          <p className="text-xs font-semibold text-muted">Dorm</p>
        </div>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card className="divide-y divide-line">
        <Row label="Phone" value={phone ?? "—"} />
        <Row label="Order texts" value={profile.sms_consent_at ? "On" : "Off"} />
        <Link href="/run/setup" className="flex items-center justify-between p-4">
          <span className="font-semibold">Runner setup</span>
          <span className="flex items-center gap-1 text-sm text-muted">
            {isRunnerReady(profile) ? "Ready" : "Not set up"} <ChevronRight className="size-4" />
          </span>
        </Link>
      </Card>

      <SectionTitle>Venmo &amp; Zelle</SectionTitle>
      <PayAccountsEditor initialVenmo={profile.venmo_username ?? ""} initialZelle={profile.zelle_contact ? formatZelle(profile.zelle_contact) : ""} />

      <SectionTitle>Notifications</SectionTitle>
      <Card className="p-4">
        <PushButton variant="secondary" />
      </Card>

      <SectionTitle>More</SectionTitle>
      <Card className="divide-y divide-line">
        <Link href="/terms" className="flex items-center gap-3 p-4 font-semibold">
          <FileText className="size-5 text-muted" /> Terms of Service <ChevronRight className="ml-auto size-4 text-muted" />
        </Link>
        {profile.is_admin ? (
          <Link href="/admin" className="flex items-center gap-3 p-4 font-semibold">
            <LayoutDashboard className="size-5 text-muted" /> Team dashboard <ChevronRight className="ml-auto size-4 text-muted" />
          </Link>
        ) : null}
      </Card>

      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary" full>
          Sign out
        </Button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="font-semibold">{label}</span>
      <span className="text-sm text-muted">{value}</span>
    </div>
  );
}
