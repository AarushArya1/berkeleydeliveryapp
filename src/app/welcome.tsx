"use client";

import { ArrowRight, Bike, ShoppingBasket } from "lucide-react";
import { InstallGuide, useInstallState } from "@/components/install-guide";
import { Logo } from "@/components/logo";
import { ButtonLink, Card } from "@/components/ui";
import { FEES } from "@/lib/config";
import { money } from "@/lib/format";

export function Welcome() {
  const install = useInstallState();
  const needsInstall = install && !install.standalone && install.platform !== "desktop";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-lime-100 via-lime-50 to-white">
      <div className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8">
        <div className="pt-6">
          <Logo size={34} />
        </div>

        <div className="animate-rise mt-10">
          <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-ink">
            Need something?
            <br />
            <span className="text-action">Someone&apos;s already going.</span>
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Add it to your shopping list. A Berkeley student heading to the store picks it up and brings it to your dorm.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <ShoppingBasket className="size-6 text-action" />
            <p className="mt-3 font-bold leading-snug">Only pay what it costs</p>
            <p className="mt-1 text-sm text-muted">Your card is held, then charged the real receipt total.</p>
          </Card>
          <Card className="p-4">
            <Bike className="size-6 text-action" />
            <p className="mt-3 font-bold leading-snug">Earn {money(FEES.runnerFeeCents)} a run</p>
            <p className="mt-1 text-sm text-muted">Grab orders on trips you&apos;re already making.</p>
          </Card>
        </div>

        <div className="mt-auto pt-10">
          {needsInstall ? (
            <Card className="p-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-lime-700">First, add Dart to your home screen</p>
              <p className="mb-4 text-sm text-muted">So we can notify you the moment a runner picks up your order.</p>
              <InstallGuide platform={install.platform} />
              {process.env.NODE_ENV !== "production" ? (
                <ButtonLink href="/login" variant="ghost" size="sm" className="mt-4">
                  Continue in browser (dev only)
                </ButtonLink>
              ) : null}
            </Card>
          ) : (
            <div className="space-y-3">
              <ButtonLink href="/login" full size="lg">
                Get started with your @berkeley.edu <ArrowRight className="size-5" />
              </ButtonLink>
              <p className="text-center text-xs text-muted">Verified Berkeley students only.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
