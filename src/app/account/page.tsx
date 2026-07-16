"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { auth } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { memberColor } from "@/lib/ui";
import type { Profile } from "@/lib/types";

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [household, setHousehold] = useState<string>("");

  useEffect(() => {
    repo().listProfiles().then(setProfiles);
    setHousehold(auth.getHousehold()?.name ?? "");
  }, []);

  const me = profiles.find((p) => p.relationship === "self") ?? profiles[0];
  const c = memberColor(0);
  const displayName = me?.name ?? session?.user.name ?? "Your Family";

  return (
    <main className="flex flex-1 flex-col">
      <Header title="Account" />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <div className="flex items-center gap-[14px] rounded-[18px] border border-[#efeef6] bg-white p-[18px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
          <span
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full text-[20px] font-bold text-white"
            style={{ background: c.avatar }}
          >
            {(displayName?.[0] ?? "F").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold text-[#1e1b4b]">{displayName}</div>
            <div className="truncate text-[12.5px] font-medium text-[#9b9aaa]">{session?.user.email ?? "Signed in"}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#efeef6] bg-white shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
          <Link href="/household" className="flex items-center gap-3 border-b border-[#f1f1f7] px-[18px] py-4">
            <span className="flex-1 text-[14.5px] font-semibold text-[#1e1b4b]">Household</span>
            <span className="max-w-[45%] truncate text-[12.5px] font-semibold text-[#a3a2b4]">{household}</span>
            <span className="text-[#c4c3d0]">›</span>
          </Link>
          <Link href="/profiles" className="flex items-center gap-3 px-[18px] py-4">
            <span className="flex-1 text-[14.5px] font-semibold text-[#1e1b4b]">Family members</span>
            <span className="text-[12.5px] font-semibold text-[#a3a2b4]">{profiles.length}</span>
            <span className="text-[#c4c3d0]">›</span>
          </Link>
        </div>

        <button
          onClick={signOut}
          className="rounded-[16px] border border-[#f6dde1] bg-white py-3.5 text-[14px] font-bold text-[#e0455a]"
        >
          Sign out
        </button>

        <p className="px-1 text-[12px] text-[#a3a2b4]">
          Preview build — accounts &amp; sharing run on this device. Real email sign-in &amp; cloud sync arrive in the next phase.
        </p>
      </div>
    </main>
  );
}
