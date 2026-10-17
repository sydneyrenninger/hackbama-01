"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, ChevronDown, ChevronUp, Eye, Heart, MessageCircle, Settings2, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/shell/avatar";
import { mediaUrl } from "@/lib/media/url";
import { cn, formatPrice } from "@/lib/utils";
import { setLiked, setSaved } from "@/server/actions/offers";
import { BUY_LABEL, BuyPanel, CommentsPanel, Sheet, ViewPanel, type ReelItem } from "./reel-panels";

type Panel = { type: "view" | "buy" | "comments"; id: string } | null;

/**
 * Full-screen, vertically snapping feed of listings (YouTube Shorts / Reels style).
 * Starts at the listing you tapped; scroll for the rest of the search results.
 * The URL follows the listing on screen, so refresh/share lands on it.
 */
export function ReelViewer({ items, startIndex, currentUserId, savedIds, commentCounts, likeCounts, likedIds, backHref, inboxHref, query }: {
  items: ReelItem[]; startIndex: number; currentUserId: string; savedIds: string[];
  commentCounts: Record<string, number>; likeCounts: Record<string, number>; likedIds: string[];
  backHref: string; inboxHref: string; query: string;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [saved, setSavedIds] = useState(() => new Set(savedIds));
  const [liked, setLikedIds] = useState(() => new Set(likedIds));
  const [likes, setLikes] = useState(likeCounts);
  const [counts, setCounts] = useState(commentCounts);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Jump to the tapped listing before first paint.
  useLayoutEffect(() => {
    const el = scroller.current?.children[startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "start" });
  }, [startIndex]);

  // Track which slide is on screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { root, threshold: 0.6 });
    Array.from(root.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length]);

  // Keep the address bar on the listing being viewed.
  useEffect(() => {
    const it = items[active];
    if (it) window.history.replaceState(window.history.state, "", `/listing/${it.id}${query ? `?${query}` : ""}`);
  }, [active, items, query]);

  const go = useCallback((delta: number) => {
    const root = scroller.current;
    if (root) root.scrollBy({ top: delta * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel) { if (e.key === "Escape") setPanel(null); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") router.push(backHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, go, router, backHref]);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2500); };

  async function toggleLike(id: string) {
    const next = !liked.has(id);
    const apply = (on: boolean) => {
      setLikedIds((cur) => { const s = new Set(cur); if (on) s.add(id); else s.delete(id); return s; });
      setLikes((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (on ? 1 : -1)) }));
    };
    apply(next);
    const res = await setLiked(id, next);
    if (!res.ok) { apply(!next); flash(res.error); }
  }

  async function toggleSave(id: string) {
    const next = !saved.has(id);
    setSavedIds((cur) => { const s = new Set(cur); if (next) s.add(id); else s.delete(id); return s; });
    const res = await setSaved(id, next);
    if (!res.ok) {
      setSavedIds((cur) => { const s = new Set(cur); if (next) s.delete(id); else s.add(id); return s; });
      flash(res.error);
    } else flash(next ? "Saved" : "Removed from saved");
  }

  const setCount = useCallback((id: string) => (n: number) => setCounts((c) => (c[id] === n ? c : { ...c, [id]: n })), []);
  const current = items[active];
  const panelItem = panel ? items.find((i) => i.id === panel.id) : null;
  const hasVideo = current?.images?.some((m) => m.media_type === "video");

  return (
    <div className="absolute inset-0 bg-black text-white">
      <div ref={scroller} role="feed" aria-label="Listings" className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <Slide key={item.id} item={item} index={i} total={items.length} active={i === active} near={Math.abs(i - active) <= 1} muted={muted}
            saved={saved.has(item.id)} commentCount={counts[item.id] ?? 0} mine={item.seller_id === currentUserId}
            liked={liked.has(item.id)} likeCount={likes[item.id] ?? 0} onToggleLike={() => toggleLike(item.id)}
            onPanel={(type) => setPanel({ type, id: item.id })} onToggleSave={() => toggleSave(item.id)} />
        ))}
      </div>

      <Link href={backHref} aria-label="Back" className="absolute left-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur hover:bg-black/70">
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>
      {hasVideo && (
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Mute"} aria-pressed={!muted}
          className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur hover:bg-black/70">
          {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
        </button>
      )}
      <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous listing"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30"><ChevronUp className="h-5 w-5" aria-hidden /></button>
        <button type="button" onClick={() => go(1)} disabled={active === items.length - 1} aria-label="Next listing"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30"><ChevronDown className="h-5 w-5" aria-hidden /></button>
      </div>
      {toast && <p role="status" className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg">{toast}</p>}

      {panel && panelItem && (
        <Sheet title={panel.type === "view" ? "Details" : panel.type === "buy" ? (BUY_LABEL[panelItem.kind] ?? "Buy") : "Comments"} onClose={() => setPanel(null)}>
          {panel.type === "view" && <ViewPanel item={panelItem} />}
          {panel.type === "buy" && <BuyPanel item={panelItem} inboxHref={inboxHref} />}
          {panel.type === "comments" && <CommentsPanel item={panelItem} currentUserId={currentUserId} onCount={setCount(panelItem.id)} />}
        </Sheet>
      )}
    </div>
  );
}

