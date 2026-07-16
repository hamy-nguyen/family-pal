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
    const { text } = await fetch("/api/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    }).then((r) => r.json());
    combined += (text ?? "") + "\n";
  }
  onStage?.("structure");
  const result: StructuredResult = await fetch("/api/structure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: combined, images: list }),
  }).then((r) => r.json());
  return { text: combined, result };
}
