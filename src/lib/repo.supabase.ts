// Supabase-backed data layer — the real Phase 2 implementation of the Repo
// interface. Reads use PostgREST embedding to pull a visit + its children in one
// round-trip; writes go through the atomic save_visit / update_visit RPCs.
// NOT wired in yet — repo.ts still returns LocalRepo until activation.
//
// ⚠ Written against supabase/schema.sql but untested against a live project.
import { supabaseClient } from "./supabase";
import { getActiveHouseholdId } from "./household";
import { IMAGE_BUCKET } from "./uploadImage";
import type { Repo, NewProfileInput } from "./repo";
import type { Profile, Visit, NewVisitInput, ProfileGrant, GrantRole } from "./types";

// One query string that embeds every child list + the profile name.
const VISIT_SELECT =
  "*, profiles(name), medications(*), supplements(*), investigations(*), attachments(*)";

// Supabase errors are plain objects (not Error instances), so throwing them raw
// renders as "[object Object]" and hides the real cause. Convert to a real Error
// with the message + details/hint/code so failures are legible.
function fail(e: { message?: string; details?: string; hint?: string; code?: string }): never {
  const parts = [e.message, e.details, e.hint, e.code ? `(${e.code})` : ""].filter(Boolean);
  throw new Error(parts.join(" · ") || "Supabase request failed");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVisit(row: any): Visit {
  return {
    ...row,
    profile_name: row.profiles?.name,
    medications: row.medications ?? [],
    supplements: row.supplements ?? [],
    investigations: row.investigations ?? [],
    attachments: row.attachments ?? [],
  } as Visit;
}

export class SupabaseRepo implements Repo {
  private sb = supabaseClient();

  // Stored image_url values are private Storage object PATHS. Turn them into
  // short-lived signed URLs so <img src> works, without making the bucket public.
  private async signVisits(visits: Visit[]): Promise<Visit[]> {
    const isKey = (u?: string) => !!u && !u.startsWith("http") && !u.startsWith("data:");
    const keys = new Set<string>();
    for (const v of visits) {
      for (const a of v.attachments) if (isKey(a.image_url)) keys.add(a.image_url);
      for (const iv of v.investigations) if (isKey(iv.image_url)) keys.add(iv.image_url!);
    }
    if (keys.size === 0) return visits;
    const list = [...keys];
    const { data } = await this.sb.storage.from(IMAGE_BUCKET).createSignedUrls(list, 3600);
    const map = new Map<string, string>();
    (data ?? []).forEach((d, i) => { if (d.signedUrl) map.set(list[i], d.signedUrl); });
    const sign = (u?: string) => (u && map.get(u)) || u;
    return visits.map((v) => ({
      ...v,
      attachments: v.attachments.map((a) => ({ ...a, image_url: sign(a.image_url) as string })),
      investigations: v.investigations.map((iv) => ({ ...iv, image_url: sign(iv.image_url) })),
    }));
  }

  // --- profiles ---
  async listProfiles(): Promise<Profile[]> {
    const { data } = await this.sb.from("profiles").select("*").order("created_at", { ascending: true });
    return (data ?? []) as Profile[];
  }
  async getProfile(id: string): Promise<Profile | null> {
    const { data } = await this.sb.from("profiles").select("*").eq("id", id).maybeSingle();
    return (data as Profile) ?? null;
  }
  // The household a new profile should be created in. WHY not pickHousehold: that
  // returns the ACTIVE household regardless of role, so if you're currently viewing a
  // family you were invited into (viewer/editor), inserting there fails RLS. A profile
  // must land in a household you can WRITE to — prefer the active one if writable, else
  // one you own, else any writable one.
  private async writableHouseholdId(): Promise<string | null> {
    const { data: s } = await this.sb.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data } = await this.sb.from("household_members").select("household_id, role").eq("user_id", uid);
    const rows = (data ?? []) as { household_id: string; role: string }[];
    const writable = rows.filter((r) => r.role === "owner" || r.role === "editor");
    const active = getActiveHouseholdId();
    return (
      writable.find((r) => r.household_id === active)?.household_id ??
      writable.find((r) => r.role === "owner")?.household_id ??
      writable[0]?.household_id ??
      null
    );
  }

  async createProfile(input: NewProfileInput, opts?: { own?: boolean }): Promise<Profile> {
    // WHY an RPC (not a direct insert): profile creation goes through a SECURITY
    // DEFINER function — same pattern as save_visit — which does the permission check
    // in-function and inserts server-side, avoiding the RLS WITH CHECK path that was
    // denying valid inserts in this environment.
    // own = account-owned (your self-profile); otherwise household-owned (a writable one).
    const p: Record<string, unknown> = { ...input };
    if (!opts?.own) {
      const hid = await this.writableHouseholdId();
      if (!hid) throw new Error("You don't have a household you can add a profile to.");
      p.owner_household_id = hid;
    }
    const { data, error } = await this.sb.rpc("create_profile", { p, as_own: !!opts?.own });
    if (error) fail(error);
    return data as Profile;
  }
  async updateProfile(p: Profile): Promise<Profile> {
    // WHY an explicit patch: sending the whole Profile would push owner_* (possibly
    // undefined) and could clear ownership, breaking the one-owner constraint. Only
    // the editable fields are updated here.
    const patch = {
      name: p.name, relationship: p.relationship,
      date_of_birth: p.date_of_birth ?? null, sex: p.sex ?? null,
      color_index: p.color_index, blood_type: p.blood_type ?? null,
      allergies: p.allergies ?? null, chronic_conditions: p.chronic_conditions ?? null,
      notes: p.notes ?? null,
    };
    const { data, error } = await this.sb.from("profiles").update(patch).eq("id", p.id).select("*").single();
    if (error) fail(error);
    return data as Profile;
  }
  async deleteProfile(id: string): Promise<void> {
    // Via RPC (SECURITY DEFINER) — checks you own the profile / are owner-editor of its
    // household, then deletes (visits + grants cascade). Surfaces errors, unlike the old
    // direct delete which silently no-op'd when RLS refused.
    const { error } = await this.sb.rpc("delete_profile", { pid: id });
    if (error) fail(error);
  }

  // --- visits (+ children) ---
  async listVisits(): Promise<Visit[]> {
    const { data } = await this.sb.from("visits").select(VISIT_SELECT).order("created_at", { ascending: false });
    return this.signVisits((data ?? []).map(toVisit));
  }
  async getVisit(id: string): Promise<Visit | null> {
    const { data } = await this.sb.from("visits").select(VISIT_SELECT).eq("id", id).maybeSingle();
    if (!data) return null;
    return (await this.signVisits([toVisit(data)]))[0];
  }
  async saveVisit(input: NewVisitInput): Promise<Visit> {
    const { data: vid, error } = await this.sb.rpc("save_visit", { p: input });
    if (error) fail(error);
    const v = await this.getVisit(vid as string);
    if (!v) throw new Error("save_visit: could not read back");
    return v;
  }
  async updateVisit(v: Visit): Promise<Visit> {
    const { error } = await this.sb.rpc("update_visit", { p: v });
    if (error) fail(error);
    const next = await this.getVisit(v.id);
    if (!next) throw new Error("update_visit: could not read back");
    return next;
  }
  async deleteVisit(id: string): Promise<void> {
    await this.sb.from("visits").delete().eq("id", id);
  }

  // --- grants + ownership (RLS enforces: only the profile's owner may manage grants) ---
  async listGrants(profileId: string): Promise<ProfileGrant[]> {
    const { data, error } = await this.sb
      .from("profile_grants")
      .select("id, profile_id, grantee_household_id, grantee_account_id, role, created_at, expires_at, households(name)")
      .eq("profile_id", profileId);
    if (error) fail(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((g: any) => ({
      id: g.id, profile_id: g.profile_id,
      grantee_household_id: g.grantee_household_id ?? undefined,
      grantee_account_id: g.grantee_account_id ?? undefined,
      grantee_household_name: g.households?.name,
      role: g.role as GrantRole, created_at: g.created_at, expires_at: g.expires_at ?? undefined,
    }));
  }
  async grantProfileToHousehold(profileId: string, householdId: string, role: GrantRole): Promise<void> {
    const { error } = await this.sb.from("profile_grants").insert({ profile_id: profileId, grantee_household_id: householdId, role });
    if (error) fail(error);
  }
  async revokeGrant(grantId: string): Promise<void> {
    const { error } = await this.sb.from("profile_grants").delete().eq("id", grantId);
    if (error) fail(error);
  }
  async transferProfileOwnership(profileId: string, to: { accountId: string } | { householdId: string }): Promise<void> {
    // Graduation / adoption: flip ownership to an account or a household (the CHECK keeps exactly one set).
    const patch = "accountId" in to
      ? { owner_account_id: to.accountId, owner_household_id: null }
      : { owner_household_id: to.householdId, owner_account_id: null };
    const { error } = await this.sb.from("profiles").update(patch).eq("id", profileId);
    if (error) fail(error);
  }
}
