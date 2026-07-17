// The "active household" — which family the signed-in user is currently viewing.
// A user can belong to several: their OWN (created at signup) plus any they've
// been invited into. This localStorage value picks which one is in force; every
// household-scoped query (data + role) resolves through it.
const ACTIVE_KEY = "family_pal_active_household";

export function getActiveHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveHouseholdId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

// Given the memberships a user holds, pick the active one: honor the stored
// choice if they still belong to it, else default to the household they OWN
// (their own family), else the first.
export function pickHousehold<T extends { household_id: string; role: string }>(rows: T[]): string | null {
  if (!rows || rows.length === 0) return null;
  const active = getActiveHouseholdId();
  if (active && rows.some((r) => r.household_id === active)) return active;
  return (rows.find((r) => r.role === "owner") ?? rows[0]).household_id;
}
