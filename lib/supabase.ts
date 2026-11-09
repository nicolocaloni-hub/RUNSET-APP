import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null when the deploy is missing its Supabase configuration. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;

export function client(): SupabaseClient {
  if (!supabase) throw new Error("config_missing");
  return supabase;
}
