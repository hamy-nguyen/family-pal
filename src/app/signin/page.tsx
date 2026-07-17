"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";

// Email + password. No emails are sent (Supabase "Confirm email" is off), so this
// sidesteps magic-link rate limits + PKCE entirely and works across devices.
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

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = validEmail && password.length >= 6;
  const isSignup = mode === "signup";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (isSignup) await auth.signUp(email, password);
      else await auth.signIn(email, password);
      await refresh(); // push the new session to the guard, then enter the app
      router.replace("/");
    } catch (e) {
      const msg = (e as Error).message || "";
      // friendlier hint for the most common cause
      setError(
        /invalid login credentials/i.test(msg)
          ? 'Email or password is wrong — or you haven\'t created this account yet. Try "Create an account" below.'
          : msg || "Something went wrong.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header
        title={isSignup ? "Create account" : "Welcome back"}
        subtitle={isSignup ? "Set an email and password" : "Sign in with your email and password"}
      />
      <div className="flex flex-col gap-4 px-6 pt-4">
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
