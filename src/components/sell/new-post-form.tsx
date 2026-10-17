"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Film, Heart, ImagePlus, MessageCircle, Send, X } from "lucide-react";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dollarsToCents, splitTags } from "@/lib/format";
import { uploadListingMedia } from "@/lib/media/upload";
import { cn, formatPrice } from "@/lib/utils";
import { createListing, updateListingStatus } from "@/server/actions/listings";

type Category = "textbooks" | "dorm" | "lab" | "tickets" | "tutoring" | "rides" | "electronics" | "furniture" | "clothing" | "other";
type Kind = "sale" | "free" | "trade" | "borrow" | "service";
type Condition = "new" | "like_new" | "good" | "fair" | "worn";

const CATEGORIES: Category[] = ["textbooks", "dorm", "lab", "tickets", "tutoring", "rides", "electronics", "furniture", "clothing", "other"];
const KINDS: { value: Kind; label: string }[] = [
  { value: "sale", label: "For sale" }, { value: "free", label: "Free" }, { value: "trade", label: "Trade" },
  { value: "borrow", label: "Borrow" }, { value: "service", label: "Service" },
];
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" }, { value: "like_new", label: "Like new" }, { value: "good", label: "Good" },
  { value: "fair", label: "Fair" }, { value: "worn", label: "Worn" },
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const MAX_PHOTOS = 8;
const field = "w-full rounded-md border border-input bg-card px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";

/** Starting caption, built from the details (the seller can rewrite it on the preview step). */
function defaultCaption(v: { title: string; kind: Kind; priceText: string; condition: Condition | ""; wants: Category[]; tradeText: string }) {
  const title = v.title.trim() || "this";
  const price = formatPrice(dollarsToCents(v.priceText), v.kind === "service" ? "service" : "sale");
  const condition = v.condition ? ` Condition: ${CONDITIONS.find((c) => c.value === v.condition)?.label.toLowerCase()}.` : "";
  switch (v.kind) {
    case "free": return `Giving away ${title} for free.${condition} Message me if you want it!`;
    case "trade": {
      const want = [v.wants.map((w) => w).join(", "), v.tradeText.trim()].filter(Boolean).join(", ");
      return `Trading ${title}${want ? ` for ${want}` : ""}.${condition}`;
    }
    case "borrow": return `${cap(title)} is available to borrow.${condition} Message me with the dates you need it.`;
    case "service": return `Offering ${title}${price && price !== "Ask" ? ` for ${price}` : ""}. Message me to set up a time.`;
    default: return `Selling ${title}${price ? ` for ${price}` : ""}.${condition}`;
  }
}

