// Dormant Supabase browser client — wired but unused until you switch the repo.
// WHY kept separate: repo.ts decides the backend; this file only knows *how* to
// talk to Supabase, not *whether* to. Activate by implementing a SupabaseRepo
// in repo.ts that uses this client when env vars are present.
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

export function supabaseClient() {
  if (!supabaseConfigured)
    throw new Error("Supabase env not set — using localStorage backend.");
  return createBrowserClient(url!, anon!);
}
