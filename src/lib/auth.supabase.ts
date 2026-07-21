// Supabase-backed identity — the real Phase 2 implementation of the Auth
// interface. Magic-link sign-in, session, and household/members/invites read
// from the DB (RLS-scoped). NOT wired in yet — `auth.ts` still exports the mock
// until activation, when the selector flips to this when `supabaseConfigured`.
//
// ⚠ Written against the schema in supabase/schema.sql but not yet tested against
// a live project — expect a short round of fixes when we first connect.
import { supabaseClient } from "./supabase";
import { pickHousehold, getActiveHouseholdId, setActiveHouseholdId } from "./household";
import type { Auth } from "./authInterface";
import type { Role, Household, Member, Invitation, Session } from "./auth";

const RANK: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };
const PREVIEW_KEY = "family_pal_preview_role";

export class SupabaseAuth implements Auth {
  private sb = supabaseClient();

  // --- session / user ---
  private async userId(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }
  // The user's ACTIVE household (own or an invited one) — see lib/household.ts.
  private async householdId(): Promise<string | null> {
    const uid = await this.userId();
    if (!uid) return null;
    const { data } = await this.sb
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", uid);
    return pickHousehold(data ?? []);
  }

  async getSession(): Promise<Session> {
    const { data } = await this.sb.auth.getSession();
    const s = data.session;
    if (!s) return null;
    // The household is created by a trigger during signup — right after sign-up it
    // can lag a beat, so briefly retry rather than reporting "logged out" (which
    // used to bounce a fresh user back to the sign-in screen).
    let hid = await this.householdId();
    for (let i = 0; !hid && i < 5; i++) {
      await new Promise((r) => setTimeout(r, 200));
      hid = await this.householdId();
    }
    if (!hid) return null;
    return { user: { id: s.user.id, email: s.user.email ?? "" }, household_id: hid };
  }

