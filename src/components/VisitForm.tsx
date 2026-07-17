"use client";

import { useState } from "react";
import { memberColor } from "@/lib/ui";
import { extractImages, filesToImages } from "@/lib/extract";
import type {
  Profile,
  Medication,
  Supplement,
  Investigation,
  InvestigationType,
  StructuredResult,
} from "@/lib/types";

const INP =
  "w-full rounded-[12px] border border-[#ececf4] bg-white px-3 py-2.5 text-[13.5px] font-semibold text-[#1e1b4b] shadow-[0_2px_8px_rgba(30,27,75,0.03)] placeholder:font-medium placeholder:text-[#b4b3c2] focus:outline-none";
const AI = INP.replace("border-[#ececf4] bg-white", "border-[#dcdef9] bg-[#fbfbff]");
const LBL = "mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]";
const SEC = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]";

const INV_TYPES: InvestigationType[] = [
  "ultrasound", "xray", "ct", "mri", "endoscopy", "blood", "urine", "stool", "culture", "ecg", "other",
];

export type VisitFormValue = {
  profile_id: string;
  diagnosis: string;
  clinic_location: string;
  visit_date: string;
  disease_process: string;
  doctor: string;
  icd_code: string;
  treatment_note: string;
  treatment_location: string;
  follow_up_date: string;
  note: string;
  consultation_fee: string;
  medication_fee: string;
  insurance: string;
  medications: Medication[];
  supplements: Supplement[];
  investigations: Investigation[];
};

export const EMPTY_VISIT_VALUE: VisitFormValue = {
  profile_id: "", diagnosis: "", clinic_location: "", visit_date: "",
  disease_process: "", doctor: "", icd_code: "", treatment_note: "",
  treatment_location: "", follow_up_date: "", note: "", consultation_fee: "",
  medication_fee: "", insurance: "", medications: [], supplements: [], investigations: [],
};

function upd<T>(rows: T[], i: number, patch: Partial<T>): T[] {
  return rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
}

// WHY: re-reading extra photos must ADD to the form, never clobber the user's
// edits or the earlier read. Docs don't overlap (user adds a forgotten page),
// so: fill only-blank scalar fields, and APPEND drug/supplement/result rows.
// Exported so the first-capture read uses the identical rule (lists start empty
// there, so "append" == "populate").
export function mergeExtraction(prev: VisitFormValue, s: StructuredResult): VisitFormValue {
  const keep = (mine: string, found?: string) => (mine && mine.trim() ? mine : found || mine);
  return {
    ...prev,
    diagnosis: keep(prev.diagnosis, s.diagnosis),
    clinic_location: keep(prev.clinic_location, s.clinic_location),
    visit_date: keep(prev.visit_date, s.visit_date),
    disease_process: keep(prev.disease_process, s.disease_process),
    doctor: keep(prev.doctor, s.doctor),
    icd_code: keep(prev.icd_code, s.icd_code),
    treatment_note: keep(prev.treatment_note, s.treatment_note),
    consultation_fee: keep(prev.consultation_fee, s.consultation_fee),
    medication_fee: keep(prev.medication_fee, s.medication_fee),
    insurance: keep(prev.insurance, s.insurance),
    medications: [...prev.medications, ...(s.medications ?? [])],
    supplements: [...prev.supplements, ...(s.supplements ?? [])],
    investigations: [...prev.investigations, ...(s.investigations ?? [])],
  };
}

