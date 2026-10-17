"use client";
import { createClient } from "@/lib/supabase/client";
import { attachListingMedia } from "@/server/actions/listings";
import { MEDIA_BUCKET, type MediaType } from "./url";

// Mirrors the bucket limits in supabase/migrations (0005, 0007).
const TYPES: Record<string, { mediaType: MediaType; ext: string }> = {
  "image/jpeg": { mediaType: "image", ext: "jpg" },
  "image/png": { mediaType: "image", ext: "png" },
  "image/webp": { mediaType: "image", ext: "webp" },
  "video/mp4": { mediaType: "video", ext: "mp4" },
  "video/webm": { mediaType: "video", ext: "webm" },
  "video/quicktime": { mediaType: "video", ext: "mov" },
};
// Some browsers (notably on Windows) report no type for .mov/.mp4 files, so fall back to the extension.
const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime", qt: "video/quicktime",
};
const MAX_BYTES: Record<MediaType, number> = { image: 5 * 1024 * 1024, video: 50 * 1024 * 1024 };

export type UploadResult = { ok: true; storagePath: string; mediaType: MediaType } | { ok: false; error: string };

/** The file's real content type: what the browser reported, or what its extension implies. */
export function detectMediaType(file: File): string | null {
  if (TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

/** Turns a Storage error into something a student can act on. */
function uploadErrorMessage(message: string, mediaType: MediaType): string {
  const m = message.toLowerCase();
  if (m.includes("size") || m.includes("too large") || m.includes("413")) {
    return mediaType === "video" ? "That video is too big. Keep it under 50 MB (about 30 seconds)." : "That photo is too big. Keep it under 5 MB.";
  }
  if (m.includes("mime") || m.includes("type")) return "That file type isn't supported. Use an MP4, WebM or MOV video, or a JPG, PNG or WebP photo.";
  if (m.includes("jwt") || m.includes("auth") || m.includes("row-level") || m.includes("unauthorized")) return "Your session expired. Sign in again and retry.";
  return mediaType === "video" ? "The video didn't finish uploading. Check your connection and try again." : "Upload failed. Try again.";
}

/**
 * Uploads a photo or video for a listing you own, then registers it.
 * Call after createListing(); position 0 is the cover (for a reel, upload the video at 0).
 */
export async function uploadListingMedia(file: File, listingId: string, position: number): Promise<UploadResult> {
  const contentType = detectMediaType(file);
  const type = contentType ? TYPES[contentType] : undefined;
  if (!contentType || !type) return { ok: false, error: "Use a JPG, PNG or WebP photo, or an MP4, WebM or MOV video." };
  if (file.size > MAX_BYTES[type.mediaType]) {
    return { ok: false, error: type.mediaType === "video" ? "That video is too big. Keep it under 50 MB (about 30 seconds)." : "Photos must be under 5 MB." };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to continue." };

  const storagePath = `${user.id}/${crypto.randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET[type.mediaType])
    .upload(storagePath, file, { contentType, upsert: false, cacheControl: "3600" });
  if (uploadError) {
    console.error("[upload] storage error:", uploadError.message);
    return { ok: false, error: uploadErrorMessage(uploadError.message, type.mediaType) };
  }

  const attached = await attachListingMedia(listingId, storagePath, position, type.mediaType);
  if (!attached.ok) {
    await supabase.storage.from(MEDIA_BUCKET[type.mediaType]).remove([storagePath]);
    return { ok: false, error: attached.error };
  }
  return { ok: true, storagePath, mediaType: type.mediaType };
}

const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Uploads a profile photo to the avatars bucket (2 MB, own folder) and returns its storage path.
 * Save it with updateProfile({ displayName, avatarPath }).
 */
export async function uploadAvatar(file: File): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { ok: false, error: "Use a JPG, PNG or WebP photo." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Profile photos must be under 2 MB." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to continue." };

  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Upload failed. Try again." };
  return { ok: true, storagePath };
}
