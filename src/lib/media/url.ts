import { SUPABASE_URL } from "@/lib/supabase/public-env";

export type MediaType = "image" | "video";

export const MEDIA_BUCKET: Record<MediaType, string> = {
  image: "listing-images",
  video: "listing-videos",
};

/** Public CDN URL for a listing photo or video (buckets are public-read with unguessable paths). */
export function mediaUrl(storagePath: string, mediaType: MediaType = "image"): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET[mediaType]}/${storagePath}`;
}

export function avatarUrl(avatarPath: string | null): string | null {
  return avatarPath ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}` : null;
}
