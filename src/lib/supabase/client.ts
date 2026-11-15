import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "../public-env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (async: settings may come from the server at runtime). */
export async function createClient() {
  if (client) return client;
  const { supabaseUrl, supabaseKey } = await publicEnv();
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase isn't configured");
  client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
