import Link from "next/link";
import { formatPrice } from "@/lib/utils";

const MEDIA = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;

type Tile = {
  id: string; title: string; kind: string; price_cents: number | null;
  tenant?: { short_name: string } | null;
  seller?: { display_name: string } | null;
  images?: { storage_path: string; position: number }[] | null;
};

export function ListingTile({ l }: { l: Tile }) {
  const img = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
  return (
    <Link href={`/listing/${l.id}`} className="block overflow-hidden rounded-lg border border-border bg-card hover:shadow-md">
      <div className="aspect-square bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={MEDIA + img.storage_path} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo</div>
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