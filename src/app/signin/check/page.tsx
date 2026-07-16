"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";

// Check-email step. In a real build the user leaves the app and taps the link
// in their inbox; here the "Open the magic link" button stands in for that tap.
export default function CheckEmailScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState<string>();

  useEffect(() => {
    const pending = auth.pendingEmail();
    if (!pending) {
      router.replace("/signin");
      return;
    }
    setEmail(pending);
  }, [router]);

  function openLink() {
    auth.completeSignIn();
    refresh(); // let the guard see the new session; then route into the app
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header title="Check your email" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eef0fe] text-[32px]">✉️</span>
        <div className="flex flex-col gap-1.5">
          <div className="text-[17px] font-extrabold text-[#1e1b4b]">Magic link sent</div>
          <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
            We sent a sign-in link to <span className="font-bold text-[#4b4a5e]">{email}</span>. Tap it to continue.
          </p>
        </div>

        {/* Mock stand-in for tapping the emailed link. */}
        <div className="w-full rounded-[16px] border border-dashed border-[#cdd0dd] bg-[#fbfbfe] p-4">
          <p className="mb-3 text-[12px] font-medium text-[#a3a2b4]">
            Preview build — no real email is sent. Use the button below in place of the link.
          </p>
          <button
            onClick={openLink}
            className="w-full rounded-[14px] bg-[#6366f1] py-3.5 text-[14.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
          >
            Open the magic link
          </button>
        </div>

        <button onClick={() => router.replace("/signin")} className="text-[13.5px] font-semibold text-[#8d8c9c]">
          Use a different email
        </button>
      </div>
    </main>
  );
}
