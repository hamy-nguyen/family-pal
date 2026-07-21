"use client";

import { useState } from "react";
import { MEMBER_COLORS } from "@/lib/ui";
import type { Profile, Relationship, Sex } from "@/lib/types";

const REL: { key: Relationship; label: string }[] = [
  { key: "self", label: "Me" },
  { key: "child", label: "Child" },
  { key: "parent", label: "Parent" },
  { key: "spouse", label: "Spouse" },
  { key: "sibling", label: "Sibling" },
  { key: "grandparent", label: "Grandparent" },
  { key: "other", label: "Other" },
];

// ABO groups only — Rh +/- omitted per product decision.
const BLOOD_TYPES = ["A", "B", "AB", "O"];

const INP =
  "w-full rounded-[13px] border border-[#ececf4] bg-white px-[13px] py-3 text-[14px] font-semibold text-[#1e1b4b] shadow-[0_2px_8px_rgba(30,27,75,0.03)] placeholder:font-medium placeholder:text-[#b4b3c2] focus:outline-none";

export type ProfileDraft = Omit<Profile, "id" | "created_at"> & { id?: string };

export function ProfileForm({
  initial,
  submitLabel,
  onSave,
  onDelete,
  hideRelationship = false,
}: {
  initial: ProfileDraft;
  submitLabel: string;
  onSave: (p: ProfileDraft) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  // WHY: when setting up your OWN profile the relationship is implicitly "self",
  // so the picker is noise. Hidden here; the draft keeps relationship = "self".
  hideRelationship?: boolean;
}) {
  const [p, setP] = useState<ProfileDraft>(initial);
  const [saving, setSaving] = useState(false);
  const c = MEMBER_COLORS[p.color_index % MEMBER_COLORS.length];

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) =>
    setP((x) => ({ ...x, [k]: v }));

  async function submit() {
    if (!p.name.trim()) return;
    setSaving(true);
    await onSave(p);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* avatar + colour picker */}
      <div className="flex items-center gap-[14px]">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-bold text-white"
          style={{ background: c.avatar }}
        >
          {(p.name[0] || "?").toUpperCase()}
        </span>
        <div className="flex flex-wrap gap-[7px]">
          {MEMBER_COLORS.map((mc, i) => (
            <button
              key={i}
              onClick={() => set("color_index", i)}
              aria-label={`colour ${i + 1}`}
              className="h-[26px] w-[26px] rounded-full"
              style={{
                background: mc.avatar,
                boxShadow:
                  i === p.color_index ? `0 0 0 2px #fff, 0 0 0 4px ${mc.avatar}` : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Name</span>
        <input
          className={INP}
          value={p.name}
          placeholder="e.g. Mom"
          onChange={(e) => set("name", e.target.value)}
        />
      </label>

      {!hideRelationship && (
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">
            Relationship
          </span>
          <div className="flex flex-wrap gap-2">
            {REL.map((r) => (
              <button
                key={r.key}
                onClick={() => set("relationship", r.key)}
                className={`rounded-full px-[13px] py-2 text-[13px] font-semibold ${
                  p.relationship === r.key
                    ? "bg-[#6366f1] text-white"
                    : "border border-[#ececf4] bg-white text-[#4b4a5e]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">
            Date of birth
          </span>
          <input
            type="date"
            className={INP}
            value={p.date_of_birth ?? ""}
            onChange={(e) => set("date_of_birth", e.target.value)}
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Sex</span>
          <select
            className={INP}
            value={p.sex ?? ""}
            onChange={(e) => set("sex", (e.target.value || undefined) as Sex | undefined)}
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      {/* medical details — shown inline, all optional */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-semibold text-[#8d8c9c]">Medical details · optional</span>
        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-medium text-[#9b9aaa]">Blood type</span>
          <select
            className={INP}
            value={p.blood_type ?? ""}
            onChange={(e) => set("blood_type", e.target.value || undefined)}
          >
            <option value="">—</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-medium text-[#9b9aaa]">Allergies</span>
          <input
            className={INP}
            placeholder="e.g. Penicillin, seafood"
            value={p.allergies ?? ""}
            onChange={(e) => set("allergies", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11.5px] font-medium text-[#9b9aaa]">Chronic conditions</span>
          <input
            className={INP}
            placeholder="e.g. Asthma, hypertension"
            value={p.chronic_conditions ?? ""}
            onChange={(e) => set("chronic_conditions", e.target.value)}
          />
        </label>
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="py-1 text-[13.5px] font-bold text-[#e0455a]"
        >
          Delete profile
        </button>
      )}

      <button
        onClick={submit}
        disabled={saving || !p.name.trim()}
        className="mt-1 w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-50"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
