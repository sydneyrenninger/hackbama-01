import { notFound } from "next/navigation";
import { ListingActions } from "@/components/listing-actions";
import { formatPrice } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getListing } from "@/server/queries/marketplace";

const MEDIA = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/`;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [raw, ctx] = await Promise.all([getListing(id), getAppContext()]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const l = raw as any;
  if (!l) notFound();
  const mine = ctx?.user?.id === l.seller_id;
  const img = [...(l.images ?? [])].sort((a: { position: number }, b: { position: number }) => a.position - b.position)[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={MEDIA + img.storage_path} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No photo</div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-bold">{formatPrice(l.price_cents, l.kind)}</p>
          <h1 className="text-xl">{l.title}</h1>
          <p className="text-sm text-muted-foreground">{l.category} · {l.condition ?? "condition n/a"} · {l.tenant?.short_name}</p>
        </div>
        {l.description && <p className="whitespace-pre-line">{l.description}</p>}
        {l.pickup_notes && <p className="text-sm"><span className="font-semibold">Pickup:</span> {l.pickup_notes}</p>}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-semibold">{l.seller?.display_name}</p>
          <p className="text-sm text-muted-foreground">{l.seller?.completed_trades ?? 0} completed trades</p>
        </div>
        {mine ? <p className="text-sm text-muted-foreground">This is your listing.</p> : <ListingActions listingId={l.id} />}
      </div>
    </div>
  );
}