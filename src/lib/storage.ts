import "server-only";
import { admin } from "./supabase/admin";

const BUCKET = "proofs";
const MAX_BYTES = 8 * 1024 * 1024;

export function validatePhoto(file: unknown): file is File {
  return file instanceof File && file.size > 0 && file.size <= MAX_BYTES && file.type.startsWith("image/");
}

export async function uploadPhoto(requestId: string, kind: "receipt" | "items" | "dropoff", file: File) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${requestId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await admin().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  return path;
}

/** Short-lived URL. Only call after checking the viewer may see this order. */
export async function signedPhotoUrl(path: string | null) {
  if (!path) return null;
  const { data } = await admin().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