// Format money as the user types: digits only, "." every 3 (e.g. 300000 -> "300.000").
const fmtThousands = (s: string) =>
  s.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function VisitForm({
  profiles,
  initial,
  initialPhotos = [],
  initialRawText = "",
  submitLabel,
  tinted = false,
  onSubmit,
  onDelete,
}: {
  profiles: Profile[];
  initial: VisitFormValue;
  initialPhotos?: string[]; // photos already attached (capture read / existing record)
  initialRawText?: string;
  submitLabel: string;
  tinted?: boolean; // tint auto-filled record fields (capture)
  onSubmit: (v: VisitFormValue, media: { photos: string[]; rawText: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void; // shown only when editing
}) {
  const [f, setF] = useState<VisitFormValue>(initial);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [rawText, setRawText] = useState(initialRawText);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const rec = tinted ? AI : INP;
  const set = <K extends keyof VisitFormValue>(k: K, v: VisitFormValue[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  // WHY: only the NEWLY added photos are read — the earlier batch is already
  // merged into `f`, so re-reading everything would waste time and duplicate rows.
  async function addDocuments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await filesToImages(files);
    setPhotos((p) => [...p, ...urls]);
    setReading(true);
    try {
      const { text, result } = await extractImages(urls);
      setRawText((t) => (t ? `${t}\n${text}` : text));
      setF((prev) => mergeExtraction(prev, result));
    } catch {
      /* keep the photos; user can fill the fields by hand */
    }
    setReading(false);
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(f, { photos, rawText });
    } catch (e) {
      // Surface save failures (RLS, missing RPC, bad column…) instead of crashing.
      setError((e as Error).message || String(e));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5 px-5 pb-32 pt-2">
        {/* profile */}
        <div>
          <span className={LBL}>Who is this for?</span>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {profiles.map((p) => {
              const c = memberColor(p.color_index);
              const on = f.profile_id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => set("profile_id", p.id)}
                  className="flex flex-none items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3.5"
                  style={on ? { background: c.avatar } : { background: "#fff", border: "1px solid #ececf4" }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                    style={on ? { background: "#fff", color: c.avatar } : { background: c.avatar, color: "#fff" }}
                  >
                    {p.name[0]?.toUpperCase()}
                  </span>
                  <span className="text-[13px]" style={{ fontWeight: on ? 700 : 600, color: on ? "#fff" : "#4b4a5e" }}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* documents — add a forgotten page anytime; new pages are auto-read */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className={SEC}>Documents</span>
            {reading && (
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#6366f1]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#d7d8fb] border-t-[#6366f1]" />
                Reading…
              </span>
            )}
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-12 rounded-[10px] border border-[#efeef6] object-cover" />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-[#c4c3d0] shadow-[0_1px_4px_rgba(30,27,75,0.15)]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-[#cdd0dd] bg-[#fbfbfe] py-2.5 text-[13px] font-bold text-[#6366f1]">
            + Add documents
            <input type="file" accept="image/*" multiple onChange={addDocuments} className="hidden" />
          </label>
          {photos.length > 0 && (
            <span className="text-[11.5px] font-medium text-[#9b9aaa]">
              Forgot a page? Add it and we&apos;ll read it in — filling only the blanks.
            </span>
          )}
        </div>

        {/* record */}
        <div className="flex flex-col gap-3">
          <span className={SEC}>Medical record</span>
          <div><span className={LBL}>Diagnosis *</span><input className={rec} value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} /></div>
          <div className="flex gap-2.5">
            <div className="flex-[1.4]"><span className={LBL}>Clinic *</span><input className={rec} value={f.clinic_location} onChange={(e) => set("clinic_location", e.target.value)} /></div>
            <div className="flex-1"><span className={LBL}>Date</span><input type="date" className={rec} value={f.visit_date} onChange={(e) => set("visit_date", e.target.value)} /></div>
          </div>
          <div><span className={LBL}>Disease process *</span><textarea className={`${rec} min-h-[54px]`} value={f.disease_process} onChange={(e) => set("disease_process", e.target.value)} /></div>
          <div className="flex gap-2.5">
            <div className="flex-1"><span className={LBL}>Doctor</span><input className={INP} value={f.doctor} onChange={(e) => set("doctor", e.target.value)} /></div>
            <div className="flex-1"><span className={LBL}>ICD code</span><input className={INP} value={f.icd_code} onChange={(e) => set("icd_code", e.target.value)} /></div>
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1"><span className={LBL}>Treatment</span><input className={INP} placeholder="e.g. Tại nhà" value={f.treatment_location} onChange={(e) => set("treatment_location", e.target.value)} /></div>
            <div className="flex-1"><span className={LBL}>Follow-up</span><input type="date" className={INP} value={f.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} /></div>
          </div>
        </div>

        <ListSection title="Prescription · drugs" rows={f.medications} onAdd={() => set("medications", [...f.medications, { name: "" }])}
          render={(m, i) => (
            <RowCard key={i} onRemove={() => set("medications", f.medications.filter((_, j) => j !== i))}>
              <input className={INP} placeholder="Drug name" value={m.name} onChange={(e) => set("medications", upd(f.medications, i, { name: e.target.value }))} />
              <div className="flex gap-2">
                <input className={INP} placeholder="Strength" value={m.strength ?? ""} onChange={(e) => set("medications", upd(f.medications, i, { strength: e.target.value }))} />
                <input className={INP} placeholder="Qty" value={m.quantity ?? ""} onChange={(e) => set("medications", upd(f.medications, i, { quantity: e.target.value }))} />
                <input className={INP} placeholder="Unit" value={m.unit ?? ""} onChange={(e) => set("medications", upd(f.medications, i, { unit: e.target.value }))} />
              </div>
              <input className={INP} placeholder="Usage" value={m.usage ?? ""} onChange={(e) => set("medications", upd(f.medications, i, { usage: e.target.value }))} />
            </RowCard>
          )} />

        <ListSection title="Supplements · not medication" rows={f.supplements} onAdd={() => set("supplements", [...f.supplements, { name: "" }])}
          render={(s, i) => (
            <RowCard key={i} accent="#f59e0b" onRemove={() => set("supplements", f.supplements.filter((_, j) => j !== i))}>
              <input className={INP} placeholder="Product name" value={s.name} onChange={(e) => set("supplements", upd(f.supplements, i, { name: e.target.value }))} />
              <div className="flex gap-2">
                <input className={INP} placeholder="Qty" value={s.quantity ?? ""} onChange={(e) => set("supplements", upd(f.supplements, i, { quantity: e.target.value }))} />
                <input className={INP} placeholder="Usage" value={s.usage ?? ""} onChange={(e) => set("supplements", upd(f.supplements, i, { usage: e.target.value }))} />
              </div>
            </RowCard>
          )} />

        <ListSection title="Test & scan results" rows={f.investigations} onAdd={() => set("investigations", [...f.investigations, { type: "other" }])}
          render={(iv, i) => (
            <RowCard key={i} onRemove={() => set("investigations", f.investigations.filter((_, j) => j !== i))}>
              <div className="flex gap-2">
                <select className={INP} value={iv.type} onChange={(e) => set("investigations", upd(f.investigations, i, { type: e.target.value as InvestigationType }))}>
                  {INV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className={INP} placeholder="Title" value={iv.title ?? ""} onChange={(e) => set("investigations", upd(f.investigations, i, { title: e.target.value }))} />
              </div>
              <input className={INP} placeholder="Conclusion (kết luận)" value={iv.conclusion ?? ""} onChange={(e) => set("investigations", upd(f.investigations, i, { conclusion: e.target.value }))} />
              <textarea className={`${INP} min-h-[44px]`} placeholder="Findings (optional)" value={iv.findings ?? ""} onChange={(e) => set("investigations", upd(f.investigations, i, { findings: e.target.value }))} />
            </RowCard>
          )} />

        {/* note */}
        <div className="flex flex-col gap-2.5">
          <span className={SEC}>Note · optional</span>
          <textarea
            className={`${INP} min-h-[64px]`}
            placeholder="Anything else worth remembering — advice, how they felt, questions for next time…"
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        {/* fees */}
        <div className="flex flex-col gap-3">
          <span className={SEC}>Fees · optional</span>
          <div className="flex gap-2.5">
            <div className="flex-1"><span className={LBL}>Consultation</span><input className={INP} inputMode="numeric" value={f.consultation_fee} onChange={(e) => set("consultation_fee", fmtThousands(e.target.value))} /></div>
            <div className="flex-1"><span className={LBL}>Medication</span><input className={INP} inputMode="numeric" value={f.medication_fee} onChange={(e) => set("medication_fee", fmtThousands(e.target.value))} /></div>
          </div>
          <div><span className={LBL}>Insurance</span><input className={INP} inputMode="numeric" value={f.insurance} onChange={(e) => set("insurance", fmtThousands(e.target.value))} /></div>
        </div>

        {onDelete && (
          <button
            onClick={onDelete}
            className="mt-1 rounded-[14px] border border-[#f6dde1] bg-white py-3 text-[14px] font-bold text-[#e0455a]"
          >
            Delete record
          </button>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4" style={{ background: "linear-gradient(180deg,rgba(244,244,249,0),#f4f4f9 32%)" }}>
        {error && (
          <p className="mb-2.5 rounded-[12px] border border-[#f6dde1] bg-[#fdf3f4] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#e0455a]">
            Couldn&apos;t save: {error}
          </p>
        )}
        <button onClick={submit} disabled={saving || reading || !f.profile_id} className="w-full rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-50">
          {saving ? "Saving…" : reading ? "Reading…" : submitLabel}
        </button>
      </div>
    </>
  );
}

function ListSection<T>({
  title, rows, onAdd, render,
}: {
  title: string;
  rows: T[];
  onAdd: () => void;
  render: (row: T, i: number) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">{title}</span>
      {rows.map((r, i) => render(r, i))}
      <button onClick={onAdd} className="flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-[#cdd0dd] bg-[#fbfbfe] py-2.5 text-[13px] font-bold text-[#6366f1]">
        + Add
      </button>
    </div>
  );
}

function RowCard({
  children, onRemove, accent,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  accent?: string;
}) {
  return (
    <div className="relative flex flex-col gap-2 rounded-[14px] border border-[#efeef6] bg-white p-3 shadow-[0_2px_10px_rgba(30,27,75,0.04)]" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <button onClick={onRemove} className="absolute right-2.5 top-2 text-[13px] text-[#c4c3d0]">✕</button>
      {children}
    </div>
  );
}
