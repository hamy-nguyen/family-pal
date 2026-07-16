// Shared presentation helpers + inline icons for all screens (Home, Capture,
// Detail). Centralized so category colors, member colors, and icon paths stay
// consistent across the redesigned flow. Icons are inline SVG (no icon-lib dep).

import type { FC } from "react";

// ---------- member colors (deterministic by index) ----------
export const MEMBER_COLORS = [
  { avatar: "#ec4899", tint: "#fde8f0", text: "#be185d" },
  { avatar: "#3b82f6", tint: "#e6f0fe", text: "#1d4ed8" },
  { avatar: "#8b5cf6", tint: "#f1ebfd", text: "#6d28d9" },
  { avatar: "#0d9488", tint: "#d9f2ef", text: "#0f766e" },
  { avatar: "#f59e0b", tint: "#fdf0d5", text: "#b45309" },
  { avatar: "#10b981", tint: "#dcf5ea", text: "#047857" },
];
export type MemberColor = (typeof MEMBER_COLORS)[number];
export function memberColor(index: number): MemberColor {
  return MEMBER_COLORS[(index < 0 ? 0 : index) % MEMBER_COLORS.length];
}

// ---------- dates ----------
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export function fmtLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
export function fmtMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ---------- category derivation (Vietnamese + English keywords) ----------
export type Cat = { tint: string; color: string; Icon: FC<{ size?: number }> };
export function categoryFor(s: string): Cat {
  const t = (s || "").toLowerCase();
  const has = (...k: string[]) => k.some((x) => t.includes(x));
  if (has("răng", "nha", "dental", "tooth", "sâu răng"))
    return { tint: "#e6effb", color: "#3b73c4", Icon: ToothIcon };
  if (has("dị ứng", "mề đay", "allergy", "pollen"))
    return { tint: "#efe9fb", color: "#6d52c4", Icon: LeafIcon };
  if (has("họng", "tai", "mũi", "amidan", "ent", "throat", "ear"))
    return { tint: "#fdecd8", color: "#d97a2b", Icon: EarIcon };
  if (has("tiêm", "vắc", "vaccin", "khám sức khỏe", "tái khám", "check"))
    return { tint: "#e3f4ea", color: "#2f9e6f", Icon: ShieldCheckIcon };
  if (has("da", "chàm", "eczema", "mẩn", "skin", "tay chân miệng"))
    return { tint: "#e1f1f2", color: "#2c8f93", Icon: DropletIcon };
  if (has("sốt", "cúm", "cảm", "cold", "fever", "flu", "virus", "covid"))
    return { tint: "#fde7e9", color: "#d6455a", Icon: ThermometerIcon };
  return { tint: "#eceef3", color: "#6b6a7b", Icon: ActivityIcon };
}

// ---------- icon primitives ----------
const ST = {
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function catSvg(size: number, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} {...ST}>
      {children}
    </svg>
  );
}

// category glyphs
export const EarIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, (
    <>
      <path d="M8 10a4 4 0 1 1 7 2.6c-1 1.1-2 1.4-2 2.9a2.5 2.5 0 0 1-4.6 1.4" />
      <path d="M10.5 9.5a1.6 1.6 0 0 1 2.7 1.1" />
    </>
  ));
export const ThermometerIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, (
    <>
      <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
      <path d="M12 9v6" />
    </>
  ));
export const ShieldCheckIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, (
    <>
      <path d="M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9Z" />
      <path d="m9 11 2 2 4-4" />
    </>
  ));
export const DropletIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, <path d="M12 3.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0Z" />);
export const ToothIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(
    size,
    <path d="M12 4c-2.2 0-3.5 1-3.5 3 0 .9.3 1.8.6 3 .4 1.7.4 4 1.2 5.5.3.6 1.1.6 1.4 0 .5-1 .4-2.5.8-2.5s.3 1.5.8 2.5c.3.6 1.1.6 1.4 0 .8-1.5.8-3.8 1.2-5.5.3-1.2.6-2.1.6-3 0-2-1.3-3-3.5-3-1 0-1.5.4-2.1.4S13 4 12 4Z" />
  );
export const LeafIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, (
    <>
      <path d="M5 18C5 10 10 5 19 5c0 9-5 13-14 13Z" />
      <path d="M6.5 16.5c2-4 5-6 9-7" />
    </>
  ));
export const ActivityIcon: FC<{ size?: number }> = ({ size = 24 }) =>
  catSvg(size, <path d="M22 12h-4l-3 9L9 3l-3 9H2" />);

// chrome icons
export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#a3a2b4" strokeWidth={2} {...ST}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
export function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} {...ST}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
export function SlidersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={2.2} {...ST}>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}
export function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" stroke="#b4b3c2" strokeWidth={2.2} {...ST}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
export function CameraIcon({ size = 20, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={stroke} strokeWidth={2} {...ST}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
export function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#4b4a5e" strokeWidth={2.4} {...ST}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
export function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" stroke="#c4c3d0" strokeWidth={2.4} {...ST}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
export function CheckIcon({ size = 13, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={stroke} strokeWidth={3} {...ST}>
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}
export function SparkleIcon({ size = 18, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={stroke} strokeWidth={2.2} {...ST}>
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3Z" />
    </svg>
  );
}
export function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#a3a2b4" strokeWidth={2} {...ST}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}
export function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" stroke="#4b4a5e" strokeWidth={2} {...ST}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
export function PillIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} {...ST}>
      <path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  );
}