/** Two steps: details, then an Instagram-style preview with an editable caption. Posts to your home campus. */
export function NewPostForm({ campusSlug, homeCampusName, authorName, authorAvatarPath }: {
  campusSlug: string; homeCampusName: string; authorName: string; authorAvatarPath: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "preview">("details");
  const [mode, setMode] = useState<"post" | "reel">("post");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("sale");
  const [priceText, setPriceText] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [condition, setCondition] = useState<Condition | "">("");
  const [wants, setWants] = useState<Category[]>([]);
  const [tradeText, setTradeText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [pickup, setPickup] = useState("");
  const [caption, setCaption] = useState("");
  const [captionEdited, setCaptionEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const tags = useMemo(() => [...new Set(splitTags(tagsText))], [tagsText]);
  const hasPrice = kind === "sale" || kind === "service";
  const price = hasPrice ? formatPrice(dollarsToCents(priceText), kind) : formatPrice(null, kind);

  function switchMode(next: "post" | "reel") {
    if (next === mode) return;
    setMode(next); setFiles([]); setError(null); setSlide(0);
  }
  function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Copy now: the caller clears the input afterwards, which empties this live FileList.
    const picked = Array.from(list);
    setError(null);
    if (mode === "reel") return setFiles([picked[0]]);
    const merged = [...files, ...picked];
    if (merged.length > MAX_PHOTOS) setError(`You can add up to ${MAX_PHOTOS} photos.`);
    setFiles(merged.slice(0, MAX_PHOTOS));
  }

  /** Checks step 1 and moves to the preview. */
  function toPreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) return setError(mode === "reel" ? "Add a video for your reel." : "Add at least one photo.");
    if (title.trim().length < 3) return setError("Give your post a title (at least 3 characters).");
    if (kind === "sale" && !(dollarsToCents(priceText)! > 0)) return setError("Add a price, or choose Free.");
    if (kind === "trade" && wants.length === 0) return setError("Pick at least one category you'd trade for.");
    if (tags.length === 0) return setError("Add at least one tag, like #dress or #ece.");
    if (!captionEdited) setCaption(defaultCaption({ title, kind, priceText, condition, wants, tradeText }));
    setSlide(0);
    setStep("preview");
    window.scrollTo({ top: 0 });
  }

  async function publish() {
    if (busy) return;
    setError(null); setBusy(true); setProgress("Creating your listing…");
    const created = await createListing({
      title, description: caption.trim(), category, kind,
      priceCents: hasPrice ? dollarsToCents(priceText) : null,
      condition: condition || null,
      pickupNotes: pickup.trim() || null,
      tradeWantsCategories: kind === "trade" ? wants : [],
      tradeWantsText: kind === "trade" ? tradeText.trim() || null : null,
      tags, isReel: mode === "reel",
    });
    if (!created.ok) { setBusy(false); setProgress(""); return setError(created.error); }
    const id = created.data!.id;

    for (let i = 0; i < files.length; i++) {
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : mode === "reel" ? "Uploading video…" : "Uploading…");
      const up = await uploadListingMedia(files[i], id, i);
      if (!up.ok) {
        await updateListingStatus(id, "removed"); // don't leave a half-finished listing behind
        setBusy(false); setProgress("");
        return setError(`${up.error} Nothing was posted. Try again.`);
      }
    }
    router.push(`/c/${campusSlug}/sell?posted=${id}`);
    router.refresh();
  }

  if (step === "preview") {
    return (
      <div className="space-y-6">
        <article aria-label="Post preview" className="mx-auto max-w-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <header className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={authorName} path={authorAvatarPath} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{authorName}</p>
              <p className="truncate text-xs text-muted-foreground">{homeCampusName}</p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold tracking-wide text-secondary-foreground">{mode === "reel" ? "REEL" : "POST"}</span>
          </header>
          <div className={cn("relative bg-black", mode === "reel" ? "aspect-[9/14]" : "aspect-square")}>
            {mode === "reel"
              ? <video src={previews[0]} muted loop autoPlay playsInline controls className="h-full w-full object-contain" />
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              : <img src={previews[slide]} alt={`Photo ${slide + 1} of ${previews.length}`} className="h-full w-full object-cover" />}
            {mode === "post" && previews.length > 1 && (
              <>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {previews.map((p, i) => (
                    <button key={p} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === slide} onClick={() => setSlide(i)}
                      className={cn("h-2 w-2 rounded-full", i === slide ? "bg-white" : "bg-white/50")} />
                  ))}
                </div>
                <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{slide + 1}/{previews.length}</span>
              </>
            )}
          </div>
          <div className="space-y-2 px-3 py-3">
            <div className="flex items-center gap-4" aria-hidden>
              <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" />
              <span className="flex-1" /><Bookmark className="h-6 w-6" />
            </div>
            <p className="font-semibold">{title}{price && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-sm text-primary-foreground">{price}</span>}</p>
            <p className="whitespace-pre-wrap break-words text-sm"><span className="font-semibold">{authorName}</span> {caption || <span className="text-muted-foreground">Your caption…</span>}</p>
            {tags.length > 0 && <p className="text-sm font-semibold text-primary">{tags.map((t) => `#${t}`).join(" ")}</p>}
            {pickup.trim() && <p className="text-xs text-muted-foreground">Pickup: {pickup.trim()}</p>}
          </div>
        </article>

        <div className="mx-auto max-w-[420px] space-y-1.5">
          <Label htmlFor="np-caption">Caption</Label>
          <textarea id="np-caption" value={caption} rows={4} maxLength={2000}
            onChange={(e) => { setCaption(e.target.value); setCaptionEdited(true); }}
            className={cn(field, "py-2")} />
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>Add details like size, pickup times or why you&apos;re selling.</span><span>{caption.length}/2000</span>
          </p>
        </div>

        {error && <p role="alert" className="mx-auto max-w-[420px] rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="mx-auto flex max-w-[420px] flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setStep("details"); setError(null); }}>
            <ArrowLeft className="h-4 w-4" aria-hidden />Edit details
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={busy} onClick={publish}>
            {busy ? progress || "Posting…" : mode === "reel" ? "Share reel" : "Share post"}
          </Button>
        </div>
        <p className="mx-auto max-w-[420px] text-sm text-muted-foreground">Posting to {homeCampusName}</p>
      </div>
    );
  }

  return (
    <form onSubmit={toPreview} className="space-y-6" noValidate>
      <div role="group" aria-label="Post type" className="grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1">
        {([["post", "Photo post", ImagePlus], ["reel", "Reel (video)", Film]] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => switchMode(value)}
            className={cn("flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors",
              mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      <section aria-labelledby="media-h" className="space-y-3">
        <h2 id="media-h" className="text-sm font-semibold">{mode === "reel" ? "Video" : `Photos (up to ${MAX_PHOTOS})`}</h2>
        {previews.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map((src, i) => (
              <li key={src} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                {mode === "reel" ? <video src={src} muted playsInline controls className="h-full w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  : <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />}
                {mode === "post" && i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Cover</span>}
                <button type="button" aria-label={`Remove ${mode === "reel" ? "video" : `photo ${i + 1}`}`}
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {(mode === "post" ? files.length < MAX_PHOTOS : files.length === 0) && (
          <>
            <Label htmlFor="media-file" className="grid cursor-pointer place-items-center gap-1 rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground hover:bg-muted">
              {mode === "reel" ? <Film className="h-7 w-7" aria-hidden /> : <ImagePlus className="h-7 w-7" aria-hidden />}
              <span className="font-semibold">{mode === "reel" ? "Choose a video" : files.length ? "Add more photos" : "Choose photos"}</span>
              <span className="text-xs font-normal">{mode === "reel" ? "MP4, WebM or MOV, up to 50 MB (about 30 seconds)" : "JPG, PNG or WebP, up to 5 MB each"}</span>
            </Label>
            <input id="media-file" type="file" className="sr-only" multiple={mode === "post"}
              accept={mode === "reel" ? "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" : "image/jpeg,image/png,image/webp"}
              onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </>
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="np-title">What are you posting?</Label>
        <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90}
          placeholder={mode === "reel" ? "Gameday tickets, Auburn vs. Bama" : "Mini fridge, 3.2 cu ft"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="np-kind">Type</Label>
          <select id="np-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={cn(field, "h-11")}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        {hasPrice && (
          <div className="space-y-1.5">
            <Label htmlFor="np-price">Price ($){kind === "service" && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
            <Input id="np-price" value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" placeholder={kind === "service" ? "20 per hour" : "45"} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="np-category">Category</Label>
          <select id="np-category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className={cn(field, "h-11")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-condition">Condition <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <select id="np-condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition | "")} className={cn(field, "h-11")}>
            <option value="">Not applicable</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {kind === "trade" && (
        <fieldset className="space-y-3 rounded-lg border border-border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">What would you trade for?</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = wants.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} disabled={!on && wants.length >= 5}
                  onClick={() => setWants((cur) => (on ? cur.filter((x) => x !== c) : [...cur, c]))}
                  className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                  {cap(c)}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-trade-text">Anything specific? <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="np-trade-text" value={tradeText} onChange={(e) => setTradeText(e.target.value)} maxLength={280} placeholder="A graphing calculator or lab goggles" />
          </div>
        </fieldset>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="np-tags">Tags</Label>
        <Input id="np-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="#dorm #appliance #ferguson" aria-describedby="np-tags-help" />
        <p id="np-tags-help" className="text-xs text-muted-foreground">At least one. Buyers find your post by tag (major, club, category…).</p>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Your tags">
            {tags.map((t) => <li key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">#{t}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-pickup">Pickup spot <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="np-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={280} placeholder="Ferguson Center, weekday evenings" />
      </div>

      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto">Next: preview</Button>
    </form>
  );
}
