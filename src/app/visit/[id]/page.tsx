"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { categoryFor, fmtLongDate, memberColor, PillIcon, ActivityIcon, PencilIcon, type MemberColor } from "@/lib/ui";
import type { Profile, Visit } from "@/lib/types";

const parseMoney = (s?: string) => {
  const n = parseInt((s ?? "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};
const fmtMoney = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

export default function VisitDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = repo();
    Promise.all([r.getVisit(id), r.listProfiles()]).then(([v, p]) => {
      setVisit(v);
      setProfiles(p);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-[#a3a2b4]">Loading…</p>;
  if (!visit) return <p className="p-6 text-sm text-[#a3a2b4]">Not found.</p>;

  const cat = categoryFor(visit.diagnosis);
  const color = memberColor(profiles.find((p) => p.id === visit.profile_id)?.color_index ?? 0);
  const cons = parseMoney(visit.consultation_fee);
  const medf = parseMoney(visit.medication_fee);
  const total = cons + medf;
  const ins = parseMoney(visit.insurance);
  const when = visit.visit_date || visit.created_at;

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header
        title="Visit"
        right={
          can("records:edit") ? (
            <Link
              href={`/visit/${visit.id}/edit`}
              aria-label="Edit"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[#ececf4] bg-white shadow-[0_2px_8px_rgba(30,27,75,0.04)]"
            >
              <PencilIcon />
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-5 pt-2">
        {/* hero */}
        <div className="flex flex-col gap-4 rounded-[20px] border border-[#efeef6] bg-white p-5 shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
          <div className="flex items-center gap-[14px]">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[16px]" style={{ background: cat.tint, color: cat.color }}>
              <cat.Icon size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1e1b4b]">{visit.diagnosis || "Visit"}</div>
              <div className="mt-0.5 text-[13px] font-medium text-[#9b9aaa]">
                {visit.icd_code ? `${visit.icd_code} · ` : ""}{fmtLongDate(when)}
              </div>
            </div>
          </div>
          {(visit.profile_name || total > 0) && (
            <div className="flex items-center justify-between border-t border-[#f1f1f7] pt-4">
              {visit.profile_name ? <MemberChip name={visit.profile_name} color={color} /> : <span />}
              {total > 0 && (
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a2b4]">Total</div>
                  <div className="text-[20px] font-extrabold text-[#1e1b4b]">{fmtMoney(total)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* record table */}
        {(visit.clinic_location || visit.doctor || visit.treatment_location || visit.follow_up_date) && (
          <div className="rounded-[20px] border border-[#efeef6] bg-white px-[18px] py-1.5 shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
            <Row label="Clinic" value={visit.clinic_location} />
            <Row label="Doctor" value={visit.doctor} />
            <Row label="Treatment" value={visit.treatment_location} />
            <Row label="Follow-up" value={visit.follow_up_date} valueColor="#6366f1" />
          </div>
        )}

        {visit.disease_process && (
          <Card><SecLabel>Disease process</SecLabel><p className="text-[14px] font-medium leading-[1.55] text-[#4b4a5e]">{visit.disease_process}</p></Card>
        )}

        {visit.note && (
          <Card><SecLabel>Note</SecLabel><p className="whitespace-pre-wrap text-[14px] font-medium leading-[1.55] text-[#4b4a5e]">{visit.note}</p></Card>
        )}

        {/* paraclinical */}
        {visit.investigations.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <SecLabel className="ml-0.5">Test &amp; scan results</SecLabel>
            {visit.investigations.map((iv) => (
              <div key={iv.id ?? iv.title} className="flex items-center gap-[11px] rounded-[18px] border border-[#efeef6] bg-white p-[13px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-[#eef0f4] text-[#6b6a7b]"><ActivityIcon size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold capitalize text-[#1e1b4b]">{iv.title || iv.type}</div>
                  <div className="truncate text-[12.5px] font-medium text-[#8d8c9c]">{iv.conclusion || iv.findings || iv.type}</div>
                </div>
                {iv.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iv.image_url} alt="" className="h-11 w-[34px] rounded-md object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* prescription */}
        {visit.medications.length > 0 && (
          <Card gap="11px"><SecLabel>Prescription</SecLabel>
            {visit.medications.map((m) => (
              <div key={m.id ?? m.name} className="flex items-center gap-[11px]">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[#eef0fe] text-[#6366f1]"><PillIcon /></span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-[#1e1b4b]">{[m.name, m.strength].filter(Boolean).join(" ")}</div>
                  <div className="text-[12px] font-medium text-[#9b9aaa]">{[m.usage, [m.quantity, m.unit].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* supplements */}
        {visit.supplements.length > 0 && (
          <Card gap="8px"><SecLabel>Supplements</SecLabel>
            {visit.supplements.map((s) => (
              <div key={s.id ?? s.name} className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-[#1e1b4b]">{s.name} <span className="text-[12px] font-medium text-[#9b9aaa]">· không phải thuốc</span></span>
                <span className="text-[12.5px] font-semibold text-[#9b9aaa]">{[s.quantity].filter(Boolean).join(" ")}</span>
              </div>
            ))}
          </Card>
        )}

        {/* fees breakdown */}
        {(total > 0 || ins > 0) && (
          <Card gap="8px">
            <SecLabel>Fees</SecLabel>
            {cons > 0 && <FeeRow label="Consultation" value={fmtMoney(cons)} />}
            {medf > 0 && <FeeRow label="Medication" value={fmtMoney(medf)} />}
            <div className="flex justify-between border-t border-[#f1f1f7] pt-2">
              <span className="text-[13px] font-bold text-[#1e1b4b]">Total fees</span>
              <span className="text-[14px] font-extrabold text-[#1e1b4b]">{fmtMoney(total)}</span>
            </div>
            {ins > 0 && <FeeRow label="Insurance" value={`− ${fmtMoney(ins)}`} muted />}
            {ins > 0 && (
              <div className="flex justify-between border-t border-[#f1f1f7] pt-2">
                <span className="text-[13px] font-bold text-[#1e1b4b]">Out of pocket</span>
                <span className="text-[15px] font-extrabold text-[#2f9e6f]">{fmtMoney(Math.max(0, total - ins))}</span>
              </div>
            )}
          </Card>
        )}

        {/* photos */}
        {visit.attachments.length > 0 && (
          <div>
            <SecLabel className="ml-0.5">Attached photos</SecLabel>
            <div className="mt-2.5 grid grid-cols-3 gap-2.5">
              {visit.attachments.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={a.id ?? a.image_url} src={a.image_url} alt={a.caption || ""} className="aspect-[3/4] w-full rounded-[12px] object-cover" />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ children, gap = "8px" }: { children: React.ReactNode; gap?: string }) {
  return (
    <div className="flex flex-col rounded-[20px] border border-[#efeef6] bg-white px-[18px] py-4 shadow-[0_4px_18px_rgba(30,27,75,0.05)]" style={{ gap }}>
      {children}
    </div>
  );
}
function SecLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4] ${className ?? ""}`}>{children}</span>;
}
function Row({ label, value, valueColor }: { label: string; value?: string; valueColor?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f1f1f7] py-[13px] last:border-0">
      <span className="text-[13px] font-medium text-[#9b9aaa]">{label}</span>
      <span className="text-right text-[14px] font-bold text-[#1e1b4b]" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  );
}
function FeeRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[13px] font-medium text-[#7b7a8a]">{label}</span>
      <span className={`text-[14px] ${muted ? "font-semibold text-[#9b9aaa]" : "font-bold text-[#1e1b4b]"}`}>{value}</span>
    </div>
  );
}
function MemberChip({ name, color }: { name: string; color: MemberColor }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full py-[5px] pl-[5px] pr-3" style={{ background: color.tint }}>
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color.avatar }}>{name[0]?.toUpperCase()}</span>
      <span className="text-[13px] font-bold" style={{ color: color.text }}>{name}</span>
    </span>
  );
}
