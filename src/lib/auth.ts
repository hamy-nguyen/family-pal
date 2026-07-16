// Identity layer — MOCK for Phase 1, but shaped like the real thing so Phase 2
// swaps in Supabase behind the same surface (mirrors supabase/schema.sql:
// households, household_members, invitations).
//
// Two distinct "people" concepts, kept separate on purpose:
//   • Member  = a CAREGIVER who can sign in and co-manage (owner/editor/viewer).
//   • Profile = a PATIENT whose records are tracked (lives in repo.ts).
// Co-management = multiple members sharing one household's profiles + visits.

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
  pendingEmail?: string; // email awaiting the "magic link" tap
  previewRole?: Role; // owner-only "view as" override (demo aid)
};

// Privilege order — used to keep preview a downgrade, never an escalation.
const RANK: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };

const KEY = "family_pal_identity";
const EMPTY: Store = {
  user: null,
  household: null,
  members: [],
  invitations: [],
  sessionActive: false,
};

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

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

// Default household name — frictionless: no naming step at onboarding, editable
// later in Household settings. Personalized once we know the caregiver's name.
const defaultHouseholdName = (email: string) => {
  const who = (email.split("@")[0] || "My").replace(/[._-]+/g, " ").trim();
  const cap = who.charAt(0).toUpperCase() + who.slice(1);
  return `${cap}'s Family`;
};

export const auth = {
  getSession(): Session {
    const s = read();
    return s.sessionActive && s.user && s.household
      ? { user: s.user, household_id: s.household.id }
      : null;
  },

  // "Send magic link" — mock just remembers which email is signing in.
  requestSignIn(email: string) {
    const s = read();
    write({ ...s, pendingEmail: email.trim().toLowerCase() });
  },
  pendingEmail(): string | undefined {
    return read().pendingEmail;
  },

  // "Tap the magic link" — first time creates the user + their household (owner).
  completeSignIn(email?: string): Session {
    const s = read();
    const addr = (email ?? s.pendingEmail ?? "").trim().toLowerCase();
    if (!addr) return null;

    let { user, household, members } = s;
    if (!user) {
      user = { id: uid(), email: addr };
      household = { id: uid(), name: defaultHouseholdName(addr) };
      members = [
        { id: uid(), household_id: household.id, user_id: user.id, name: addr, email: addr, role: "owner", status: "active" },
      ];
    }
    const next: Store = { ...s, user, household, members, sessionActive: true, pendingEmail: undefined };
    write(next);
    return auth.getSession();
  },

  signOut() {
    // Keep the data; just drop the active session (sign back in restores it).
    write({ ...read(), sessionActive: false, pendingEmail: undefined, previewRole: undefined });
  },

  // The acting caregiver's REAL role (from their member row).
  currentRole(): Role | null {
    const s = read();
    if (!s.sessionActive || !s.user) return null;
    return s.members.find((m) => m.user_id === s.user!.id)?.role ?? null;
  },
  previewRole(): Role | null {
    return read().previewRole ?? null;
  },
  // Preview is a demo aid: only the owner may use it, and only to see a role at
  // or below their own — you can never grant yourself more power than you have.
  setPreviewRole(role: Role | null) {
    const s = read();
    const real = auth.currentRole();
    const ok = !!role && !!real && RANK[role] <= RANK[real];
    write({ ...s, previewRole: ok ? role! : undefined });
  },
  // The role actually in force = real role, optionally downgraded by preview.
  effectiveRole(): Role | null {
    const real = auth.currentRole();
    if (!real) return null;
    const p = read().previewRole;
    return p && RANK[p] <= RANK[real] ? p : real;
  },

  getHousehold(): Household | null {
    return read().household;
  },
  updateHouseholdName(name: string) {
    const s = read();
    if (!s.household) return;
    write({ ...s, household: { ...s.household, name: name.trim() || s.household.name } });
  },

  // Called after the "self" profile is created: give the owner caregiver a real
  // name (until now it was their email).
  setOwnerName(name: string) {
    const s = read();
    if (!s.user) return;
    const user = { ...s.user, name };
    const members = s.members.map((m) =>
      m.user_id === user.id ? { ...m, name } : m
    );
    write({ ...s, user, members });
  },

  listMembers(): Member[] {
    return read().members;
  },
  listInvitations(): Invitation[] {
    return read().invitations.filter((i) => i.status === "pending");
  },

  invite(email: string, role: Exclude<Role, "owner">): Invitation {
    const s = read();
    if (!s.household) throw new Error("no household");
    const addr = email.trim().toLowerCase();
    const invitation: Invitation = {
      id: uid(),
      household_id: s.household.id,
      email: addr,
      role,
      token: uid(),
      status: "pending",
      created_at: new Date().toISOString(),
    };
    // Surface the invitee in the roster immediately as a pending member.
    const member: Member = {
      id: uid(),
      household_id: s.household.id,
      name: addr,
      email: addr,
      role,
      status: "pending",
    };
    write({ ...s, invitations: [...s.invitations, invitation], members: [...s.members, member] });
    return invitation;
  },

  getInvitation(token: string): (Invitation & { household_name: string }) | null {
    const s = read();
    const inv = s.invitations.find((i) => i.token === token);
    if (!inv || !s.household) return null;
    return { ...inv, household_name: s.household.name };
  },

  // Demo-accept the invite loop on this device (Phase 2: the invitee does this
  // on their own device after real magic-link sign-in).
  acceptInvite(token: string) {
    const s = read();
    const inv = s.invitations.find((i) => i.token === token && i.status === "pending");
    if (!inv) return;
    write({
      ...s,
      invitations: s.invitations.map((i) => (i.id === inv.id ? { ...i, status: "accepted" as const } : i)),
      members: s.members.map((m) =>
        m.email === inv.email && m.status === "pending" ? { ...m, status: "active" as const } : m
      ),
    });
  },

  setMemberRole(id: string, role: Role) {
    const s = read();
    write({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) });
  },
  removeMember(id: string) {
    const s = read();
    const m = s.members.find((x) => x.id === id);
    write({
      ...s,
      members: s.members.filter((x) => x.id !== id),
      invitations: m ? s.invitations.filter((i) => !(i.email === m.email && i.status === "pending")) : s.invitations,
    });
  },
};
