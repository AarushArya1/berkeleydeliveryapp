// Supabase connection settings, read at request time.
//
// Next.js bakes NEXT_PUBLIC_* values in at build time (in server code too), so
// on Cloudflare, where variables are set on the Worker at runtime, the plain
// names (SUPABASE_URL, SUPABASE_ANON_KEY...) are what actually get read. Both
// are accepted so local .env.local files keep working.

/** Project URL without a trailing "/rest/v1/" (the dashboard often copies it with one). */
export function normalizeSupabaseUrl(url: string | undefined) {
  return (url ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function supabaseUrl() {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

/** The publishable (or legacy anon) key: safe to send to the browser. */
export function supabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabasePublicKey());
}

/** VAPID public key for web push: also public. */
export function vapidPublicKey() {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "").trim();
}
