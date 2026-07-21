"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type Role } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";

// Invite several people at once, each with their own access. Add-to-list pattern:
// type an email + pick a role -> Add; repeat; then Send. Results show each invitee
// with their own Copy / Email (mailto — works with no email service).
const ROLE_OPTS: { v: Role; t: string }[] = [
  { v: "owner", t: "Co-manager · full access" },
  { v: "editor", t: "Can edit records" },
  { v: "viewer", t: "View only" },
];
const ROLE_LABEL: Record<Role, string> = { owner: "Co-manager", editor: "Can edit", viewer: "View only" };

type Staged = { email: string; role: Role };
type Ready = Staged & { link: string };

const INP =
  "w-full rounded-[12px] border border-[#ececf4] bg-white px-3.5 py-3 text-[15px] font-semibold text-[#1e1b4b] focus:outline-none placeholder:font-medium placeholder:text-[#b4b3c2]";

export default function InviteScreen() {
  const router = useRouter();
  const { can } = useAuth();
  // Inviting people (especially as co-manager) is owner-only.
  useEffect(() => {
    if (!can("members:manage")) router.replace("/household");
  }, [can, router]);

  // Where "Done" lands: onboarding → the records screen; otherwise → the household roster.
  const [fromOnboarding, setFromOnboarding] = useState(false);
  useEffect(() => {
    setFromOnboarding(new URLSearchParams(window.location.search).get("from") === "onboarding");
  }, []);
  const doneHref = fromOnboarding ? "/" : "/household";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [list, setList] = useState<Staged[]>([]);
  const [ready, setReady] = useState<Ready[] | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean);
  const dup = list.some((x) => x.email === clean);

  function add() {
    if (!validEmail || dup) return;
    setList((l) => [...l, { email: clean, role }]);
    setEmail("");
    setRole("editor");
  }
  async function send() {
    if (list.length === 0) return;
    setSending(true);
    try {
      const origin = window.location.origin;
      const out: Ready[] = [];
      for (const it of list) {
        const inv = await auth.invite(it.email, it.role);
        out.push({ ...it, link: `${origin}/join/${inv.token}` });
      }
      setReady(out);
    } finally {
      setSending(false);
    }
  }
  const mailto = (r: Ready) =>
    `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(
      "Join our family on Family Pal",
    )}&body=${encodeURIComponent(
      `I'd like you to help manage our family's medical records on Family Pal.\n\nAccept the invite here:\n${r.link}`,
    )}`;

  // ---------- results ----------
  if (ready) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Invites ready" back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pt-3">
          <p className="text-[13.5px] font-medium leading-[1.5] text-[#7b7a8a]">
            Send each person their link — copy it or email it (opens your mail app). They join after signing in.
          </p>
          {ready.map((r) => (
            <div key={r.link} className="flex flex-col gap-2 rounded-[14px] border border-[#efeef6] bg-white p-3.5 shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#1e1b4b]">{r.email}</span>
                <span className="rounded-full bg-[#eef0f4] px-2.5 py-0.5 text-[11px] font-bold text-[#8d8c9c]">{ROLE_LABEL[r.role]}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard?.writeText(r.link); setCopied(r.link); }} className="flex-1 rounded-[11px] border border-[#ececf4] bg-white py-2.5 text-[13px] font-bold text-[#4b4a5e]">
                  {copied === r.link ? "Copied" : "Copy link"}
                </button>
                <a href={mailto(r)} className="flex-1 rounded-[11px] bg-[#6366f1] py-2.5 text-center text-[13px] font-bold text-white">Email</a>
              </div>
            </div>
          ))}
          <button onClick={() => router.replace(doneHref)} className="mt-2 rounded-[16px] bg-[#1e1b4b] py-4 text-[15.5px] font-bold text-white">
            {fromOnboarding ? "Done → your records" : "Done"}
          </button>
        </div>
      </main>
    );
  }

  // ---------- compose ----------
  return (
    <main className="flex flex-1 flex-col">
      <Header title="Invite people" />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-3">
        <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
          Invite a co-manager, or give someone edit or view-only access. Add as many people as you like — each with their own access level.
        </p>

        <div className="flex flex-col gap-2.5">
          <input
            type="email" inputMode="email" autoCapitalize="none" autoFocus
            placeholder="name@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className={INP}
          />
          <div className="flex gap-2.5">
            <select
              value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="min-w-0 flex-1 rounded-[12px] border border-[#ececf4] bg-white px-3 py-3 text-[14px] font-bold text-[#4b4a5e] focus:outline-none"
            >
              {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
            <button
              onClick={add} disabled={!validEmail || dup}
              className="rounded-[12px] bg-[#eef0fe] px-5 text-[14px] font-bold text-[#6366f1] disabled:opacity-40"
            >
              + Add
            </button>
          </div>
          {dup && <span className="text-[12px] font-medium text-[#e0455a]">That email is already on the list.</span>}
        </div>

        {list.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">
              Invites ({list.length})
            </span>
            {list.map((it, i) => (
              <div key={it.email} className="flex items-center gap-2 rounded-[12px] border border-[#efeef6] bg-white px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#1e1b4b]">{it.email}</span>
                <span className="rounded-full bg-[#eef0f4] px-2 py-0.5 text-[11px] font-bold text-[#8d8c9c]">{ROLE_LABEL[it.role]}</span>
                <button onClick={() => setList((l) => l.filter((_, idx) => idx !== i))} aria-label={`Remove ${it.email}`} className="px-1 text-[15px] text-[#c4c3d0]">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            onClick={send} disabled={list.length === 0 || sending}
            className="rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-40"
          >
            {sending ? "Creating…" : list.length ? `Send ${list.length} invite${list.length > 1 ? "s" : ""}` : "Send invites"}
          </button>
          {fromOnboarding && (
            <button onClick={() => router.replace("/")} className="py-1 text-[13.5px] font-semibold text-[#8d8c9c]">
              Skip for now
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
