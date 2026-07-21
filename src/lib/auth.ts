// Identity layer. Two implementations behind ONE async Auth interface:
//   • LocalAuth   — mock on localStorage (this file), used when Supabase is unset.
//   • SupabaseAuth — real magic-link + DB (auth.supabase.ts), used when configured.
// `auth` is picked by `supabaseConfigured`; screens only ever `await auth.*`.
//
// Two distinct "people" concepts, kept separate on purpose:
//   • Member  = a CAREGIVER who can sign in and co-manage (owner/editor/viewer).
//   • Profile = a PATIENT whose records are tracked (lives in repo.ts).
import type { Auth } from "./authInterface";
import { SupabaseAuth } from "./auth.supabase";
import { supabaseConfigured } from "./supabase";

export type Role = "owner" | "editor" | "viewer";

export type User = { id: string; email: string; name?: string };
export type Household = { id: string; name: string };
export type Member = {
  id: string;
  household_id: string;
  user_id?: string; // set once the person has actually signed in
  name: string;
  email: string;
  role: Role;
  status: "active" | "pending"; // pending = invited, not yet accepted
};
export type Invitation = {
  id: string;
  household_id: string;
  email: string;
  role: Role;
  token: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type Session = { user: User; household_id: string } | null;

type Store = {
  user: User | null;
  household: Household | null;
  members: Member[];
  invitations: Invitation[];
  sessionActive: boolean;
  previewRole?: Role;
};

// Privilege order — used to keep preview a downgrade, never an escalation.
const RANK: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };

const KEY = "family_pal_identity";
const EMPTY: Store = { user: null, household: null, members: [], invitations: [], sessionActive: false };

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

function read(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? { ...EMPTY, ...(JSON.parse(v) as Store) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}
function write(s: Store) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(s));
}

const defaultHouseholdName = (email: string) => {
  const who = (email.split("@")[0] || "My").replace(/[._-]+/g, " ").trim();
  const cap = who.charAt(0).toUpperCase() + who.slice(1);
  return `${cap}'s Family`;
};

// Mock identity on localStorage — same behavior as before, now async to match the
// interface Supabase needs. Preview is stored raw; effectiveRole clamps it so it
// can only ever downgrade (never grant more power than the real role).
class LocalAuth implements Auth {
  async getSession(): Promise<Session> {
    const s = read();
    return s.sessionActive && s.user && s.household ? { user: s.user, household_id: s.household.id } : null;
  }

  // Mock ignores the password (no credential store) — it just establishes a
  // session and creates the user + household on first use, like the real signup.
  async signIn(email: string, _password: string): Promise<void> {
    const s = read();
    const addr = email.trim().toLowerCase();
    let { user, household, members } = s;
    if (!user) {
      user = { id: uid(), email: addr };
      household = { id: uid(), name: defaultHouseholdName(addr) };
      members = [{ id: uid(), household_id: household.id, user_id: user.id, name: addr, email: addr, role: "owner", status: "active" }];
    }
    write({ ...s, user, household, members, sessionActive: true });
  }
  async signUp(email: string, password: string): Promise<void> {
    return this.signIn(email, password);
  }
  async signOut(): Promise<void> {
    write({ ...read(), sessionActive: false, previewRole: undefined });
  }
  // Mock has no external auth stream; nothing to subscribe to.
  onAuthChange(_cb: () => void): () => void {
    return () => {};
  }

  async currentRole(): Promise<Role | null> {
    const s = read();
    if (!s.sessionActive || !s.user) return null;
    return s.members.find((m) => m.user_id === s.user!.id)?.role ?? null;
  }
  previewRole(): Role | null {
    return read().previewRole ?? null;
  }
  setPreviewRole(role: Role | null): void {
    write({ ...read(), previewRole: role ?? undefined });
  }
  async effectiveRole(): Promise<Role | null> {
    const real = await this.currentRole();
    if (!real) return null;
    const p = read().previewRole;
    return p && RANK[p] <= RANK[real] ? p : real;
  }

  async getHousehold(): Promise<Household | null> {
    return read().household;
  }
  async updateHouseholdName(name: string): Promise<void> {
    const s = read();
    if (!s.household) return;
    write({ ...s, household: { ...s.household, name: name.trim() || s.household.name } });
  }
  async setOwnerName(name: string): Promise<void> {
    const s = read();
    if (!s.user) return;
    const user = { ...s.user, name };
    write({ ...s, user, members: s.members.map((m) => (m.user_id === user.id ? { ...m, name } : m)) });
  }

  // Mock has a single household; switching is a no-op.
  async listHouseholds(): Promise<Array<{ id: string; name: string; role: Role }>> {
    const s = read();
    return s.household ? [{ id: s.household.id, name: s.household.name, role: "owner" }] : [];
  }
  activeHouseholdId(): string | null {
    return read().household?.id ?? null;
  }
  setActiveHousehold(_id: string): void {
    /* single household — nothing to switch */
  }

  async listMembers(): Promise<Member[]> {
    return read().members;
  }
  async listInvitations(): Promise<Invitation[]> {
    return read().invitations.filter((i) => i.status === "pending");
  }
  async invite(email: string, role: Role): Promise<Invitation> {
    const s = read();
    if (!s.household) throw new Error("no household");
    const addr = email.trim().toLowerCase();
    const invitation: Invitation = {
      id: uid(), household_id: s.household.id, email: addr, role, token: uid(),
      status: "pending", created_at: new Date().toISOString(),
    };
    const member: Member = { id: uid(), household_id: s.household.id, name: addr, email: addr, role, status: "pending" };
    write({ ...s, invitations: [...s.invitations, invitation], members: [...s.members, member] });
    return invitation;
  }
  async getInvitation(token: string): Promise<(Invitation & { household_name: string }) | null> {
    const s = read();
    const inv = s.invitations.find((i) => i.token === token);
    if (!inv || !s.household) return null;
    return { ...inv, household_name: s.household.name };
  }
  async acceptInvite(token: string): Promise<void> {
    const s = read();
    const inv = s.invitations.find((i) => i.token === token && i.status === "pending");
    if (!inv) return;
    write({
      ...s,
      invitations: s.invitations.map((i) => (i.id === inv.id ? { ...i, status: "accepted" as const } : i)),
      members: s.members.map((m) => (m.email === inv.email && m.status === "pending" ? { ...m, status: "active" as const } : m)),
    });
  }
  async setMemberRole(id: string, role: Role): Promise<void> {
    const s = read();
    write({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) });
  }
  async removeMember(id: string): Promise<void> {
    const s = read();
    const m = s.members.find((x) => x.id === id);
    write({
      ...s,
      members: s.members.filter((x) => x.id !== id),
      invitations: m ? s.invitations.filter((i) => !(i.email === m.email && i.status === "pending")) : s.invitations,
    });
  }
}

// Backend selection — the whole app flips here based on env.
export const auth: Auth = supabaseConfigured ? new SupabaseAuth() : new LocalAuth();
