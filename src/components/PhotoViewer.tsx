"use client";

// Full-screen photo viewer used everywhere a photo can be shown (capture step,
// review, saved record, edit). WHY a shared component: the four call sites had
// no way to see a photo full-size; centralizing keeps swipe/keyboard/counter
// behavior identical across all of them.

import { useEffect, useRef, useState } from "react";

export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number; // which photo to open on
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const touchX = useRef<number | null>(null);
  const n = photos.length;

  const prev = () => setI((x) => (x - 1 + n) % n);
  const next = () => setI((x) => (x + 1) % n);

  // Arrow keys + Esc for desktop; body scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  if (n === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx > 50) prev();
        else if (dx < -50) next();
      }}
    >
      <div className="flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))] pb-2">
        <span className="text-[14px] font-semibold text-white/70">
          {n > 1 ? `${i + 1} / ${n}` : ""}
        </span>
        <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-[20px] text-white">
          ✕
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[i]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-[8px] object-contain"
        />

        {n > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-[22px] text-white"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-[22px] text-white"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}
