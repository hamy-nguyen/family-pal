// Data layer. Phase 1: localStorage only (no accounts needed). Phase 2 adds a
// SupabaseRepo behind the same interface, selected by env. Screens only ever
// see this interface, never the backend.

import type { Profile, Visit, NewVisitInput } from "./types";
import { auth } from "./auth";
import { can, type Capability } from "./permissions";
import { supabaseConfigured } from "./supabase";
import { SupabaseRepo } from "./repo.supabase";

export type NewProfileInput = Omit<Profile, "id" | "created_at">;

// Defense in depth: the UI hides what you can't do, but every write also checks
// the acting role here so a viewer can't mutate by any path. Phase 2: the same
// guarantee comes from Postgres RLS (supabase/schema.sql).
async function assertCan(cap: Capability) {
  if (!can(await auth.effectiveRole(), cap)) {
    throw new Error(`Not permitted: ${cap}`);
  }
}

export interface Repo {
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | null>;
  createProfile(input: NewProfileInput): Promise<Profile>;
  updateProfile(p: Profile): Promise<Profile>;
  deleteProfile(id: string): Promise<void>; // also removes that profile's visits

  listVisits(): Promise<Visit[]>;
  getVisit(id: string): Promise<Visit | null>;
  saveVisit(input: NewVisitInput): Promise<Visit>;
  updateVisit(v: Visit): Promise<Visit>;
  deleteVisit(id: string): Promise<void>;
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const LS_PROFILES = "family_pal_profiles";
const LS_VISITS = "family_pal_visits";

class LocalRepo implements Repo {
  private read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const v = window.localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write<T>(key: string, val: T) {
    window.localStorage.setItem(key, JSON.stringify(val));
  }

  // ---- profiles ----
  async listProfiles(): Promise<Profile[]> {
    return this.read<Profile[]>(LS_PROFILES, []);
  }
  async getProfile(id: string): Promise<Profile | null> {
    return (await this.listProfiles()).find((p) => p.id === id) ?? null;
  }
  async createProfile(input: NewProfileInput): Promise<Profile> {
    await assertCan("profiles:manage");
    const all = await this.listProfiles();
    const profile: Profile = {
      ...input,
      id: uid(),
      // stable colour: next index if not provided
      color_index: input.color_index ?? all.length,
      created_at: new Date().toISOString(),
    };
    this.write(LS_PROFILES, [...all, profile]);
    return profile;
  }
  async updateProfile(p: Profile): Promise<Profile> {
    await assertCan("profiles:manage");
    const all = await this.listProfiles();
    this.write(
      LS_PROFILES,
      all.map((x) => (x.id === p.id ? p : x))
    );
    return p;
  }
  async deleteProfile(id: string): Promise<void> {
    await assertCan("profiles:manage");
    this.write(
      LS_PROFILES,
      (await this.listProfiles()).filter((p) => p.id !== id)
    );
    this.write(
      LS_VISITS,
      (await this.listVisits()).filter((v) => v.profile_id !== id)
    );
  }

  // ---- visits (with children inline) ----
  // Normalize on read so older/partial records never crash screens that map
  // over the child arrays.
  private norm(v: Visit): Visit {
    return {
      ...v,
      medications: v.medications ?? [],
      supplements: v.supplements ?? [],
      investigations: v.investigations ?? [],
      attachments: v.attachments ?? [],
    };
  }
  async listVisits(): Promise<Visit[]> {
    return this.read<Visit[]>(LS_VISITS, []).map((v) => this.norm(v));
  }
  async getVisit(id: string): Promise<Visit | null> {
    const v = this.read<Visit[]>(LS_VISITS, []).find((x) => x.id === id);
    return v ? this.norm(v) : null;
  }
  async saveVisit(input: NewVisitInput): Promise<Visit> {
    await assertCan("records:create");
    const profiles = await this.listProfiles();
    const withIds = <T extends { id?: string }>(rows: T[]) =>
      (rows ?? []).map((r) => ({ ...r, id: r.id ?? uid() }));
    const visit: Visit = {
      ...input,
      id: uid(),
      profile_name: profiles.find((p) => p.id === input.profile_id)?.name,
      medications: withIds(input.medications),
      supplements: withIds(input.supplements),
      investigations: withIds(input.investigations),
      attachments: withIds(input.attachments),
      created_at: new Date().toISOString(),
    };
    this.write(LS_VISITS, [visit, ...(await this.listVisits())]);
    return visit;
  }
  async updateVisit(v: Visit): Promise<Visit> {
    await assertCan("records:edit");
    const profiles = await this.listProfiles();
    const next = this.norm({
      ...v,
      profile_name: profiles.find((p) => p.id === v.profile_id)?.name,
    });
    this.write(
      LS_VISITS,
      this.read<Visit[]>(LS_VISITS, []).map((x) => (x.id === v.id ? next : x))
    );
    return next;
  }
  async deleteVisit(id: string): Promise<void> {
    await assertCan("records:delete");
    this.write(
      LS_VISITS,
      (await this.listVisits()).filter((v) => v.id !== id)
    );
  }
}

// ---- backend selection ----
// Supabase when configured (RLS is the real enforcement), else the local mock.
let _repo: Repo | null = null;
export function repo(): Repo {
  if (_repo) return _repo;
  _repo = supabaseConfigured ? new SupabaseRepo() : new LocalRepo();
  return _repo;
}
