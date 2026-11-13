import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { getViewer, isOnboarded } from "@/lib/auth";
import { OnboardingFlow } from "./flow";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-lime-50">
          <LogoMark size={56} />
        </div>
      }
    >
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const { profile } = await getViewer();
  if (isOnboarded(profile)) redirect("/wishlist");
  return (
    <OnboardingFlow
      email={profile.email}
      initial={{ fullName: profile.full_name ?? "", dorm: profile.dorm ?? "", phone: profile.phone?.replace(/^\+1/, "") ?? "" }}
      done={{
        profile: Boolean(profile.full_name && profile.dorm && profile.phone && profile.sms_consent_at),
        homeScreen: Boolean(profile.home_screen_at),
        terms: Boolean(profile.tos_accepted_at),
      }}
    />
  );
}
