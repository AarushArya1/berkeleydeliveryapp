import { Suspense } from "react";
import { BottomNav, BottomNavFallback, TopBar, TopBarFallback } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-lime-50 via-white to-white">
      <Suspense fallback={<TopBarFallback />}>
        <TopBar />
      </Suspense>
      <main className="mx-auto max-w-md pb-32">{children}</main>
      <Suspense fallback={<BottomNavFallback />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
