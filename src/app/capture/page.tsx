"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { useAuth } from "@/components/AuthProvider";
import { supabaseConfigured } from "@/lib/supabase";
import { uploadImages } from "@/lib/uploadImage";
import { takePendingImages } from "@/lib/captureBuffer";
import { Header } from "@/components/Header";
import { SparkleIcon } from "@/lib/ui";
import { extractImages } from "@/lib/extract";
import { AddPhotos, PhotoSourceRow } from "@/components/AddPhotos";
import { PhotoViewer } from "@/components/PhotoViewer";
import { VisitForm, EMPTY_VISIT_VALUE, mergeExtraction, type VisitFormValue } from "@/components/VisitForm";
import type { Profile } from "@/lib/types";

type Step = "documents" | "extracting" | "review";
type Stage = "ocr" | "structure";

export default function CaptureScreen() {
  const router = useRouter();
  const { can } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [value, setValue] = useState<VisitFormValue>(EMPTY_VISIT_VALUE);
  const [photos, setPhotos] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<Step>("documents");
  const [stage, setStage] = useState<Stage>("ocr");
  const [error, setError] = useState<string>();
  const [viewer, setViewer] = useState<number | null>(null); // open photo index

  // Viewers can't create records — bounce anyone who reaches this by URL.
  useEffect(() => {
    if (!can("records:create")) router.replace("/");
  }, [can, router]);

  useEffect(() => {
    repo().listProfiles().then((p) => {
      setProfiles(p);
      setValue((v) => ({ ...v, profile_id: p[0]?.id ?? "" }));
    });
    const imgs = takePendingImages();
    if (imgs.length) {
      setPhotos(imgs);
      extractFrom(imgs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function extractFrom(imgs: string[]) {
    const list = imgs.filter(Boolean);
    if (list.length === 0) return;
    setError(undefined);
    setStage("ocr");
    setStep("extracting");
    try {
      // Same pipeline + merge rule the review form uses for "add a page" re-reads.
      const { text, result } = await extractImages(list, setStage);
      setRawText(text);
      setValue((v) => mergeExtraction(v, result));
      setStep("review");
    } catch (e) {
      // Not swallowed: show the reason; user can retry or type it in by hand.
      setError((e as Error).message || "Reading failed.");
    }
  }

  // photos/rawText now come back from the form — the user may have added more
  // documents on the review screen after the first read.
  async function save(v: VisitFormValue, media: { photos: string[]; rawText: string }) {
    // With Supabase on, push photos to Storage first and store their paths.
    const photos = supabaseConfigured ? await uploadImages(media.photos) : media.photos;
    await repo().saveVisit({
      ...v,
      attachments: photos.filter(Boolean).map((url) => ({ kind: "other" as const, image_url: url })),
      raw_text: media.rawText || undefined,
    });
    router.push("/");
  }

  const title = step === "review" ? "Review & save" : "New record";
  const sub =
    step === "documents" ? "Step 1 of 2 · Add documents"
      : step === "extracting" ? "Reading your documents…"
      : "Step 2 of 2 · Check the details";

  return (
    <main className="relative flex flex-1 flex-col">
      <Header title={title} subtitle={sub} />

      {step === "documents" && (
        <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#a3a2b4]">
              The papers you received
            </span>
            <span className="text-[13.5px] font-medium leading-[1.5] text-[#7b7a8a]">
              Add everything — record, prescription, test &amp; scan results. We&apos;ll read them.
            </span>
          </div>
          {photos.map((src, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[16px] border border-[#efeef6] bg-white p-3 shadow-[0_4px_18px_rgba(30,27,75,0.05)]">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" onClick={() => setViewer(i)} className="h-14 w-11 cursor-pointer rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-11 animate-pulse rounded-lg bg-[#eef0f4]" />
              )}
              <button onClick={() => setViewer(i)} className="flex-1 text-left text-[13.5px] font-semibold text-[#4b4a5e]">Document {i + 1}</button>
              <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="text-[#c4c3d0]">✕</button>
            </div>
          ))}
          <AddPhotos onPhotos={(urls) => setPhotos((p) => [...p, ...urls])}>
            {(a) => <PhotoSourceRow {...a} />}
          </AddPhotos>
          <button
            onClick={() => extractFrom(photos)}
            disabled={photos.filter(Boolean).length === 0}
            className="mt-1 flex items-center justify-center gap-2 rounded-[16px] bg-[#6366f1] py-4 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)] disabled:opacity-40"
          >
            <SparkleIcon /> Read with AI
          </button>
          <button onClick={() => setStep("review")} className="text-[13.5px] font-semibold text-[#8d8c9c]">
            Or fill in by hand
          </button>
        </div>
      )}

      {step === "extracting" && !error && (
        <div className="flex flex-col items-center gap-6 px-5 pt-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#e6e6f6] border-t-[#6366f1]" />
          <div className="text-center">
            <div className="text-[17px] font-extrabold text-[#1e1b4b]">Reading your documents</div>
            <div className="mt-1 text-[13px] font-medium text-[#9b9aaa]">
              {stage === "ocr" ? "Reading the text…" : "Extracting diagnosis, drugs & results…"}
            </div>
          </div>
        </div>
      )}

      {step === "extracting" && error && (
        <div className="flex flex-col items-center gap-5 px-6 pt-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#fdf3f4] text-[26px]">⚠️</span>
          <div>
            <div className="text-[17px] font-extrabold text-[#1e1b4b]">Reading failed</div>
            <p className="mt-1.5 break-words text-[13px] font-medium leading-[1.5] text-[#e0455a]">{error}</p>
          </div>
          <div className="flex w-full flex-col gap-2.5">
            <button
              onClick={() => extractFrom(photos)}
              className="rounded-[16px] bg-[#6366f1] py-3.5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.4)]"
            >
              Try again
            </button>
            <button
              onClick={() => {
                setError(undefined);
                setStep("review");
              }}
              className="py-2 text-[13.5px] font-semibold text-[#8d8c9c]"
            >
              Fill in by hand
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <VisitForm
          profiles={profiles}
          initial={value}
          initialPhotos={photos}
          initialRawText={rawText}
          submitLabel="Save record"
          tinted
          onSubmit={save}
        />
      )}

      {viewer !== null && photos[viewer] && (
        <PhotoViewer photos={photos} index={viewer} onClose={() => setViewer(null)} />
      )}
    </main>
  );
}
