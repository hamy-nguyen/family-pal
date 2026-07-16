"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { ProfileForm, type ProfileDraft } from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";

export default function EditProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const isNew = id === "new";
  const [initial, setInitial] = useState<ProfileDraft | null>(
    isNew ? { name: "", relationship: "other", color_index: 0 } : null
  );

  // Managing patient profiles is owner/editor only.
  useEffect(() => {
    if (!can("profiles:manage")) router.replace("/profiles");
  }, [can, router]);

  useEffect(() => {
    if (isNew) return;
    repo()
      .getProfile(id)
      .then((p) => setInitial(p ?? { name: "", relationship: "other", color_index: 0 }));
  }, [id, isNew]);

  if (!initial) return <p className="p-6 text-sm text-[#a3a2b4]">Loading…</p>;

  return (
    <main className="flex flex-1 flex-col">
      <Header title={isNew ? "New profile" : "Edit profile"} />
      <div className="px-5 pb-10 pt-2">
        <ProfileForm
          initial={initial}
          submitLabel="Save"
          onSave={async (p) => {
            if (isNew) {
              const { id: _id, ...input } = p;
              void _id;
              await repo().createProfile(input);
            } else {
              await repo().updateProfile({ ...(initial as Profile), ...p } as Profile);
            }
            router.back();
          }}
          onDelete={
            isNew
              ? undefined
              : async () => {
                  if (confirm("Delete this profile and all its records?")) {
                    await repo().deleteProfile(id);
                    router.push("/profiles");
                  }
                }
          }
        />
      </div>
    </main>
  );
}
