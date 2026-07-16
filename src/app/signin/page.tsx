"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";

// Sign in — email only. Mock "magic link": we remember the email and move to
// the check-email step. Phase 2: this calls supabase.auth.signInWithOtp(email).
export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  function send() {
    if (!valid) return;
    auth.requestSignIn(email);
    router.push("/signin/check");
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header title="Sign in" subtitle="We'll email you a magic link" />
      <div className="flex flex-col gap-4 px-6 pt-4">
        <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
          Enter your email — no password to remember. We&apos;ll send a link that signs you straight in.
        </p>
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
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="w-full rounded-[12px] border border-[#ececf4] bg-white px-3.5 py-3 text-[15px] font-semibold text-[#1e1b4b] shadow-[0_2px_8px_rgba(30,27,75,0.03)] placeholder:font-medium placeholder:text-[#b4b3c2] focus:outline-none"
          />
        </div>
        <button
          onClick={send}
          disabled={!valid}
          className="mt-1 flex items-center justify-center rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-40"
        >
          Send magic link
        </button>
      </div>
    </main>
  );
}
