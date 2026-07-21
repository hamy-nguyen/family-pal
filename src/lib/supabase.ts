// Dormant Supabase browser client — wired but unused until you switch the repo.
// WHY kept separate: repo.ts decides the backend; this file only knows *how* to
// talk to Supabase, not *whether* to. Activate by implementing a SupabaseRepo
// in repo.ts that uses this client when env vars are present.
import { createBrowserClient } from "@supabase/ssr";

// Accept either the newer "publishable" key name (sb_publishable_…) or the legacy
// "anon" name — both are the browser-safe key and are drop-in equivalents for the
// client. The SECRET/service key must never appear here (it bypasses RLS).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export function supabaseClient() {
  if (!supabaseConfigured)
    throw new Error("Supabase env not set — using localStorage backend.");
  // persistSession -> the token survives closing/reopening the PWA;
  // autoRefreshToken -> it's refreshed before expiry so long-idle sessions stay valid;
  // detectSessionInUrl: true -> the email-confirmation link auto-establishes a session,
  //   so clicking it logs the user in immediately (then onboarding) — no re-entering creds.
  // createBrowserClient is a per-(url,key) singleton in the browser, so repeated calls
  // share one session + one refresh timer.
  return createBrowserClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
