// Image storage on Supabase Storage (private bucket "visit-images"), scoped per
// household by the object path `${household_id}/${uuid}.jpg`. RLS on the bucket
// (see supabase/schema.sql) means only that household's caregivers can read/write.
//
// At activation, capture/edit call uploadImages() before saving, so the DB stores
// the object PATH (not megabytes of base64). Reads sign those paths into temporary
// URLs (SupabaseRepo.signVisits). If Supabase isn't configured we return the input
// unchanged, so the mock/localStorage path keeps inline data URLs untouched.
import { supabaseClient, supabaseConfigured } from "./supabase";

export const IMAGE_BUCKET = "visit-images";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const m = dataUrl.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (!m) return null;
  const contentType = m[1];
  const ext = contentType.split("/")[1] === "png" ? "png" : "jpg";
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { blob: new Blob([arr], { type: contentType }), ext };
}

async function householdId(sb: ReturnType<typeof supabaseClient>): Promise<string | null> {
  const { data: s } = await sb.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return null;
  const { data } = await sb.from("household_members").select("household_id").eq("user_id", uid).limit(1).maybeSingle();
  return data?.household_id ?? null;
}

// Pull the object path back out of a signed URL (…/visit-images/<path>?token=…),
// so re-saving an edited record persists the PATH, not the temporary signed URL.
function extractStoragePath(url: string): string | null {
  const marker = `/${IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length).split("?")[0];
}

// data URL -> upload, return the stored object PATH. A signed URL (edit round-trip)
// -> its recovered path. Anything else (or unconfigured Supabase) passes through.
// Any failure falls back to the input so an image is never lost.
export async function uploadImage(input: string): Promise<string> {
  if (!input) return input;
  if (input.startsWith("data:")) {
    if (!supabaseConfigured) return input;
    const parsed = dataUrlToBlob(input);
    if (!parsed) return input;
    try {
      const sb = supabaseClient();
      const hid = await householdId(sb);
      if (!hid) return input;
      const key = `${hid}/${crypto.randomUUID()}.${parsed.ext}`;
      const { error } = await sb.storage.from(IMAGE_BUCKET).upload(key, parsed.blob, { contentType: parsed.blob.type });
      if (error) return input;
      return key; // stored in image_url; signed on read
    } catch {
      return input;
    }
  }
  return extractStoragePath(input) ?? input;
}

export async function uploadImages(dataUrls: string[]): Promise<string[]> {
  return Promise.all((dataUrls ?? []).map(uploadImage));
}
