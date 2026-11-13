import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, the PWA files and the cron endpoint.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|pwa-icon|api/cron|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
