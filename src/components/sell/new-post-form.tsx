"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dollarsToCents, splitTags } from "@/lib/format";
import { uploadListingMedia } from "@/lib/media/upload";
import { cn } from "@/lib/utils";
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

/** Create a listing: a photo post (1-8 photos) or a reel (one video). Posts to your home campus. */
export function NewPostForm({ campusSlug, homeCampusName }: { campusSlug: string; homeCampusName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"post" | "reel">("post");
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<Kind>("sale");
  const [wants, setWants] = useState<Category[]>([]);
  const [tagsText, setTagsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const tags = useMemo(() => [...new Set(splitTags(tagsText))], [tagsText]);

  function switchMode(next: "post" | "reel") {
    if (next === mode) return;
    setMode(next); setFiles([]); setError(null);
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const f = new FormData(e.currentTarget);
    if (files.length === 0) return setError(mode === "reel" ? "Add a video for your reel." : "Add at least one photo.");
    if (tags.length === 0) return setError("Add at least one tag, like #dress or #ece.");

    setBusy(true); setProgress("Creating your listing…");
    const created = await createListing({
      title: String(f.get("title") ?? ""),
      description: String(f.get("description") ?? ""),
      category: String(f.get("category") ?? "other") as Category,
      kind,
      priceCents: kind === "sale" || kind === "service" ? dollarsToCents(f.get("price")) : null,
      condition: (String(f.get("condition") ?? "") || null) as Condition | null,
      pickupNotes: String(f.get("pickup") ?? "").trim() || null,
      tradeWantsCategories: kind === "trade" ? wants : [],
      tradeWantsText: kind === "trade" ? String(f.get("tradeText") ?? "").trim() || null : null,
      tags,
      isReel: mode === "reel",
    });
    if (!created.ok) { setBusy(false); setProgress(""); return setError(created.error); }
    const id = created.data!.id;

    for (let i = 0; i < files.length; i++) {
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
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

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
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
                <button type="button" aria-label={`Remove ${mode === "reel" ? "video" : `photo ${i + 1}`}`} disabled={busy}
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
              <span className="text-xs font-normal">{mode === "reel" ? "MP4, WebM or MOV, up to 50 MB" : "JPG, PNG or WebP, up to 5 MB each"}</span>
            </Label>
            <input id="media-file" type="file" className="sr-only" multiple={mode === "post"} disabled={busy}
              accept={mode === "reel" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"}
              onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </>
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="np-title">Title</Label>
        <Input id="np-title" name="title" required minLength={3} maxLength={90} placeholder="Mini fridge, 3.2 cu ft" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="np-kind">Type</Label>
          <select id="np-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={cn(field, "h-11")}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        {(kind === "sale" || kind === "service") && (
          <div className="space-y-1.5">
            <Label htmlFor="np-price">Price ($)</Label>
            <Input id="np-price" name="price" inputMode="decimal" placeholder="45" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="np-category">Category</Label>
          <select id="np-category" name="category" defaultValue="other" className={cn(field, "h-11")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-condition">Condition <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <select id="np-condition" name="condition" defaultValue="" className={cn(field, "h-11")}>
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
            <Input id="np-trade-text" name="tradeText" maxLength={280} placeholder="A graphing calculator or lab goggles" />
          </div>
        </fieldset>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="np-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <textarea id="np-desc" name="description" rows={4} maxLength={4000} className={cn(field, "py-2")}
          placeholder="Works great, small freezer. Pickup only." />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-tags">Tags</Label>
        <Input id="np-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="#dorm #appliance" aria-describedby="np-tags-help" />
        <p id="np-tags-help" className="text-xs text-muted-foreground">At least one. Buyers find your post by tag.</p>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Your tags">
            {tags.map((t) => <li key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">#{t}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-pickup">Pickup notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="np-pickup" name="pickup" maxLength={280} placeholder="Ferguson Center, evenings" />
      </div>

      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={busy}>{busy ? progress || "Posting…" : mode === "reel" ? "Post reel" : "Post listing"}</Button>
        <p className="text-sm text-muted-foreground">Posting to {homeCampusName}</p>
      </div>
    </form>
  );
}
