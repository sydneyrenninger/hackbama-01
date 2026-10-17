"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Film, Heart, ImagePlus, MessageCircle, Send, X } from "lucide-react";
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
const field = "field";
const opt = <span className="font-sans text-xs font-normal text-muted-foreground"> (optional)</span>;
const pill = "rounded-full border-2 px-3.5 py-1.5 font-display text-sm font-bold transition-all disabled:opacity-40";

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

  const errorBox = error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>;

  if (step === "preview") {
    return (
      <div className="space-y-7">
        <p className="eyebrow text-center text-muted-foreground">✶ Preview — this is how buyers see it ✶</p>
        <article aria-label="Post preview" className="relative mx-auto max-w-[420px] rotate-[-0.6deg] overflow-visible rounded-[1.4rem] border-2 border-ink bg-card shadow-brut-lg tape">
          <header className="flex items-center gap-3 px-3.5 py-3">
            <Avatar name={authorName} path={authorAvatarPath} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-display text-sm font-bold">{authorName}</p>
              <p className="eyebrow truncate text-[9px] text-muted-foreground">{homeCampusName}</p>
            </div>
            <span className="eyebrow rounded-md bg-ink px-2 py-0.5 text-[9px] text-paper">{mode === "reel" ? "Reel" : "Post"}</span>
          </header>
          <div className={cn("relative overflow-hidden border-y-2 border-ink bg-black", mode === "reel" ? "aspect-[9/14]" : "aspect-square")}>
            {mode === "reel"
              ? <video src={previews[0]} muted loop autoPlay playsInline controls className="h-full w-full object-contain" />
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              : <img src={previews[slide]} alt={`Photo ${slide + 1} of ${previews.length}`} className="h-full w-full object-cover" />}
            {mode === "post" && previews.length > 1 && (
              <>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {previews.map((p, i) => (
                    <button key={p} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === slide} onClick={() => setSlide(i)}
                      className={cn("h-2 rounded-full transition-all", i === slide ? "w-5 bg-pop" : "w-2 bg-white/60")} />
                  ))}
                </div>
                <span className="eyebrow absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">{slide + 1}/{previews.length}</span>
              </>
            )}
            {price && <span className="sticker absolute left-3 top-3 -rotate-6 text-lg">{price}</span>}
          </div>
          <div className="space-y-2 px-3.5 py-3.5">
            <div className="flex items-center gap-4" aria-hidden>
              <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" />
              <span className="flex-1" /><Bookmark className="h-6 w-6" />
            </div>
            <p className="font-display text-lg font-extrabold leading-tight tracking-[-0.02em]">{title}</p>
            <p className="whitespace-pre-wrap break-words text-sm"><span className="font-bold">{authorName}</span> {caption || <span className="text-muted-foreground">Your caption…</span>}</p>
            {tags.length > 0 && <p className="font-mono text-xs font-bold text-primary">{tags.map((t) => `#${t}`).join(" ")}</p>}
            {pickup.trim() && <p className="eyebrow text-[9px] text-muted-foreground">Pickup: {pickup.trim()}</p>}
          </div>
        </article>

        <div className="mx-auto max-w-[420px] space-y-2">
          <Label htmlFor="np-caption">Caption</Label>
          <textarea id="np-caption" value={caption} rows={4} maxLength={2000}
            onChange={(e) => { setCaption(e.target.value); setCaptionEdited(true); }}
            className={cn(field, "py-3")} />
          <p className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>Add details like size, pickup times or why you&apos;re selling.</span><span className="font-mono tabular-nums">{caption.length}/2000</span>
          </p>
        </div>

        {error && <div className="mx-auto max-w-[420px]">{errorBox}</div>}
        <div className="mx-auto flex max-w-[420px] flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => { setStep("details"); setError(null); }}>
            <ArrowLeft className="h-4 w-4" aria-hidden />Edit
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={busy} onClick={publish}>
            {busy ? progress || "Posting…" : <>{mode === "reel" ? "Share reel" : "Share post"} <Send className="h-4 w-4" aria-hidden /></>}
          </Button>
        </div>
        <p className="eyebrow mx-auto max-w-[420px] text-center text-muted-foreground">Posting to {homeCampusName}</p>
      </div>
    );
  }

  return (
    <form onSubmit={toPreview} className="space-y-8" noValidate>
      <div role="group" aria-label="Post type" className="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-ink bg-card p-1.5 shadow-brut-sm">
        {([["post", "Photo post", ImagePlus], ["reel", "Reel (video)", Film]] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => switchMode(value)}
            className={cn("flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-bold transition-all",
              mode === value ? "bg-ink text-paper" : "text-muted-foreground hover:bg-paper-deep hover:text-ink")}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      <section aria-labelledby="media-h" className="space-y-3">
        <h2 id="media-h" className="font-display text-sm font-bold">{mode === "reel" ? "Video" : `Photos (up to ${MAX_PHOTOS})`}</h2>
        {previews.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((src, i) => (
              <li key={src} className="relative aspect-square animate-pop overflow-hidden rounded-xl border-2 border-ink bg-muted shadow-brut-sm" style={{ "--r": "0deg" } as React.CSSProperties}>
                {mode === "reel" ? <video src={src} muted playsInline controls className="h-full w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  : <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />}
                {mode === "post" && i === 0 && <span className="sticker absolute bottom-1.5 left-1.5 -rotate-3 text-[10px]">Cover</span>}
                <button type="button" aria-label={`Remove ${mode === "reel" ? "video" : `photo ${i + 1}`}`}
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-card text-ink transition-transform hover:rotate-90">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {(mode === "post" ? files.length < MAX_PHOTOS : files.length === 0) && (
          <>
            <Label htmlFor="media-file" className="group grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-ink/40 bg-card/60 p-10 text-center font-sans font-normal text-muted-foreground transition-all hover:border-ink hover:bg-card">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink bg-pop text-ink shadow-brut-sm transition-transform group-hover:-rotate-6 group-hover:scale-105">
                {mode === "reel" ? <Film className="h-6 w-6" aria-hidden /> : <ImagePlus className="h-6 w-6" aria-hidden />}
              </span>
              <span className="font-display text-base font-bold text-ink">{mode === "reel" ? "Choose a video" : files.length ? "Add more photos" : "Choose photos"}</span>
              <span className="eyebrow text-[10px]">{mode === "reel" ? "MP4, WebM or MOV, up to 50 MB (about 30 seconds)" : "JPG, PNG or WebP, up to 5 MB each"}</span>
            </Label>
            <input id="media-file" type="file" className="sr-only" multiple={mode === "post"}
              accept={mode === "reel" ? "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" : "image/jpeg,image/png,image/webp"}
              onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </>
        )}
      </section>

      <div className="space-y-2">
        <Label htmlFor="np-title">What are you posting?</Label>
        <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90}
          className="h-14 font-display text-lg font-bold"
          placeholder={mode === "reel" ? "Gameday tickets, Auburn vs. Bama" : "Mini fridge, 3.2 cu ft"} />
      </div>

      <div className="space-y-2">
        <p id="np-kind-label" className="font-display text-sm font-bold">Type</p>
        <div role="radiogroup" aria-labelledby="np-kind-label" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
              className={cn(pill, kind === k.value ? "border-ink bg-primary text-primary-foreground shadow-brut-sm" : "border-ink/15 bg-card hover:border-ink")}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {hasPrice && (
          <div className="space-y-2">
            <Label htmlFor="np-price">Price ($){kind === "service" && opt}</Label>
            <Input id="np-price" value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" placeholder={kind === "service" ? "20 per hour" : "45"} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="np-category">Category</Label>
          <select id="np-category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className={cn(field, "h-12")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="np-condition">Condition{opt}</Label>
          <select id="np-condition" value={condition} onChange={(e) => setCondition(e.target.value as Condition | "")} className={cn(field, "h-12")}>
            <option value="">Not applicable</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {kind === "trade" && (
        <fieldset className="space-y-4 rounded-2xl border-2 border-dashed border-ink bg-card p-5">
          <legend className="eyebrow rounded-md bg-ink px-2 py-1 text-paper">What would you trade for?</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = wants.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} disabled={!on && wants.length >= 5}
                  onClick={() => setWants((cur) => (on ? cur.filter((x) => x !== c) : [...cur, c]))}
                  className={cn(pill, on ? "border-ink bg-pop text-ink shadow-brut-sm" : "border-ink/15 hover:border-ink")}>
                  {cap(c)}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-trade-text">Anything specific?{opt}</Label>
            <Input id="np-trade-text" value={tradeText} onChange={(e) => setTradeText(e.target.value)} maxLength={280} placeholder="A graphing calculator or lab goggles" />
          </div>
        </fieldset>
      )}

      <div className="space-y-2">
        <Label htmlFor="np-tags">Tags</Label>
        <Input id="np-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="#dorm #appliance #ferguson" aria-describedby="np-tags-help" className="font-mono text-[15px]" />
        <p id="np-tags-help" className="text-xs text-muted-foreground">At least one. Buyers find your post by tag (major, club, category…).</p>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Your tags">
            {tags.map((t) => <li key={t} className="animate-pop rounded-full border-2 border-ink bg-pop px-2.5 py-0.5 font-mono text-xs font-bold">#{t}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="np-pickup">Pickup spot{opt}</Label>
        <Input id="np-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={280} placeholder="Ferguson Center, weekday evenings" />
      </div>

      {errorBox}
      <Button type="submit" size="lg" className="w-full sm:w-auto">Next: preview <ArrowRight className="h-4 w-4" aria-hidden /></Button>
    </form>
  );
}
