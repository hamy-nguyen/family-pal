"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";

// Email + password. If Supabase "Confirm email" is ON, sign-up returns no session
// until the user clicks the emailed link — so we show a "check your email" screen
// and make them sign in afterward, rather than onboarding straight away.
const INP =
  "w-full rounded-[12px] border border-[#ececf4] bg-white px-3.5 py-3 text-[15px] font-semibold text-[#1e1b4b] shadow-[0_2px_8px_rgba(30,27,75,0.03)] placeholder:font-medium placeholder:text-[#b4b3c2] focus:outline-none";

export default function SignInScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>(); // set once a confirmation email is sent
  const [verified, setVerified] = useState(false); // loading gate while auto-login runs
  const [fromLink, setFromLink] = useState(false); // came back from the confirmation link

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("verified") === "1") {
      setVerified(true);
      setFromLink(true);
      // detectSessionInUrl establishes the session from the link, then the route guard
      // moves them into onboarding. If that can't happen (e.g. the link was opened in a
      // different browser than sign-up), fall back to the sign-in form.
      const t = setTimeout(() => setVerified(false), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = validEmail && password.length >= 6;
  const isSignup = mode === "signup";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (isSignup) {
        await auth.signUp(email, password);
        const session = await auth.getSession();
        if (session) {
          // Confirmation disabled → a session exists → straight into onboarding.
          await refresh();
          router.replace("/");
        } else {
          // Confirmation enabled → no session yet → wait for email verification.
          setSentTo(email.trim());
          setBusy(false);
        }
      } else {
        await auth.signIn(email, password);
        await refresh();
        router.replace("/");
      }
    } catch (e) {
      const msg = (e as Error).message || "";
      setError(
        /email not confirmed/i.test(msg)
          ? "Please confirm your email first — check your inbox for the link, then sign in."
          : /invalid login credentials/i.test(msg)
            ? 'Email or password is wrong — or you haven\'t created this account yet. Try "Create an account" below.'
            : msg || "Something went wrong.",
      );
      setBusy(false);
    }
  }

  // ---- returned from the confirmation link: auto-login is in flight ----
  if (verified) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Confirming your email" back={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eef0fe] text-[30px]">✅</span>
          <p className="text-[14.5px] font-medium text-[#4b4a5e]">Verifying and signing you in…</p>
        </div>
      </main>
    );
  }

  // ---- confirmation sent: don't onboard, tell them to verify then sign in ----
  if (sentTo) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Check your email" back={false} />
        <div className="flex flex-col items-center gap-4 px-6 pt-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eef0fe] text-[30px]">📬</span>
          <p className="text-[14.5px] font-medium leading-[1.55] text-[#4b4a5e]">
            We sent a confirmation link to <span className="font-bold text-[#1e1b4b]">{sentTo}</span>.
            Open it to verify your email, then come back here and sign in.
          </p>
          <button
            onClick={() => { setSentTo(undefined); setMode("signin"); setPassword(""); }}
            className="mt-2 w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header
        title={isSignup ? "Create account" : "Welcome back"}
        subtitle={isSignup ? "Set an email and password" : "Sign in with your email and password"}
      />
      <div className="flex flex-col gap-4 px-6 pt-4">
        {fromLink && (
          <p className="rounded-[12px] border border-[#cdeede] bg-[#eafaf1] px-3.5 py-2.5 text-[13px] font-semibold text-[#178a52]">
            ✅ Email verified — sign in to finish.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Email</label>
          <input
            type="email"
            autoFocus
            inputMode="email"
            autoCapitalize="none"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INP}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Password</label>
          <input
            type="password"
            autoCapitalize="none"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className={INP}
          />
        </div>

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="mt-1 rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-40"
        >
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>

        {error && (
          <p className="rounded-[12px] border border-[#f6dde1] bg-[#fdf3f4] px-3.5 py-2.5 text-[13px] font-semibold text-[#e0455a]">
            {error}
          </p>
        )}

        <button
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError(undefined);
          }}
          className="mt-1 text-[13.5px] font-semibold text-[#8d8c9c]"
        >
          {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
