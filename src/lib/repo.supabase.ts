// Supabase-backed data layer — the real Phase 2 implementation of the Repo
// interface. Reads use PostgREST embedding to pull a visit + its children in one
// round-trip; writes go through the atomic save_visit / update_visit RPCs.
// NOT wired in yet — repo.ts still returns LocalRepo until activation.
//
// ⚠ Written against supabase/schema.sql but untested against a live project.
import { supabaseClient } from "./supabase";
import { pickHousehold } from "./household";
import { IMAGE_BUCKET } from "./uploadImage";
import type { Repo, NewProfileInput } from "./repo";
import type { Profile, Visit, NewVisitInput } from "./types";

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

  private async householdId(): Promise<string | null> {
    const { data: s } = await this.sb.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data } = await this.sb
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", uid);
    return pickHousehold(data ?? []); // honor the active-household choice
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
  async createProfile(input: NewProfileInput): Promise<Profile> {
    const hid = await this.householdId();
    if (!hid) throw new Error("no household");
    const { data, error } = await this.sb.from("profiles").insert({ ...input, household_id: hid }).select("*").single();
    if (error) fail(error);
    return data as Profile;
  }
  async updateProfile(p: Profile): Promise<Profile> {
    const { data, error } = await this.sb.from("profiles").update(p).eq("id", p.id).select("*").single();
    if (error) fail(error);
    return data as Profile;
  }
  async deleteProfile(id: string): Promise<void> {
    // visits cascade via the FK (on delete cascade) in schema.sql.
    await this.sb.from("profiles").delete().eq("id", id);
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
}
