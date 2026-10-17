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
const MAX_BYTES: Record<MediaType, number> = { image: 5 * 1024 * 1024, video: 50 * 1024 * 1024 };

export type UploadResult = { ok: true; storagePath: string; mediaType: MediaType } | { ok: false; error: string };

/**
 * Uploads a photo or video for a listing you own, then registers it.
 * Call after createListing(); position 0 is the cover (for a reel, upload the video at 0).
 */
export async function uploadListingMedia(file: File, listingId: string, position: number): Promise<UploadResult> {
  const type = TYPES[file.type];
  if (!type) return { ok: false, error: "Use a JPG, PNG or WebP photo, or an MP4, WebM or MOV video." };
  if (file.size > MAX_BYTES[type.mediaType]) {
    return { ok: false, error: type.mediaType === "video" ? "Videos must be under 50 MB." : "Photos must be under 5 MB." };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to continue." };

  const storagePath = `${user.id}/${crypto.randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET[type.mediaType])
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "Upload failed. Try again." };

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
