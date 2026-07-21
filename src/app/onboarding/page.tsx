"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

// Shown right after a new user sets up their OWN profile: how will they use the app?
// - "Just me": track only their own health.
// - "My family": manage a household (add family members, invite co-managers).
// Transitional note: both currently sit on the household created at signup; the true
// individual = account-owned (no household) conversion lands with the contract migration.
const CHOICES = [
  {
    key: "solo",
    emoji: "🧍",
    title: "Just me",
    body: "Track my own health records. I can always add family or get invited later.",
    href: "/",
  },
  {
    key: "family",
    emoji: "👨‍👩‍👧",
    title: "My family",
    body: "Manage records for my family and invite others to co-manage.",
    href: "/onboarding/family",
  },
] as const;

export default function OnboardingChoice() {
  const router = useRouter();
  return (
    <main className="flex flex-1 flex-col">
      <Header title="How will you use Family Pal?" subtitle="Step 2 · You can change this anytime" back={false} />
      <div className="flex flex-col gap-3.5 px-5 pb-10 pt-3">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            onClick={() => router.replace(c.href)}
            className="flex items-start gap-4 rounded-[18px] border border-[#ececf4] bg-white p-[18px] text-left shadow-[0_2px_10px_rgba(30,27,75,0.04)] transition hover:border-[#6366f1] hover:shadow-[0_8px_24px_rgba(99,102,241,0.14)]"
          >
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#eef0fe] text-[24px]">
              {c.emoji}
            </span>
            <div>
              <div className="text-[15.5px] font-bold text-[#1e1b4b]">{c.title}</div>
              <div className="mt-0.5 text-[13px] font-medium leading-[1.45] text-[#8d8c9c]">{c.body}</div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
