"use client";

import Link from "next/link";
import { useEffect } from "react";
import { markWelcomeSeen } from "@/lib/onboarding";

// Onboarding — value prop + one CTA into sign-in. No back (it's the root of the
// signed-out flow). The auth guard sends signed-out users here ONLY on the first
// device visit; reaching this screen marks it seen so it never auto-shows again.
const FEATURES = [
  { emoji: "📸", title: "Snap the paper", body: "Photograph any consultation record, prescription, or test result." },
  { emoji: "👨‍👩‍👧", title: "One book for the family", body: "Every member's history in one place — self, kids, parents." },
  { emoji: "🔍", title: "Find it in seconds", body: "Search by diagnosis, clinic, or medicine — no more paper piles." },
];

export default function WelcomeScreen() {
  // WHY on mount (not on the button): if the user closes the app right here, we
  // still count it as seen — welcome is a one-time intro, so it shouldn't wait
  // for a tap that may never come.
  useEffect(() => markWelcomeSeen(), []);

  return (
    <main className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#6366f1] text-[28px] shadow-[0_12px_28px_rgba(99,102,241,0.4)]">
            🩺
          </span>
          <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#1e1b4b]">
            Your family&apos;s medical history, one tap away.
          </h1>
          <p className="text-[15px] font-medium leading-[1.5] text-[#7b7a8a]">
            Family Pal turns the papers you get after every visit into a searchable health book for the whole family.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          {FEATURES.map(({ emoji, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-[#eef0fe] text-[19px]">
                {emoji}
              </span>
              <div>
                <div className="text-[14.5px] font-bold text-[#1e1b4b]">{title}</div>
                <div className="text-[13px] font-medium leading-[1.45] text-[#8d8c9c]">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/signin"
        className="flex items-center justify-center rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
      >
        Get started
      </Link>
    </main>
  );
}
