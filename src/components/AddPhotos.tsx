"use client";

// Adds photos from two explicit sources, exposed as separate actions so callers
// render their own buttons — no custom action sheet stacked in front of them.
//
// WHY no wrapper sheet: on iOS Safari a <input type="file" accept="image/*">
// ALWAYS pops Apple's own picker (Photo Library / Take Photo / Files) and there
// is no HTML/JS way to skip it. Putting our sheet in front only added a tap. So
// "Choose from library" IS the native input (fewest taps iOS allows), and the
// in-app multi-shot camera is a distinct button.
//
// Both paths return compressed data URLs via onPhotos.

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compress";
import { CameraCapture } from "@/components/CameraCapture";

const readFile = (f: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });

export type PhotoActions = {
  openLibrary: () => void; // opens the native multi-select photo picker directly
  openCamera: () => void; // opens the in-app multi-shot camera
};

export function AddPhotos({
  onPhotos,
  children,
}: {
  onPhotos: (urls: string[]) => void; // compressed data URLs
  children: (actions: PhotoActions) => React.ReactNode;
}) {
  const [camera, setCamera] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function pickLibrary(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(async (f) => compressImage(await readFile(f))));
    onPhotos(urls);
  }

  return (
    <>
      {children({
        openLibrary: () => libraryRef.current?.click(),
        openCamera: () => setCamera(true),
      })}

      {/* native picker — opens the OS photo library directly (multi-select) */}
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={pickLibrary} className="hidden" />

      {/* in-app multi-shot camera */}
      {camera && (
        <CameraCapture
          onClose={() => setCamera(false)}
          onDone={(urls) => {
            setCamera(false);
            if (urls.length) onPhotos(urls);
          }}
        />
      )}
    </>
  );
}

// The standard two-button row used by the capture step and the review/edit form.
// WHY shared: keeps "Take photos" vs "Library" identical everywhere photos are added.
export function PhotoSourceRow({ openCamera, openLibrary }: PhotoActions) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        onClick={openCamera}
        className="flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-[#dcdef9] bg-[#f4f5ff] py-3 text-[13px] font-bold text-[#6366f1]"
      >
        <CameraGlyph /> Take photos
      </button>
      <button
        onClick={openLibrary}
        className="flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-[#cdd0dd] bg-[#fbfbfe] py-3 text-[13px] font-bold text-[#6366f1]"
      >
        <LibraryGlyph /> Library
      </button>
    </div>
  );
}

function CameraGlyph() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function LibraryGlyph() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
