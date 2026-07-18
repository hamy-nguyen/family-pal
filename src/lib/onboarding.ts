// Per-device "has the welcome pitch already been shown once" flag.
// WHY localStorage (not the account): welcome is a one-time intro, not an auth
// gate — it must work before any account exists, and it's fine for it to reappear
// on a fresh install / new device (that IS a first visit for that device).
// SSR-safe: the server render has no window, so it reports "not seen" and the
// client corrects on hydration.
const KEY = "family_pal_seen_welcome";

export function hasSeenWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked (private mode) — treat as unseen, harmless
  }
}

export function markWelcomeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked — welcome just shows again next time, no harm */
  }
}
