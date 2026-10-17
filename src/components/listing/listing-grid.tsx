import Link from "next/link";
import { Play } from "lucide-react";
import { Empty } from "@/components/shell/empty";
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

const TILT = ["-4deg", "3deg", "-2deg", "5deg"];

/**
 * Compact listing tiles for profile / saved lists. Links to /listing/[id] (the reel viewer).
 * The Buy feed can use its own tile; this one is deliberately small.
 */
export function ListingGrid({ listings, emptyText = "Nothing here yet.", linkQuery }: {
  listings: GridListing[]; emptyText?: string;
  /** Viewer context, e.g. "saved=1" or "seller=<id>", so tapping a tile scrolls through this same list. */
  linkQuery?: string;
}) {
  if (listings.length === 0) {
    return <Empty>{emptyText}</Empty>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l, i) => {
        const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
        const price = formatPrice(l.price_cents, l.kind);
        return (
          <li key={l.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <Link href={`/listing/${l.id}${linkQuery ? `?${linkQuery}` : ""}`}
              className="lift group relative block rounded-[1.1rem] border-2 border-ink bg-card p-1.5 shadow-brut-sm">
              <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[0.8rem] border-2 border-ink bg-paper-deep", l.status === "sold" && "grayscale")}>
                {cover?.media_type === "video" ? (
                  <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public storage URL
                  <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--campus-soft),var(--paper-deep))] font-serif text-6xl italic text-primary/60" aria-hidden>
                    {l.title.charAt(0).toUpperCase()}
                  </div>
                )}
                {(l.is_reel || cover?.media_type === "video") && (
                  <span className="eyebrow absolute bottom-2 left-2 flex items-center gap-1 rounded-full border-2 border-ink bg-ink/85 px-2 py-0.5 text-[9px] text-paper">
                    <Play className="h-2.5 w-2.5 fill-current" aria-hidden />Reel
                  </span>
                )}
                {l.status === "sold" && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="-rotate-12 rounded-lg border-[3px] border-destructive bg-card/90 px-3 py-1 font-display text-xl font-extrabold uppercase tracking-widest text-destructive">Sold</span>
                  </span>
                )}
              </div>
              {price && <span className="sticker absolute -right-2 -top-2.5 z-10 text-sm" style={{ rotate: TILT[i % TILT.length] }}>{price}</span>}
              <div className="px-1.5 pb-1 pt-2.5">
                <p className="truncate font-display text-[15px] font-bold leading-tight tracking-[-0.02em]">{l.title}</p>
                {l.tags && l.tags.length > 0 && <p className="eyebrow mt-1 truncate text-[9.5px] text-muted-foreground">{l.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
