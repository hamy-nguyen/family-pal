"use client";

// Reactive wrapper around the (mock) auth module + the route guard + the RBAC
// surface every screen uses (role, can(), preview). localStorage isn't reactive,
// so this holds identity in React state and re-reads after each mutation.
// Phase 2: swap the auth import for a Supabase-backed one — this component and
// every screen stay the same.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, type Session, type Role } from "@/lib/auth";
import { can as canFor, ROLE_LABEL, type Capability } from "@/lib/permissions";
import { hasSeenWelcome } from "@/lib/onboarding";

// Routes reachable while signed out. /join stays open so an invited caregiver
// can land on the accept screen before signing in.
const PUBLIC = ["/welcome", "/signin", "/join"];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

type Ctx = {
  session: Session;
  role: Role | null; // effective role (preview-aware) — what can() uses
  realRole: Role | null; // the caregiver's actual role
  previewRole: Role | null;
  loading: boolean;
  can: (cap: Capability) => boolean;
  setPreviewRole: (r: Role | null) => void;
  households: Array<{ id: string; name: string; role: Role }>;
  switchHousehold: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => void;
};
const AuthCtx = createContext<Ctx | null>(null);

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [session, setSession] = useState<Session>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [realRole, setRealRole] = useState<Role | null>(null);
  const [preview, setPreview] = useState<Role | null>(null);
  const [households, setHouseholds] = useState<Array<{ id: string; name: string; role: Role }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, eff, real, hh] = await Promise.all([
        auth.getSession(),
        auth.effectiveRole(),
        auth.currentRole(),
        auth.listHouseholds(),
      ]);
      setSession(s);
      setRole(eff);
      setRealRole(real);
      setHouseholds(hh);
    } catch {
      setSession(null);
      setRole(null);
      setRealRole(null);
      setHouseholds([]);
    }
    setPreview(auth.previewRole());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Re-read the session whenever auth settles — stops the post-signup flip-flop.
    const unsub = auth.onAuthChange(() => void load());
    return unsub;
  }, [load]);

  const setPreviewRole = useCallback(
    (r: Role | null) => {
      auth.setPreviewRole(r);
      void load();
    },
    [load],
  );

  const can = useCallback((cap: Capability) => canFor(role, cap), [role]);

  const switchHousehold = useCallback(
    (id: string) => {
      auth.setActiveHousehold(id);
      // reload the session under the new household, then land on Home fresh
      load().then(() => router.replace("/"));
    },
    [load, router],
  );

  const signOut = useCallback(() => {
    (async () => {
      await auth.signOut();
      await load();
      // Welcome is a one-time intro; a signed-out returning user goes to sign-in.
      router.replace("/signin");
    })();
  }, [router, load]);

  // Guard: bounce signed-out users to onboarding, signed-in users away from
  // the auth screens.
  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic(path)) {
      // First device visit gets the welcome pitch; after that, straight to sign-in.
      router.replace(hasSeenWelcome() ? "/signin" : "/welcome");
    } else if (session && (path === "/welcome" || path === "/signin" || path.startsWith("/signin/"))) {
      router.replace("/");
    }
  }, [session, loading, path, router]);

  if (loading || (!session && !isPublic(path))) {
    return <div className="flex flex-1 items-center justify-center p-10 text-sm text-[#a3a2b4]">Loading…</div>;
  }

  const previewing = !!role && !!realRole && role !== realRole;

  return (
    <AuthCtx.Provider value={{ session, role, realRole, previewRole: preview, loading, can, setPreviewRole, households, switchHousehold, refresh: load, signOut }}>
      {previewing && (
        <div className="fixed left-1/2 top-0 z-40 flex w-full max-w-md -translate-x-1/2 items-center gap-2 bg-[#1e1b4b] px-4 py-1.5 text-[12px] font-bold text-white">
          <span className="flex-1">Previewing as {ROLE_LABEL[role!]} · read-only where restricted</span>
          <button onClick={() => setPreviewRole(null)} className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-bold">
            Exit
          </button>
        </div>
      )}
      {children}
    </AuthCtx.Provider>
  );
}
