// Transient handoff for photos taken on the home FAB → the /capture screen.
// WHY in-memory (not sessionStorage): phone photos as base64 can be several MB
// and blow Safari's ~5MB quota. Survives one client-side navigation; a hard
// refresh clears it (capture then just starts empty).

let pending: string[] = [];

export function setPendingImages(urls: string[]) {
  pending = urls.filter(Boolean);
}

// Reads and clears in one call so images can't be re-consumed on remount.
export function takePendingImages(): string[] {
  const d = pending;
  pending = [];
  return d;
}
