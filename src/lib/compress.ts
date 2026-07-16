// Client-side image compression. Runs in the browser via <canvas> — no deps.
// WHY: a 3 MB phone photo becomes ~300–600 KB, which (a) keeps us under storage
// limits, (b) shrinks the OCR/structure request bodies (Vercel caps at ~4.5 MB),
// and (c) speeds upload. maxDim ~2000 preserves small printed text for OCR.

export async function compressImage(
  dataUrl: string,
  maxDim = 2000,
  quality = 0.75
): Promise<string> {
  if (typeof document === "undefined") return dataUrl; // SSR safety
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl; // on any failure, fall back to the original
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
