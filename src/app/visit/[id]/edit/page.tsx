"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { supabaseConfigured } from "@/lib/supabase";
import { uploadImages } from "@/lib/uploadImage";
import { Header } from "@/components/Header";
import { VisitForm, type VisitFormValue } from "@/components/VisitForm";
import type { Profile, Visit } from "@/lib/types";

function toValue(v: Visit): VisitFormValue {
  return {
    profile_id: v.profile_id,
    diagnosis: v.diagnosis ?? "",
    clinic_location: v.clinic_location ?? "",
    visit_date: v.visit_date ?? "",
    disease_process: v.disease_process ?? "",
    doctor: v.doctor ?? "",
    icd_code: v.icd_code ?? "",
    treatment_note: v.treatment_note ?? "",
    treatment_location: v.treatment_location ?? "",
    follow_up_date: v.follow_up_date ?? "",
    note: v.note ?? "",
    consultation_fee: v.consultation_fee ?? "",
    medication_fee: v.medication_fee ?? "",
    insurance: v.insurance ?? "",
    medications: v.medications ?? [],
    supplements: v.supplements ?? [],
    investigations: v.investigations ?? [],
  };
}

export default function EditVisitScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [initial, setInitial] = useState<VisitFormValue | null>(null);

  // Viewers can't edit — bounce anyone who reaches this by URL.
  useEffect(() => {
    if (!can("records:edit")) router.replace(`/visit/${id}`);
  }, [can, router, id]);

  useEffect(() => {
    const r = repo();
    Promise.all([r.getVisit(id), r.listProfiles()]).then(([v, p]) => {
      setProfiles(p);
      setVisit(v);
      if (v) setInitial(toValue(v));
    });
  }, [id]);

  if (!visit || !initial)
    return <p className="p-6 text-sm text-[#a3a2b4]">Loading…</p>;

  return (
    <main className="relative flex flex-1 flex-col">
      <Header title="Edit record" />
      <VisitForm
        profiles={profiles}
        initial={initial}
        initialPhotos={visit.attachments?.map((a) => a.image_url) ?? []}
        initialRawText={visit.raw_text ?? ""}
        submitLabel="Save changes"
        onSubmit={async (val, media) => {
          // Photos live in the form (user can add docs while editing). With Supabase
          // on, uploadImages turns new data-URLs into Storage paths and recovers the
          // path from any already-signed URL, so we never persist an expiring URL.
          const photos = supabaseConfigured ? await uploadImages(media.photos) : media.photos;
          await repo().updateVisit({
            ...visit,
            ...val,
            attachments: photos.filter(Boolean).map((url) => ({ kind: "other" as const, image_url: url })),
            raw_text: media.rawText || visit.raw_text,
          });
          router.back();
        }}
        onDelete={
          can("records:delete")
            ? async () => {
                if (confirm("Delete this record? This can't be undone.")) {
                  await repo().deleteVisit(visit.id);
                  router.push("/");
                }
              }
            : undefined
        }
      />
    </main>
  );
}
