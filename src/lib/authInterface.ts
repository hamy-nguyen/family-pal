// The auth/identity surface, as an async interface. SupabaseAuth implements this
// now; at activation the mock (auth.ts) is adapted to it too and `auth` is
// selected by `supabaseConfigured` — screens just `await` the same methods.
//
// Sync-returning members (previewRole/setPreviewRole) are UI-only concerns
// (a client-side "view as" override) and never touch the network or affect RLS.
import type { Role, User, Household, Member, Invitation, Session } from "./auth";

export type { Role, User, Household, Member, Invitation, Session };

export interface Auth {
  getSession(): Promise<Session>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  // fires on sign in/out + token refresh; returns an unsubscribe fn
  onAuthChange(cb: () => void): () => void;

  currentRole(): Promise<Role | null>;
  previewRole(): Role | null;
  setPreviewRole(role: Role | null): void;
  effectiveRole(): Promise<Role | null>;

  getHousehold(): Promise<Household | null>;
  updateHouseholdName(name: string): Promise<void>;
  setOwnerName(name: string): Promise<void>;

  // households the user belongs to (own + invited), + switching between them
  listHouseholds(): Promise<Array<{ id: string; name: string; role: Role }>>;
  activeHouseholdId(): string | null;
  setActiveHousehold(id: string): void;

  listMembers(): Promise<Member[]>;
  listInvitations(): Promise<Invitation[]>;
  invite(email: string, role: Exclude<Role, "owner">): Promise<Invitation>;
  getInvitation(token: string): Promise<(Invitation & { household_name: string }) | null>;
  acceptInvite(token: string): Promise<void>;
  setMemberRole(id: string, role: Role): Promise<void>;
  removeMember(id: string): Promise<void>;
}
