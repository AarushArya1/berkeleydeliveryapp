"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClientValue } from "@/lib/use-client-value";
import { ListChecks, Plus, Search, ShoppingBag, UserRound } from "lucide-react";
import { Logo } from "./logo";

type Mode = "requester" | "runner";

const readModeCookie = (): Mode =>
  (document.cookie.match(/(?:^|; )dart_mode=(requester|runner)/)?.[1] as Mode | undefined) ?? "requester";

function useMode(): Mode {
  const path = usePathname();
  const stored = useClientValue(readModeCookie, "requester");
  if (path.startsWith("/run")) return "runner";
  if (path.startsWith("/wishlist")) return "requester";
  return stored;
}

export function TopBar() {
  const mode = useMode();
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href={mode === "runner" ? "/run" : "/wishlist"} aria-label="Dart home">
          <Logo size={28} />
        </Link>
        <div className="flex rounded-full bg-lime-50 p-1 text-sm font-bold" role="tablist" aria-label="Switch role">
          {(
            [
              ["requester", "Request", "/wishlist"],
              ["runner", "Run", "/run"],
            ] as const
          ).map(([m, label, href]) => (
            <Link
              key={m}
              href={href}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                document.cookie = `dart_mode=${m}; path=/; max-age=31536000; samesite=lax`;
              }}
              className={clsx(
                "rounded-full px-4 py-1.5 transition-colors",
                mode === m ? "bg-white text-ink shadow-sm" : "text-muted",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  const mode = useMode();
  const tabs =
    mode === "runner"
      ? [
          { href: "/run", label: "Find", icon: Search, match: (p: string) => p === "/run" },
          { href: "/run/jobs", label: "My runs", icon: ShoppingBag, match: (p: string) => p.startsWith("/run/jobs") },
          { href: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
        ]
      : [
          { href: "/wishlist", label: "My list", icon: ListChecks, match: (p: string) => p === "/wishlist" },
          { href: "/wishlist/new", label: "Add", icon: Plus, match: (p: string) => p === "/wishlist/new", primary: true },
          { href: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
        ];

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto grid max-w-md grid-cols-3 px-4 pt-1.5">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          if ("primary" in t && t.primary) {
            return (
              <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 py-1" aria-label="Add to shopping list">
                <span className="-mt-5 flex size-13 items-center justify-center rounded-full bg-action text-white shadow-float ring-4 ring-white">
                  <Icon className="size-6" strokeWidth={2.6} />
                </span>
                <span className={clsx("text-[11px] font-bold", active ? "text-action" : "text-muted")}>{t.label}</span>
              </Link>
            );
          }
          return (
            <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 py-1.5">
              <Icon className={clsx("size-6", active ? "text-action" : "text-muted")} strokeWidth={active ? 2.5 : 2} />
              <span className={clsx("text-[11px] font-bold", active ? "text-action" : "text-muted")}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Static shells shown while the path-dependent bars stream in.
export function TopBarFallback() {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-md items-center px-4">
        <Logo size={28} />
      </div>
    </header>
  );
}

export function BottomNavFallback() {
  return <div className="pb-safe fixed inset-x-0 bottom-0 z-30 h-16 border-t border-line/70 bg-white/90" />;
}
