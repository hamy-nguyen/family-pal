"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type Member, type Role } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { memberColor, PencilIcon } from "@/lib/ui";
import { ROLE_LABEL, ROLE_DESC } from "@/lib/permissions";

const PREVIEW_ROLES: Role[] = ["owner", "editor", "viewer"];

export default function HouseholdScreen() {
  const router = useRouter();
  const { session, can, role, realRole, setPreviewRole } = useAuth();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const canManage = can("members:manage"); // effective (preview-aware)
  const canRename = can("household:rename");

  async function reload() {
    const [h, m] = await Promise.all([auth.getHousehold(), auth.listMembers()]);
    setName(h?.name ?? "");
    setMembers(m);
  }
  useEffect(() => {
    void reload();
  }, []);

  async function saveName() {
    await auth.updateHouseholdName(name);
    setEditingName(false);
    void reload();
  }
  async function setRole(id: string, role: Role) {
    await auth.setMemberRole(id, role);
    void reload();
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name} from this family?`)) return;
    await auth.removeMember(m.id);
    void reload();
  }

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header title="Household" />
      <div className="flex flex-col gap-5 px-5 pt-2">
        {/* name */}
        <div className="rounded-[18px] border border-[#efeef6] bg-white p-[18px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">Family name</span>
          {editingName ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="min-w-0 flex-1 rounded-[12px] border border-[#ececf4] bg-white px-3 py-2.5 text-[15px] font-bold text-[#1e1b4b] focus:outline-none"
              />
              <button onClick={saveName} className="rounded-[12px] bg-[#6366f1] px-4 text-[13.5px] font-bold text-white">Save</button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <span className="flex-1 text-[18px] font-extrabold text-[#1e1b4b]">{name}</span>
              {canRename && (
                <button onClick={() => setEditingName(true)} aria-label="Rename" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ececf4] text-[#8d8c9c]">
                  <PencilIcon />
                </button>
              )}
            </div>
          )}
        </div>

        {/* members */}
        <div className="flex flex-col gap-2.5">
          <span className="px-0.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">People with access</span>
          <p className="px-0.5 text-[12.5px] font-medium leading-[1.45] text-[#9b9aaa]">
            Caregivers who can sign in and share this family&apos;s records. This is separate from the family members whose records you track.
          </p>

          {members.map((m, i) => {
            const c = memberColor(i);
            const isMe = m.user_id === session?.user.id;
            const canEdit = canManage && m.role !== "owner";
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-[16px] border border-[#efeef6] bg-white p-[14px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: c.avatar }}>
                  {m.name[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-bold text-[#1e1b4b]">{isMe ? "You" : m.name}</span>
                    {m.status === "pending" && (
                      <span className="rounded-full bg-[#fff5e6] px-1.5 py-0.5 text-[10.5px] font-bold text-[#d0900f]">pending</span>
                    )}
                  </div>
                  <div className="truncate text-[12px] font-medium text-[#9b9aaa]">{m.email}</div>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={m.role}
                      onChange={(e) => setRole(m.id, e.target.value as Role)}
                      className="rounded-[10px] border border-[#ececf4] bg-white py-1.5 pl-2 pr-1 text-[12px] font-bold text-[#4b4a5e] focus:outline-none"
                    >
                      <option value="owner">Co-manager</option>
                      <option value="editor">Can edit</option>
                      <option value="viewer">View only</option>
                    </select>
                    <button onClick={() => remove(m)} aria-label="Remove" className="px-1 text-[15px] text-[#c4c3d0]">✕</button>
                  </div>
                ) : (
                  <span className="rounded-full bg-[#eef0f4] px-2.5 py-1 text-[11.5px] font-bold text-[#8d8c9c]">{ROLE_LABEL[m.role]}</span>
                )}
              </div>
            );
          })}

          {canManage && (
            <button
              onClick={() => router.push("/household/invite")}
              className="mt-1 flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#cdd0dd] bg-[#fbfbfe] py-3 text-[13.5px] font-bold text-[#6366f1]"
            >
              + Invite a co-caregiver
            </button>
          )}
          {!canManage && (
            <p className="px-0.5 text-[12.5px] font-medium text-[#9b9aaa]">
              Only the owner can invite people or change roles.
            </p>
          )}
        </div>

        {/* Owner-only demo aid: preview the app as a lower role to check access. */}
        {realRole === "owner" && (
          <div className="rounded-[18px] border border-[#efeef6] bg-white p-[18px] shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">Preview role</span>
            <p className="mt-1 mb-3 text-[12.5px] font-medium leading-[1.45] text-[#9b9aaa]">
              See exactly what a co-caregiver can do. Preview only — it never changes your real access.
            </p>
            <div className="flex gap-2">
              {PREVIEW_ROLES.map((r) => {
                const on = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setPreviewRole(r === "owner" ? null : r)}
                    className="flex-1 rounded-[12px] border py-2 text-center"
                    style={on ? { borderColor: "#6366f1", background: "#eef0fe" } : { borderColor: "#ececf4", background: "#fff" }}
                  >
                    <span className="block text-[13px] font-bold" style={{ color: on ? "#6366f1" : "#4b4a5e" }}>{ROLE_LABEL[r]}</span>
                    <span className="block text-[10.5px] font-medium text-[#9b9aaa]">{ROLE_DESC[r]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
