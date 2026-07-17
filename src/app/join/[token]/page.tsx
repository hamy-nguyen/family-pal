"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, type Role } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const ROLE_LABEL: Record<Role, string> = { owner: "an owner", editor: "someone who can edit", viewer: "a viewer" };

// Accept-invite screen — the target of the invite link. Public route: an invited
// caregiver may arrive before signing in. Accepting requires them to be signed in
// as their OWN account; on accept they're switched into the shared household.
export default function JoinScreen() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { session, refresh } = useAuth();
  const [inv, setInv] = useState<Awaited<ReturnType<typeof auth.getInvitation>>>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    auth.getInvitation(token).then((v) => {
      setInv(v);
      setLoading(false);
    });
  }, [token]);

  async function accept() {
    setError(undefined);
    try {
      await auth.acceptInvite(token); // sets the shared household as active
      await refresh(); // pick up the new household + role before we navigate
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Couldn't accept the invite.");
    }
  }

  if (loading) return <p className="p-8 text-sm text-[#a3a2b4]">Loading…</p>;

  if (!inv) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-[34px]">🔗</span>
        <div className="text-[17px] font-extrabold text-[#1e1b4b]">Invite not found</div>
        <p className="text-[14px] font-medium text-[#7b7a8a]">This invitation link is invalid or has already been used.</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eafaf1] text-[32px]">🎉</span>
        <div className="text-[18px] font-extrabold text-[#1e1b4b]">You&apos;re in</div>
        <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
          You&apos;ve joined <span className="font-bold text-[#4b4a5e]">{inv.household_name}</span>. You&apos;re now viewing this family&apos;s records.
        </p>
        <button onClick={() => router.replace("/")} className="mt-2 rounded-[16px] bg-[#6366f1] px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]">
          Go to {inv.household_name}
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eef0fe] text-[30px]">👋</span>
      <div className="flex flex-col gap-1.5">
        <div className="text-[19px] font-extrabold leading-[1.2] text-[#1e1b4b]">
          Join {inv.household_name}
        </div>
        <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
          You&apos;ve been invited as {ROLE_LABEL[inv.role]} to help manage this family&apos;s medical records.
        </p>
      </div>

      {session ? (
        <button onClick={accept} className="w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]">
          Accept invite
        </button>
      ) : (
        <div className="flex w-full flex-col gap-2 text-center">
          <p className="text-[13px] font-medium text-[#9b9aaa]">Sign in or create your own account first, then reopen this link to accept.</p>
          <button onClick={() => router.push("/signin")} className="w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]">
            Sign in
          </button>
        </div>
      )}

      {error && (
        <p className="w-full rounded-[12px] border border-[#f6dde1] bg-[#fdf3f4] px-3.5 py-2.5 text-[13px] font-semibold text-[#e0455a]">
          {error}
        </p>
      )}
    </main>
  );
}