function Slide({ item, index, total, active, near, muted, saved, commentCount, mine, liked, likeCount, onToggleLike, onPanel, onToggleSave }: {
  item: ReelItem; index: number; total: number; active: boolean; near: boolean; muted: boolean; saved: boolean;
  commentCount: number; mine: boolean; liked: boolean; likeCount: number; onToggleLike: () => void;
  onPanel: (t: "view" | "buy" | "comments") => void; onToggleSave: () => void;
}) {
  const price = formatPrice(item.price_cents, item.kind);
  const sold = item.status === "sold";
  return (
    <section data-index={index} aria-label={`${item.title}, ${index + 1} of ${total}`} className="relative h-full w-full snap-start snap-always">
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden bg-neutral-950">
        <MediaCarousel item={item} active={active} near={near} muted={muted} />

        {sold && <span className="absolute left-16 top-4 rounded-full bg-white px-3 py-1 text-sm font-bold text-black">Sold</span>}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-6 pr-20 pt-28">
          <div className="pointer-events-auto space-y-2">
            {item.seller && (
              <Link href={`/u/${item.seller.id}`} className="flex w-fit items-center gap-2 hover:underline">
                <Avatar name={item.seller.display_name} path={item.seller.avatar_path} size="sm" className="ring-2 ring-white/70" />
                <span className="font-semibold">{item.seller.display_name}</span>
                {item.tenant && <span className="text-sm text-white/70">· {item.tenant.short_name}</span>}
              </Link>
            )}
            <h2 className="font-display text-xl font-bold leading-snug">{item.title}</h2>
            {price && <p className="w-fit rounded-full bg-white px-3 py-0.5 text-sm font-bold text-black">{price}</p>}
            {item.description && (
              <button type="button" onClick={() => onPanel("view")} className="block text-left text-sm text-white/90">
                <span className="line-clamp-2">{item.description}</span>
                {item.description.length > 90 && <span className="font-semibold text-white">more</span>}
              </button>
            )}
            {item.tags.length > 0 && <p className="truncate text-sm font-semibold text-white/90">{item.tags.map((t) => `#${t}`).join(" ")}</p>}
          </div>
        </div>

        <div className="absolute bottom-20 right-2 flex flex-col items-center gap-3.5">
          <RailButton label={likeCount ? String(likeCount) : "Like"} ariaLabel={`${liked ? "Unlike" : "Like"} (${likeCount} likes)`} onClick={onToggleLike} pressed={liked}>
            <Heart className={cn("h-6 w-6", liked && "fill-red-500 text-red-500")} aria-hidden />
          </RailButton>
          <RailButton label="View" onClick={() => onPanel("view")}><Eye className="h-6 w-6" aria-hidden /></RailButton>
          {mine ? (
            <Link href={`/c/${item.tenant?.slug ?? ""}/sell`} className="flex flex-col items-center gap-1 text-xs font-semibold">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 backdrop-blur"><Settings2 className="h-6 w-6" aria-hidden /></span>Manage
            </Link>
          ) : (
            <RailButton label={BUY_LABEL[item.kind] ?? "Buy"} onClick={() => onPanel("buy")} disabled={sold} highlight>
              <ShoppingBag className="h-6 w-6" aria-hidden />
            </RailButton>
          )}
          <RailButton label={saved ? "Saved" : "Save"} onClick={onToggleSave} pressed={saved}>
            <Bookmark className={cn("h-6 w-6", saved && "fill-current")} aria-hidden />
          </RailButton>
          <RailButton label={commentCount ? String(commentCount) : "Comment"} ariaLabel={`Comments (${commentCount})`} onClick={() => onPanel("comments")}>
            <MessageCircle className="h-6 w-6" aria-hidden />
          </RailButton>
        </div>
      </div>
    </section>
  );
}

