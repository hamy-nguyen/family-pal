"use client";

import { useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { auth } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";
import { Header } from "@/components/Header";

export default function SetupScreen() {
  const router = useRouter();
  return (
    <main className="flex flex-1 flex-col">
      <Header title="Set up your profile" subtitle="Step 1 · This is you" back={false} />
      <div className="px-5 pb-10 pt-2">
        <ProfileForm
          initial={{ name: "", relationship: "self", color_index: 2 }}
          submitLabel="Continue"
          onSave={async (p) => {
            const { id: _id, ...input } = p; // strip any id on create
            void _id;
            await repo().createProfile(input);
            // Personalize the owner + the (still-editable) household default now
            // that we know the caregiver's real name.
            if (input.name) {
              await auth.setOwnerName(input.name);
              // solo-first: name the space after the person; they can rename it to
              // a family name once they add members.
              await auth.updateHouseholdName(input.name);
            }
            router.replace("/");
          }}
        />
      </div>
    </main>
  );
}
