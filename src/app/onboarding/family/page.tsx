"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { Header } from "@/components/Header";
import { MEMBER_COLORS } from "@/lib/ui";
import type { Profile } from "@/lib/types";

// Household onboarding: add profiles for the people you'll manage. Each "add" creates
// a household-owned profile (via /profiles/new). Refetches on mount, so returning from
// the add screen shows the new member. Co-manager invites come later, from Account.
export default function OnboardingFamily() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const load = useCallback(() => {
    repo().listProfiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <main className="flex flex-1 flex-col">
      <Header title="Add your family" subtitle="Step 3 · The people you'll manage" back={false} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-2">
        <p className="text-[13.5px] font-medium leading-[1.5] text-[#8d8c9c]">
          Create a profile for each family member — kids, parents, a spouse. You can invite
          others to co-manage later from Account.
        </p>

        <div className="flex flex-col gap-2.5">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-[14px] border border-[#ececf4] bg-white px-3.5 py-3">
              <span
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[16px] font-bold text-white"
                style={{ background: MEMBER_COLORS[p.color_index % MEMBER_COLORS.length].avatar }}
              >
                {(p.name[0] || "?").toUpperCase()}
              </span>
              <span className="text-[14.5px] font-bold text-[#1e1b4b]">{p.name}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/profiles/new")}
          className="flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[#c9c8db] bg-white py-3.5 text-[14px] font-bold text-[#6366f1] transition hover:border-[#6366f1]"
        >
          + Add a family member
        </button>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            onClick={() => router.push("/household/invite?from=onboarding")}
            className="w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
          >
            Continue
          </button>
          <span className="text-center text-[12px] font-medium text-[#a3a2b4]">
            Next: invite co-managers (optional)
          </span>
        </div>
      </div>
    </main>
  );
}
