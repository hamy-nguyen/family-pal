"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { memberColor } from "@/lib/ui";
import type { Profile, Visit } from "@/lib/types";

const REL_LABEL: Record<string, string> = {
  self: "You",
  child: "Child",
  parent: "Parent",
  spouse: "Spouse",
  sibling: "Sibling",
  grandparent: "Grandparent",
  other: "Other",
};

export default function ProfilesScreen() {
  const { can } = useAuth();
  const manage = can("profiles:manage");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = repo();
    Promise.all([r.listProfiles(), r.listVisits()]).then(([p, v]) => {
      setProfiles(p);
      setVisits(v);
      setLoading(false);
    });
  }, []);

  const count = (pid: string) => visits.filter((v) => v.profile_id === pid).length;

  return (
    <main className="flex flex-1 flex-col pb-28">
      <Header title="Profiles" />
      <div className="flex flex-col gap-3 px-5 pt-2">
        {loading && <p className="text-sm text-[#a3a2b4]">Loading…</p>}
        {profiles.map((p) => {
          const c = memberColor(p.color_index);
          const n = count(p.id);
          const cls = "flex items-center gap-[13px] rounded-[18px] border border-[#efeef6] bg-white p-[14px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]";
          const inner = (
            <>
              <span
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-[19px] font-bold text-white"
                style={{ background: c.avatar }}
              >
                {p.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15.5px] font-bold text-[#1e1b4b]">{p.name}</div>
                <div className="text-[12.5px] font-medium text-[#9b9aaa]">
                  {REL_LABEL[p.relationship] ?? "Other"} · {n} record{n !== 1 ? "s" : ""}
                </div>
              </div>
              {/* editing lives behind the chevron — hidden for view-only */}
              {manage && <span className="text-[#c4c3d0]">›</span>}
            </>
          );
          // View-only members see the roster but can't open the edit form.
          return manage ? (
            <Link key={p.id} href={`/profiles/${p.id}`} className={`${cls} active:scale-[0.99]`}>
              {inner}
            </Link>
          ) : (
            <div key={p.id} className={cls}>{inner}</div>
          );
        })}
      </div>

      {manage && (
        <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <Link
            href="/profiles/new"
            className="block w-full rounded-[16px] bg-[#6366f1] py-4 text-center text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
          >
            ＋ Add profile
          </Link>
        </div>
      )}
    </main>
  );
}
