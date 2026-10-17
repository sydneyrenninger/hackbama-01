import Link from "next/link";
import { Play } from "lucide-react";
import { mediaUrl, type MediaType } from "@/lib/media/url";
import { cn, formatPrice } from "@/lib/utils";

export type GridListing = {
  id: string;
  title: string;
  price_cents: number | null;
  kind: string;
  status?: string;
  is_reel?: boolean;
  tags?: string[];
  images?: { storage_path: string; position: number; media_type?: MediaType }[];
};

/**
 * Compact listing tiles for profile / saved lists. Links to /listing/[id] (the product view).
 * The Buy feed can use its own tile; this one is deliberately small.
 */
export function ListingGrid({ listings, emptyText = "Nothing here yet." }: { listings: GridListing[]; emptyText?: string }) {
  if (listings.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => {
        const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
        const price = formatPrice(l.price_cents, l.kind);
        return (
          <li key={l.id}>
            <Link href={`/listing/${l.id}`} className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
              <div className={cn("relative aspect-[4/5] bg-secondary", l.status === "sold" && "grayscale")}>
                {cover?.media_type === "video" ? (
                  <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public storage URL
                  <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center font-display text-4xl font-bold text-secondary-foreground/40" aria-hidden>
                    {l.title.charAt(0).toUpperCase()}
                  </div>
                )}
                {(l.is_reel || cover?.media_type === "video") && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                    <Play className="h-3 w-3" aria-hidden />Reel
                  </span>
                )}
                {l.status === "sold" && <span className="absolute left-2 bottom-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">Sold</span>}
                {price && <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-0.5 text-sm font-bold text-black">{price}</span>}
              </div>
              <div className="p-3">
                <p className="truncate font-semibold">{l.title}</p>
                {l.tags && l.tags.length > 0 && <p className="truncate text-xs text-muted-foreground">{l.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
