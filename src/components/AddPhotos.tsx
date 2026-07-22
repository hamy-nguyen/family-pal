"use client";

// One entry point for adding photos, used by the home FAB, the capture step and
// the review/edit form. WHY a single component: the two cases the user needs —
// "take on the fly" vs "choose from library" — were previously mashed into one
// <input type="file"> whose OS action sheet made multi-shot capture painful
// (one photo, back to the app, tap again…). Here the two paths are explicit:
//   • Take photos  → in-app Telegram-style camera (stays open across shots)
//   • Library      → native multi-select picker
// Both return compressed data URLs via onPhotos, so callers stay one line.

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compress";
import { CameraCapture } from "@/components/CameraCapture";

const readFile = (f: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });

export function AddPhotos({
  onPhotos,
  children,
}: {
  onPhotos: (urls: string[]) => void; // compressed data URLs
  children: (open: () => void) => React.ReactNode; // render-prop trigger
}) {
  const [sheet, setSheet] = useState(false);
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
      {children(() => setSheet(true))}

      {/* hidden native picker — multi-select from the photo library */}
      <input ref={libraryRef} type="file" accept="image/*" multiple onChange={pickLibrary} className="hidden" />

      {/* source choice sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/40" onClick={() => setSheet(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-md rounded-t-[24px] bg-white px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#e4e3ec]" />
            <button
              onClick={() => { setSheet(false); setCamera(true); }}
              className="flex w-full items-center gap-3.5 rounded-[16px] px-2 py-3.5 text-left active:bg-[#f6f6fb]"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-[#eef0fe] text-[#6366f1]"><CameraGlyph /></span>
              <span>
                <span className="block text-[15px] font-bold text-[#1e1b4b]">Take photos</span>
                <span className="block text-[12.5px] font-medium text-[#9b9aaa]">Snap several in a row without leaving the app</span>
              </span>
            </button>
            <button
              onClick={() => { setSheet(false); libraryRef.current?.click(); }}
              className="flex w-full items-center gap-3.5 rounded-[16px] px-2 py-3.5 text-left active:bg-[#f6f6fb]"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-[#e3f4ea] text-[#2f9e6f]"><LibraryGlyph /></span>
              <span>
                <span className="block text-[15px] font-bold text-[#1e1b4b]">Choose from library</span>
                <span className="block text-[12.5px] font-medium text-[#9b9aaa]">Pick one or more photos you already have</span>
              </span>
            </button>
            <button onClick={() => setSheet(false)} className="mt-2 w-full rounded-[14px] bg-[#f2f2f7] py-3.5 text-[14.5px] font-bold text-[#6b6a7b]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* in-app camera */}
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

function CameraGlyph() {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function LibraryGlyph() {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
