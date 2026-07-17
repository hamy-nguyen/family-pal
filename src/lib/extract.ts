// The read pipeline in one place: photos -> OCR (per image) -> structure (LLM).
// WHY: both the first-capture read AND the "add a forgotten page" re-read need
// the exact same steps; centralizing avoids the two paths drifting apart.
import { compressImage } from "./compress";
import type { StructuredResult } from "./types";

const readFile = (f: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });

// File[] from an <input> -> compressed data URLs ready to store/send.
export async function filesToImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(async (f) => compressImage(await readFile(f))));
}

// OCR each image then structure the combined text + images together.
// onStage lets the caller show "Reading text…" vs "Extracting…".
export async function extractImages(
  images: string[],
  onStage?: (s: "ocr" | "structure") => void,
): Promise<{ text: string; result: StructuredResult }> {
  const list = images.filter(Boolean);
  onStage?.("ocr");
  let combined = "";
  for (const image of list) {
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `OCR failed (${res.status})`);
    combined += (data.text ?? "") + "\n";
  }
  onStage?.("structure");
  const sres = await fetch("/api/structure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: combined, images: list }),
  });
  const sdata = await sres.json();
  if (!sres.ok || sdata.error) throw new Error(sdata.error || `Structuring failed (${sres.status})`);
  return { text: combined, result: sdata as StructuredResult };
}