function RailButton({ label, ariaLabel, onClick, pressed, disabled, highlight, children }: {
  label: string; ariaLabel?: string; onClick: () => void; pressed?: boolean; disabled?: boolean; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={ariaLabel ?? label}
      className="flex flex-col items-center gap-1 text-xs font-semibold drop-shadow disabled:opacity-40">
      <span className={cn("grid h-12 w-12 place-items-center rounded-full backdrop-blur transition-colors",
        highlight ? "bg-primary text-primary-foreground" : "bg-white/15 hover:bg-white/25")}>{children}</span>
      <span aria-hidden>{label}</span>
    </button>
  );
}

/** A listing's photos/videos; swipe sideways if there are several. */
function MediaCarousel({ item, active, near, muted }: { item: ReelItem; active: boolean; near: boolean; muted: boolean }) {
  const media = [...(item.images ?? [])].sort((a, b) => a.position - b.position);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  if (media.length === 0) {
    return (
      <div className="grid h-full place-items-center bg-gradient-to-br from-primary to-neutral-900" aria-hidden>
        <span className="font-display text-8xl font-bold text-white/30">{item.title.charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <>
      <div ref={ref} onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {media.map((m, i) => (
          <div key={m.storage_path} className="grid h-full w-full shrink-0 snap-center place-items-center">
            {m.media_type === "video"
              ? <ReelVideo src={mediaUrl(m.storage_path, "video")} play={active && i === idx} load={near} muted={muted} label={item.title} />
              // eslint-disable-next-line @next/next/no-img-element -- public storage URL
              : <img src={mediaUrl(m.storage_path, "image")} alt={i === 0 ? item.title : `${item.title}, photo ${i + 1}`} loading={near ? "eager" : "lazy"} className="max-h-full w-full object-contain" />}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="absolute inset-x-0 top-5 flex justify-center gap-1.5" aria-hidden>
          {media.map((m, i) => <span key={m.storage_path} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50")} />)}
        </div>
      )}
    </>
  );
}

/** Autoplays (muted by default) while on screen; tap to pause. Only nearby slides load their video. */
function ReelVideo({ src, play, load, muted, label }: { src: string; play: boolean; load: boolean; muted: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (play && !paused) v.play().catch(() => { /* autoplay blocked: user can tap */ });
    else v.pause();
  }, [play, paused]);
  useEffect(() => { if (!play) setPaused(false); }, [play]);
  return (
    <video ref={ref} src={load ? src : undefined} muted={muted} loop playsInline preload={load ? "auto" : "none"} aria-label={`Video: ${label}`}
      onClick={() => setPaused((p) => !p)} className="h-full w-full object-contain" />
  );
}
