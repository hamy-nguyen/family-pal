"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { compressImage } from "@/lib/compress";
import { setPendingImages } from "@/lib/captureBuffer";
import type { Profile, Visit } from "@/lib/types";
import {
  categoryFor,
  deaccent,
  fmtDate,
  fmtMonthYear,
  memberColor,
  type MemberColor,
  SearchIcon,
  UsersIcon,
  SlidersIcon,
  MapPinIcon,
  CameraIcon,
} from "@/lib/ui";

const FAMILY_NAME = "Your Family";

type SortKey = "newest" | "diagnosis" | "clinic";
const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest",
  diagnosis: "Type",
  clinic: "Clinic",
};

function greetingFor(h: number) {
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const parseMoney = (s?: string) => {
  const n = parseInt((s ?? "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};
const fmtMoney = (n: number) => (n ? `${n.toLocaleString("vi-VN")}đ` : "");
const visitTotal = (v: Visit) =>
  fmtMoney(parseMoney(v.consultation_fee) + parseMoney(v.medication_fee));
const visitWhen = (v: Visit) => v.visit_date || v.created_at;

export default function RetrieveScreen() {
  const router = useRouter();
  const { can, households, session } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [profileId, setProfileId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
    (async () => {
      const r = repo();
      const [v, p] = await Promise.all([r.listVisits(), r.listProfiles()]);
      // First run — no profiles yet: go set one up.
      if (p.length === 0) {
        router.replace("/setup");
        return;
      }
      setVisits(v);
      setProfiles(p);
      setLoading(false);
    })();
  }, [router]);

  const colorOf = (pid: string) =>
    memberColor(profiles.find((p) => p.id === pid)?.color_index ?? 0);

  async function del(id: string) {
    if (!confirm("Delete this record? This can't be undone.")) return;
    await repo().deleteVisit(id);
    setVisits((vs) => vs.filter((v) => v.id !== id));
  }

  async function onCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    const readFile = (f: File): Promise<string> =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(f);
      });
    const urls = await Promise.all(
      files.map(async (f) => compressImage(await readFile(f)))
    );
    setPendingImages(urls);
    router.push("/capture");
  }

  const shown = useMemo(() => {
    let list = visits;
    if (profileId !== "all") list = list.filter((v) => v.profile_id === profileId);
    if (q.trim()) {
      // accent-insensitive: "da day" matches "dạ dày", "viem" matches "viêm"
      const t = deaccent(q);
      list = list.filter((v) =>
        deaccent(
          [
            v.diagnosis,
            v.clinic_location,
            v.disease_process,
            v.medications.map((m) => m.name).join(" "),
            v.investigations.map((i) => i.conclusion).join(" "),
          ].join(" ")
        ).includes(t)
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "newest")
        return (visitWhen(b) || "").localeCompare(visitWhen(a) || "");
      if (sort === "diagnosis")
        return (a.diagnosis || "").localeCompare(b.diagnosis || "");
      return (a.clinic_location || "").localeCompare(b.clinic_location || "");
    });
    return sorted;
  }, [visits, profileId, q, sort]);

  const groups = useMemo(() => {
    if (sort !== "newest")
      return [{ label: null as string | null, visits: shown }];
    const out: { label: string; visits: Visit[] }[] = [];
    const idx: Record<string, number> = {};
    for (const v of shown) {
      const key = fmtMonthYear(visitWhen(v));
      if (!(key in idx)) {
        idx[key] = out.length;
        out.push({ label: key, visits: [] });
      }
      out[idx[key]].visits.push(v);
    }
    return out;
  }, [shown, sort]);

  const userInitial = (profiles[0]?.name?.[0] ?? "F").toUpperCase();

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="px-5 pt-[max(60px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold tracking-[0.01em] text-[#9b9aaa]">
              {greeting}
            </div>
            <div className="mt-0.5 text-[23px] font-extrabold tracking-[-0.02em] text-[#1e1b4b]">
              {households.find((h) => h.id === session?.household_id)?.name || FAMILY_NAME}
            </div>
          </div>
          <Link
            href="/account"
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[17px] font-bold text-white"
            style={{ background: "#6366f1", boxShadow: "0 6px 16px rgba(99,102,241,0.35)" }}
          >
            {userInitial}
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-[11px] rounded-2xl border border-[#ececf4] bg-white px-[15px] py-[13px] shadow-[0_2px_10px_rgba(30,27,75,0.04)]">
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search diagnosis, clinic, medicine, results"
            className="w-full bg-transparent text-[14px] font-medium text-[#1e1b4b] placeholder:text-[#a3a2b4] focus:outline-none"
          />
        </div>
      </div>

      <div className="no-scrollbar flex gap-[18px] overflow-x-auto px-5 pb-1 pt-5">
        <ProfileAvatar
          label="Everyone"
          color="#6366f1"
          active={profileId === "all"}
          onClick={() => setProfileId("all")}
        >
          <UsersIcon />
        </ProfileAvatar>
        {profiles.map((p) => {
          const c = colorOf(p.id);
          return (
            <ProfileAvatar
              key={p.id}
              label={p.name}
              color={c.avatar}
              active={profileId === p.id}
              onClick={() => setProfileId(p.id)}
            >
              <span className="text-[21px] font-bold text-white">
                {p.name[0]?.toUpperCase()}
              </span>
            </ProfileAvatar>
          );
        })}
      </div>

      <div className="relative flex items-center justify-between px-5 pb-1.5 pt-4">
        <div className="flex items-baseline gap-[7px]">
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-[-0.01em] text-[#1e1b4b]">
            {profileId === "all"
              ? "All records"
              : profiles.find((p) => p.id === profileId)?.name ?? "Records"}
          </span>
          <span className="text-[13px] font-semibold text-[#a3a2b4]">
            {shown.length}
          </span>
        </div>
        <button
          onClick={() => setSortOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-[#ececf4] bg-white px-3 py-[7px] text-[12.5px] font-semibold text-[#4b4a5e] shadow-[0_2px_8px_rgba(30,27,75,0.04)]"
        >
          <SlidersIcon />
          {SORT_LABEL[sort]}
        </button>
        {sortOpen && (
          <div className="absolute right-5 top-[44px] z-40 w-36 overflow-hidden rounded-xl border border-[#ececf4] bg-white py-1 shadow-[0_8px_24px_rgba(30,27,75,0.12)]">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setSort(k);
                  setSortOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-[13px] font-medium ${
                  sort === k ? "text-[#6366f1]" : "text-[#4b4a5e]"
                }`}
              >
                {SORT_LABEL[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[18px] px-5 pb-[150px] pt-1.5">
        {loading && <p className="text-sm text-[#a3a2b4]">Loading…</p>}
        {!loading && shown.length === 0 && (
          <div className="mt-16 text-center text-[#a3a2b4]">
            <p className="text-sm">No records yet.</p>
            <p className="text-xs">Tap + to add one.</p>
          </div>
        )}
        {groups.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label && (
              <div className="mx-0.5 mb-3 mt-1.5 flex items-baseline justify-between">
                <span className="whitespace-nowrap text-[13px] font-extrabold tracking-[0.01em] text-[#1e1b4b]">
                  {g.label}
                </span>
                <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#a3a2b4]">
                  {g.visits.length} visit{g.visits.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-[11px]">
              {g.visits.map((v) => (
                <RecordCard
                  key={v.id}
                  v={v}
                  color={colorOf(v.profile_id)}
                  onDelete={can("records:delete") ? () => del(v.id) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {can("records:create") && (
        <label
          className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 cursor-pointer items-center gap-[9px] rounded-full bg-[#6366f1] px-6 py-[15px] text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(99,102,241,0.45)] active:scale-[0.98]"
          aria-label="Add record"
        >
          <CameraIcon />
          Add record
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onCapture}
            className="hidden"
          />
        </label>
      )}
    </main>
  );
}

function ProfileAvatar({
  label,
  color,
  active,
  onClick,
  children,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="flex flex-none flex-col items-center gap-2">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: color,
          boxShadow: active ? `0 0 0 3px #fff, 0 0 0 5px ${color}` : undefined,
        }}
      >
        {children}
      </span>
      <span
        className="text-[12.5px]"
        style={{ fontWeight: active ? 700 : 500, color: active ? "#1e1b4b" : "#6b6a7b" }}
      >
        {label}
      </span>
    </button>
  );
}

function RecordCard({
  v,
  color,
  onDelete,
}: {
  v: Visit;
  color: MemberColor;
  onDelete?: () => void;
}) {
  const cat = categoryFor(v.diagnosis);
  const total = visitTotal(v);
  return (
    <Link
      href={`/visit/${v.id}`}
      className="flex items-center gap-[13px] rounded-[20px] border border-[#efeef6] bg-white p-[14px] shadow-[0_4px_18px_rgba(30,27,75,0.05)] active:scale-[0.99]"
    >
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px]"
        style={{ background: cat.tint, color: cat.color }}
      >
        <cat.Icon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2.5">
          <span className="truncate text-[15.5px] font-bold tracking-[-0.01em] text-[#1e1b4b]">
            {v.diagnosis || "Untitled"}
          </span>
          {total && (
            <span className="flex-none text-[15px] font-extrabold text-[#1e1b4b]">
              {total}
            </span>
          )}
        </div>
        <div className="mt-[3px] flex items-center gap-[5px]">
          <MapPinIcon />
          <span className="truncate text-[13px] font-medium text-[#7b7a8a]">
            {v.clinic_location || "—"}
          </span>
        </div>
        <div className="mt-[9px] flex items-center gap-[9px]">
          {v.profile_name && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full py-[3px] pl-1 pr-[9px]"
              style={{ background: color.tint }}
            >
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: color.avatar }}
              >
                {v.profile_name[0]?.toUpperCase()}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: color.text }}>
                {v.profile_name}
              </span>
            </span>
          )}
          <span className="text-[12.5px] font-medium text-[#a3a2b4]">
            {fmtDate(visitWhen(v))}
          </span>
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete record"
          className="flex-none self-start p-1 text-[#d0cfdb]"
        >
          <TrashIcon />
        </button>
      )}
    </Link>
  );
}

function TrashIcon() {
  return <Trash2 size={17} strokeWidth={2} />;
}
