import Link from "next/link";
import { Play } from "lucide-react";
import { mediaUrl, type MediaType } from "@/lib/media/url";
import { formatPrice } from "@/lib/utils";

type Tile = {
  id: string; title: string; kind: string; price_cents: number | null; is_reel?: boolean;
  tenant?: { short_name: string } | null;
  seller?: { display_name: string } | null;
  images?: { storage_path: string; position: number; media_type?: MediaType }[] | null;
};

const TILT = ["-5deg", "4deg", "-2deg", "6deg", "-3deg"];

/** Feed tile. `href` carries the search context so the viewer can scroll through the same results. */
export function ListingTile({ l, href, index = 0 }: { l: Tile; href?: string; index?: number }) {
  const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
  const isVideo = cover?.media_type === "video";
  const price = formatPrice(l.price_cents, l.kind);
  return (
    <Link href={href ?? `/listing/${l.id}`} className="group rise block" style={{ "--i": index } as React.CSSProperties}>
      <div className="lift relative rounded-[1.1rem] border-2 border-ink bg-card p-1.5 shadow-brut-sm">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[0.8rem] border-2 border-ink bg-paper-deep">
          {isVideo ? (
            <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- public storage URL
            <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--campus-soft),var(--paper-deep))]">
              <span className="font-serif text-7xl italic text-primary/60">{l.title.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {(l.is_reel || isVideo) && (
            <span className="eyebrow absolute bottom-2 left-2 flex items-center gap-1 rounded-full border-2 border-ink bg-ink/85 px-2 py-0.5 text-[9px] text-paper backdrop-blur">
              <Play className="h-2.5 w-2.5 fill-current" aria-hidden />Reel
            </span>
          )}
        </div>
        {price && (
          <span className="sticker absolute -right-2 -top-2.5 z-10 text-sm transition-transform duration-300 group-hover:scale-110"
            style={{ rotate: TILT[index % TILT.length] }}>{price}</span>
        )}
        <div className="px-1.5 pb-1 pt-2.5">
          <p className="truncate font-display text-[15px] font-bold leading-tight tracking-[-0.02em]">{l.title}</p>
          <p className="eyebrow mt-1 truncate text-[9.5px] text-muted-foreground">
            {l.seller?.display_name}{l.tenant?.short_name ? ` · ${l.tenant.short_name}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
