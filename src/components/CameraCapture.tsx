"use client";

// Telegram-style in-app camera: a live viewfinder that stays open across many
// shots. Each shot is grabbed from the video stream to a <canvas>, so we never
// leave the app between photos (the native <input capture> can't do that — it
// returns after a single shot). Trade-off: stills come from the video frame, so
// we request the highest resolution the device will give for OCR sharpness.
//
// WHY a graceful fallback: getUserMedia needs a secure context and camera
// permission; on refusal or an unsupported browser we hand off to the native
// camera input so the user is never dead-ended.

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress";

const readFile = (f: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });

export function CameraCapture({
  onDone,
  onClose,
}: {
  onDone: (urls: string[]) => void; // compressed data URLs, in shot order
  onClose: () => void; // dismissed with nothing kept
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shots, setShots] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false); // camera unavailable → native fallback
  const trayRef = useRef<HTMLDivElement>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)acquire the stream whenever the facing direction changes.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFailed(true);
        return;
      }
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Ask for 4K; the browser clamps to the best the sensor supports.
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing, stop]);

  // Always release the camera when the overlay unmounts.
  useEffect(() => stop, [stop]);

  async function shoot() {
    const v = videoRef.current;
    if (!v || !ready || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0);
      // Standardize with the rest of the pipeline (cap dimension, JPEG).
      const url = await compressImage(canvas.toDataURL("image/jpeg", 0.92));
      setShots((s) => [...s, url]);
      // Scroll the tray to reveal the newest shot.
      requestAnimationFrame(() => {
        trayRef.current?.scrollTo({ left: trayRef.current.scrollWidth, behavior: "smooth" });
      });
    } finally {
      setBusy(false);
    }
  }

  // Native fallback: still let them shoot (one at a time) via the OS camera.
  async function fallbackPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const urls = await Promise.all(files.map(async (f) => compressImage(await readFile(f))));
    onDone(urls);
  }

  if (failed) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black px-8 text-center">
        <span className="text-[40px]">📷</span>
        <p className="text-[15px] font-semibold leading-[1.5] text-white/90">
          We couldn&apos;t open the in-app camera. You can still take a photo with your phone&apos;s camera.
        </p>
        <label className="w-full rounded-[16px] bg-[#6366f1] py-4 text-center text-[15px] font-bold text-white">
          Take a photo
          <input type="file" accept="image/*" capture="environment" onChange={fallbackPick} className="hidden" />
        </label>
        <button onClick={onClose} className="py-2 text-[14px] font-semibold text-white/60">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <button onClick={onClose} aria-label="Close camera" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-[20px] text-white">
          ✕
        </button>
        <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">Take photos</span>
        <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="Flip camera" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white">
          <FlipIcon />
        </button>
      </div>

      {/* viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
          </div>
        )}

        {/* thumbnail tray — floats over the viewfinder, each shot deletable */}
        {shots.length > 0 && (
          <div ref={trayRef} className="no-scrollbar absolute inset-x-0 bottom-3 flex gap-2 overflow-x-auto px-4">
            {shots.map((src, i) => (
              <div key={i} className="relative flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-[74px] w-[58px] rounded-[10px] border-2 border-white/80 object-cover" />
                <button
                  onClick={() => setShots((s) => s.filter((_, j) => j !== i))}
                  aria-label={`Delete photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-between px-8 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
        <div className="w-16 text-left">
          {shots.length > 0 && (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 text-[15px] font-bold text-white">
              {shots.length}
            </span>
          )}
        </div>
        <button
          onClick={shoot}
          disabled={!ready || busy}
          aria-label="Take photo"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-white disabled:opacity-40"
        >
          <span className="h-[56px] w-[56px] rounded-full bg-white transition-transform active:scale-90" />
        </button>
        <div className="w-16 text-right">
          {shots.length > 0 ? (
            <button
              onClick={() => {
                stop();
                onDone(shots);
              }}
              className="text-[16px] font-bold text-white"
            >
              Done
            </button>
          ) : (
            <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="Flip camera" className="text-white/70">
              <FlipIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2v5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M18 22l3-3-3-3" />
      <path d="M15 19h6" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