  // Reload whenever the auth session settles (SIGNED_IN after signup, refresh,
  // sign-out) — this is what stops the post-signup redirect flip-flop.
  onAuthChange(cb: () => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error; // e.g. "Invalid login credentials"
  }
  // With "Confirm email" disabled in Supabase, signUp returns a session
  // immediately and the handle_new_user trigger creates the household.
  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      // When "Confirm email" is ON in Supabase, the confirmation link returns the
      // user to the sign-in screen (they then sign in). Requires this URL to be in
      // Supabase → Auth → URL Configuration → Redirect URLs.
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/signin?verified=1` : undefined,
      },
    });
    if (error) throw error; // e.g. "User already registered"
  }
  async signOut(): Promise<void> {
    this.setPreviewRole(null);
    await this.sb.auth.signOut();
  }

  // --- roles ---
  async currentRole(): Promise<Role | null> {
    const uid = await this.userId();
    const hid = await this.householdId();
    if (!uid || !hid) return null;
    const { data } = await this.sb
      .from("household_members")
      .select("role")
      .eq("user_id", uid)
      .eq("household_id", hid)
      .maybeSingle();
    return (data?.role as Role) ?? null;
  }
  previewRole(): Role | null {
    if (typeof window === "undefined") return null;
    return (window.localStorage.getItem(PREVIEW_KEY) as Role) || null;
  }
  setPreviewRole(role: Role | null): void {
    if (typeof window === "undefined") return;
    if (role) window.localStorage.setItem(PREVIEW_KEY, role);
    else window.localStorage.removeItem(PREVIEW_KEY);
  }
  // Client-only downgrade for the "view as" UX. RLS still enforces server-side
  // regardless of this value.
  async effectiveRole(): Promise<Role | null> {
    const real = await this.currentRole();
    if (!real) return null;
    const p = this.previewRole();
    return p && RANK[p] <= RANK[real] ? p : real;
  }

  // --- household ---
  async getHousehold(): Promise<Household | null> {
    const hid = await this.householdId();
    if (!hid) return null;
    const { data } = await this.sb.from("households").select("id, name").eq("id", hid).maybeSingle();
    return data ? { id: data.id, name: data.name } : null;
  }
  async updateHouseholdName(name: string): Promise<void> {
    const hid = await this.householdId();
    if (!hid) return;
    await this.sb.from("households").update({ name: name.trim() }).eq("id", hid);
  }
  async setOwnerName(name: string): Promise<void> {
    const uid = await this.userId();
    const hid = await this.householdId();
    if (!uid || !hid) return;
    await this.sb.from("household_members").update({ name }).eq("user_id", uid).eq("household_id", hid);
  }

  async listHouseholds(): Promise<Array<{ id: string; name: string; role: Role }>> {
    const uid = await this.userId();
    if (!uid) return [];
    const { data } = await this.sb
      .from("household_members")
      .select("household_id, role, households(name)")
      .eq("user_id", uid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((m: any) => ({ id: m.household_id, name: m.households?.name ?? "Family", role: m.role as Role }));
  }
  activeHouseholdId(): string | null {
    return getActiveHouseholdId();
  }
  setActiveHousehold(id: string): void {
    setActiveHouseholdId(id);
  }

  // --- members / invitations ---
  async listMembers(): Promise<Member[]> {
    const hid = await this.householdId();
    if (!hid) return [];
    const [{ data: members }, { data: invites }] = await Promise.all([
      this.sb.from("household_members").select("user_id, role, email, name").eq("household_id", hid),
      this.sb.from("invitations").select("id, email, role").eq("household_id", hid).eq("status", "pending"),
    ]);
    const active: Member[] = (members ?? []).map((m) => ({
      id: m.user_id, household_id: hid, user_id: m.user_id,
      name: m.name || m.email || "Member", email: m.email || "", role: m.role as Role, status: "active",
    }));
    const pending: Member[] = (invites ?? []).map((i) => ({
      id: i.id, household_id: hid, name: i.email, email: i.email, role: i.role as Role, status: "pending",
    }));
    return [...active, ...pending];
  }
  async listInvitations(): Promise<Invitation[]> {
    const hid = await this.householdId();
    if (!hid) return [];
    const { data } = await this.sb.from("invitations").select("*").eq("household_id", hid).eq("status", "pending");
    return (data ?? []) as Invitation[];
  }
  async invite(email: string, role: Role): Promise<Invitation> {
    const hid = await this.householdId();
    if (!hid) throw new Error("no household");
    const { data, error } = await this.sb
      .from("invitations")
      .insert({ household_id: hid, email: email.trim().toLowerCase(), role })
      .select("*")
      .single();
    if (error) throw error;
    return data as Invitation;
  }
  // Uses the SECURITY DEFINER preview RPC so an invitee (not yet a member) can
  // read the invite before signing in.
  async getInvitation(token: string): Promise<(Invitation & { household_name: string }) | null> {
    const { data } = await this.sb.rpc("invitation_preview", { invite_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      id: "", household_id: "", email: "", token, status: "pending", created_at: "",
      role: row.role as Role, household_name: row.household_name,
    };
  }
  async acceptInvite(token: string): Promise<void> {
    const { data, error } = await this.sb.rpc("accept_invitation", { invite_token: token });
    if (error) throw error;
    // Land the invitee IN the shared household (accept_invitation returns its id).
    if (data) setActiveHouseholdId(data as string);
  }
  async setMemberRole(id: string, role: Role): Promise<void> {
    const hid = await this.householdId();
    if (!hid) return;
    // active members are keyed by user_id (see listMembers)
    await this.sb.from("household_members").update({ role }).eq("user_id", id).eq("household_id", hid);
  }
  async removeMember(id: string): Promise<void> {
    const hid = await this.householdId();
    if (!hid) return;
    // id is a user_id (active member) or an invitation id (pending) — clear both.
    await this.sb.from("household_members").delete().eq("user_id", id).eq("household_id", hid);
    await this.sb.from("invitations").delete().eq("id", id);
  }
}
