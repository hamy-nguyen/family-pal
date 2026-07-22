// Shared presentation helpers + icons for all screens (Home, Capture, Detail).
// Centralized so category colors, member colors, and icons stay consistent.
// Icons are Lucide (lucide-react), wrapped here under stable names so screens
// import the same components regardless of the underlying icon set.

import type { FC } from "react";
import {
  Ear,
  Thermometer,
  ShieldCheck,
  Droplet,
  Leaf,
  Activity,
  Search,
  Users,
  SlidersHorizontal,
  MapPin,
  Camera,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Pencil,
  SquarePen,
  Pill,
} from "lucide-react";

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

// Accent-insensitive normalizer for search: strips Vietnamese diacritics and
// folds đ/Đ (which NFD doesn't decompose) so "viem" matches "viêm", "da day"
// matches "dạ dày", etc. Lowercased for case-insensitivity.
export const deaccent = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

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

// ---------- category glyphs (Lucide; sized via the `size` prop) ----------
export const EarIcon: FC<{ size?: number }> = ({ size = 24 }) => <Ear size={size} strokeWidth={1.8} />;
export const ThermometerIcon: FC<{ size?: number }> = ({ size = 24 }) => <Thermometer size={size} strokeWidth={1.8} />;
export const ShieldCheckIcon: FC<{ size?: number }> = ({ size = 24 }) => <ShieldCheck size={size} strokeWidth={1.8} />;
export const DropletIcon: FC<{ size?: number }> = ({ size = 24 }) => <Droplet size={size} strokeWidth={1.8} />;
export const LeafIcon: FC<{ size?: number }> = ({ size = 24 }) => <Leaf size={size} strokeWidth={1.8} />;
export const ActivityIcon: FC<{ size?: number }> = ({ size = 24 }) => <Activity size={size} strokeWidth={1.8} />;
// Lucide has no tooth icon, so this dental glyph stays custom, drawn to match the Lucide stroke style.
export const ToothIcon: FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5c-2.2 0-3.5 1-3.5 3 0 .9.3 1.8.6 3 .4 1.7.4 4 1.2 5.5.3.6 1.1.6 1.4 0 .5-1 .4-2.5.8-2.5s.3 1.5.8 2.5c.3.6 1.1.6 1.4 0 .8-1.5.8-3.8 1.2-5.5.3-1.2.6-2.1.6-3 0-2-1.3-3-3.5-3-1 0-1.5.4-2.1.4S13 5.5 12 5.5Z" />
  </svg>
);

// ---------- chrome icons (Lucide; same names/sizes/colors as before) ----------
export function SearchIcon() {
  return <Search size={18} color="#a3a2b4" strokeWidth={2} />;
}
export function UsersIcon() {
  return <Users size={22} color="#fff" strokeWidth={2} />;
}
export function SlidersIcon() {
  return <SlidersHorizontal size={14} color="#6366f1" strokeWidth={2.2} />;
}
export function MapPinIcon() {
  return <MapPin size={12} color="#b4b3c2" strokeWidth={2.2} />;
}
export function CameraIcon({ size = 20, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return <Camera size={size} color={stroke} strokeWidth={2} />;
}
export function ChevronLeftIcon() {
  return <ChevronLeft size={18} color="#4b4a5e" strokeWidth={2.4} />;
}
export function ChevronRightIcon() {
  return <ChevronRight size={16} color="#c4c3d0" strokeWidth={2.4} />;
}
export function CheckIcon({ size = 13, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return <Check size={size} color={stroke} strokeWidth={3} />;
}
export function SparkleIcon({ size = 18, stroke = "#fff" }: { size?: number; stroke?: string }) {
  return <Sparkles size={size} color={stroke} strokeWidth={2.2} />;
}
export function EditIcon() {
  return <SquarePen size={18} color="#a3a2b4" strokeWidth={2} />;
}
export function PencilIcon() {
  return <Pencil size={17} color="#4b4a5e" strokeWidth={2} />;
}
export function PillIcon() {
  return <Pill size={18} strokeWidth={1.8} />;
}
