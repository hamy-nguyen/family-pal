"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type Role } from "@/lib/auth";
import { Header } from "@/components/Header";

// Invite a co-caregiver. Creates a pending invitation (shows in the roster) and
// a shareable link. Phase 2: the link is emailed and the invitee accepts on
// their own device after magic-link sign-in.
export default function InviteScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("editor");
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function sendInvite() {
    if (!valid) return;
    const inv = await auth.invite(email, role);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${origin}/join/${inv.token}`);
  }
  function copy() {
    if (link) navigator.clipboard?.writeText(link);
    setCopied(true);
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header title="Invite a co-caregiver" />
      <div className="flex flex-col gap-4 px-5 pt-3">
        {!link ? (
          <>
            <p className="text-[14px] font-medium leading-[1.5] text-[#7b7a8a]">
              They&apos;ll be able to see and (if you allow) edit this family&apos;s records after they sign in.
            </p>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Their email</label>
              <input
                type="email"
                autoFocus
                inputMode="email"
                autoCapitalize="none"
                placeholder="caregiver@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[12px] border border-[#ececf4] bg-white px-3.5 py-3 text-[15px] font-semibold text-[#1e1b4b] focus:outline-none placeholder:font-medium placeholder:text-[#b4b3c2]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#8d8c9c]">Access level</label>
              <div className="flex flex-col gap-2">
                {([
                  { v: "editor", t: "Can edit", d: "Add, edit and delete records" },
                  { v: "viewer", t: "View only", d: "See records but not change them" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setRole(o.v)}
                    className="flex items-center gap-3 rounded-[14px] border bg-white p-3.5 text-left"
                    style={role === o.v ? { borderColor: "#6366f1", boxShadow: "0 0 0 1px #6366f1" } : { borderColor: "#ececf4" }}
                  >
                    <span
                      className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2"
                      style={role === o.v ? { borderColor: "#6366f1", background: "#6366f1" } : { borderColor: "#cdd0dd" }}
                    >
                      {role === o.v && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-[14px] font-bold text-[#1e1b4b]">{o.t}</span>
                      <span className="block text-[12.5px] font-medium text-[#9b9aaa]">{o.d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={sendInvite}
              disabled={!valid}
              className="mt-1 rounded-[16px] bg-[#6366f1] py-4 text-[15.5px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-40"
            >
              Send invite
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 pt-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eafaf1] text-[28px]">✅</span>
              <div className="text-[17px] font-extrabold text-[#1e1b4b]">Invite ready</div>
              <p className="text-[13.5px] font-medium leading-[1.5] text-[#7b7a8a]">
                We&apos;d normally email <span className="font-bold text-[#4b4a5e]">{email}</span> this link. In this preview, share or open it yourself to see them join.
              </p>
            </div>
            <div className="break-all rounded-[12px] border border-[#efeef6] bg-[#fbfbfe] p-3 text-[12.5px] font-medium text-[#6366f1]">{link}</div>
            <div className="flex gap-2.5">
              <button onClick={copy} className="flex-1 rounded-[14px] border border-[#ececf4] bg-white py-3 text-[14px] font-bold text-[#4b4a5e]">
                {copied ? "Copied" : "Copy link"}
              </button>
              <button onClick={() => router.push(link.replace(/^https?:\/\/[^/]+/, ""))} className="flex-1 rounded-[14px] bg-[#6366f1] py-3 text-[14px] font-bold text-white">
                Open as invitee
              </button>
            </div>
            <button onClick={() => router.push("/household")} className="text-[13.5px] font-semibold text-[#8d8c9c]">
              Back to household
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
