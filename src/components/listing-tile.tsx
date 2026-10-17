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

/** Feed tile. `href` carries the search context so the viewer can scroll through the same results. */
export function ListingTile({ l, href }: { l: Tile; href?: string }) {
  const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
  const isVideo = cover?.media_type === "video";
  return (
    <Link href={href ?? `/listing/${l.id}`} className="block overflow-hidden rounded-lg border border-border bg-card hover:shadow-md">
      <div className="relative aspect-square bg-muted">
        {isVideo ? (
          <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL
          <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo</div>
        )}
        {(l.is_reel || isVideo) && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            <Play className="h-3 w-3" aria-hidden />Reel
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="font-bold">{formatPrice(l.price_cents, l.kind)}</p>
        <p className="truncate text-sm">{l.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {l.seller?.display_name}{l.tenant?.short_name ? ` · ${l.tenant.short_name}` : ""}
        </p>
      </div>
    </Link>
  );
}
