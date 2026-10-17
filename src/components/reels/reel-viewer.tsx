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

const glass = "grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-colors hover:bg-black/70";

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

  // Move exactly one post up/down from the post currently snapped into view.
  const go = useCallback((delta: number) => {
    const root = scroller.current;
    if (!root) return;
    const h = root.clientHeight;
    const target = Math.min(root.children.length - 1, Math.max(0, Math.round(root.scrollTop / h) + delta));
    root.scrollTo({ top: target * h, behavior: "smooth" });
  }, []);

  // Mouse wheel / trackpad: one gesture = one post (native snapping needs you to scroll past halfway,
  // which felt like dragging the reel before it moved). Momentum events from the same flick are ignored.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    let lockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: photo carousel
      e.preventDefault();
      const now = Date.now();
      if (now < lockUntil) { lockUntil = Math.max(lockUntil, now + 250); return; } // still the same flick
      if (Math.abs(e.deltaY) < 2) return;
      lockUntil = now + 650;
      go(e.deltaY > 0 ? 1 : -1);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [go]);

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
    <div className="absolute inset-0 bg-[#0d0c0a] text-white">
      <div ref={scroller} role="feed" aria-label="Listings" className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <Slide key={item.id} item={item} index={i} total={items.length} active={i === active} near={Math.abs(i - active) <= 1} muted={muted}
            saved={saved.has(item.id)} commentCount={counts[item.id] ?? 0} mine={item.seller_id === currentUserId}
            liked={liked.has(item.id)} likeCount={likes[item.id] ?? 0} onToggleLike={() => toggleLike(item.id)}
            onPanel={(type) => setPanel({ type, id: item.id })} onToggleSave={() => toggleSave(item.id)} />
        ))}
      </div>

      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <Link href={backHref} aria-label="Back" className={glass}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <span aria-hidden className="eyebrow rounded-full border border-white/20 bg-black/40 px-2.5 py-1.5 text-[10px] tabular-nums text-white/85 backdrop-blur-md">
          {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </span>
      </div>
      {hasVideo && (
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Mute"} aria-pressed={!muted}
          className={cn(glass, "absolute right-3 top-3 z-10")}>
          {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
        </button>
      )}
      <div className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous listing"
          className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/25 bg-white/10 transition-all hover:-translate-y-0.5 hover:bg-white/20 disabled:opacity-25"><ChevronUp className="h-5 w-5" aria-hidden /></button>
        <button type="button" onClick={() => go(1)} disabled={active === items.length - 1} aria-label="Next listing"
          className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/25 bg-white/10 transition-all hover:translate-y-0.5 hover:bg-white/20 disabled:opacity-25"><ChevronDown className="h-5 w-5" aria-hidden /></button>
      </div>
      {toast && (
        <p role="status" className="absolute left-1/2 top-16 z-20 -translate-x-1/2 animate-pop rounded-full border-2 border-ink bg-pop px-4 py-2 font-display text-sm font-extrabold text-ink shadow-brut">
          {toast}
        </p>
      )}

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
    <section data-index={index} aria-label={`${item.title}, ${index + 1} of ${total}`} className="relative h-full w-full snap-start snap-always overflow-hidden">
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden bg-neutral-950 md:border-x-2 md:border-white/10">
        <MediaCarousel item={item} active={active} near={near} muted={muted} />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent px-4 pb-7 pr-20 pt-36">
          <div className={cn("pointer-events-auto space-y-2.5 transition-all duration-500", active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
            {item.seller && (
              <Link href={`/u/${item.seller.id}`} className="flex w-fit items-center gap-2 rounded-full bg-black/30 py-1 pl-1 pr-3 backdrop-blur-sm transition-colors hover:bg-black/50">
                <Avatar name={item.seller.display_name} path={item.seller.avatar_path} size="sm" className="border-white" />
                <span className="text-sm font-bold">{item.seller.display_name}</span>
                {item.tenant && <span className="eyebrow text-[9px] text-white/60">{item.tenant.short_name}</span>}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {sold && <span className="-rotate-6 rounded-md border-2 border-red-400 px-2 py-0.5 font-display text-sm font-extrabold uppercase tracking-widest text-red-300">Sold</span>}
              {price && <span className="sticker -rotate-3 text-base">{price}</span>}
            </div>
            <h2 className="font-display text-[1.7rem] font-extrabold leading-[1.02] tracking-[-0.035em]">{item.title}</h2>
            {item.description && (
              <button type="button" onClick={() => onPanel("view")} className="block text-left text-sm leading-relaxed text-white/85">
                <span className="line-clamp-2">{item.description}</span>
                {item.description.length > 90 && <span className="font-bold text-pop">more</span>}
              </button>
            )}
            {item.tags.length > 0 && <p className="eyebrow truncate text-[10px] text-white/75">{item.tags.map((t) => `#${t}`).join("  ")}</p>}
          </div>
        </div>

        <div className="absolute bottom-20 right-2.5 flex flex-col items-center gap-3.5">
          <RailButton label={likeCount ? String(likeCount) : "Like"} ariaLabel={`${liked ? "Unlike" : "Like"} (${likeCount} likes)`} onClick={onToggleLike} pressed={liked}>
            <Heart className={cn("h-6 w-6 transition-transform", liked && "scale-110 fill-red-500 text-red-500")} aria-hidden />
          </RailButton>
          <RailButton label="View" onClick={() => onPanel("view")}><Eye className="h-6 w-6" aria-hidden /></RailButton>
          {mine ? (
            <Link href={`/c/${item.tenant?.slug ?? ""}/sell`} className="flex flex-col items-center gap-1 text-[11px] font-bold">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-md"><Settings2 className="h-6 w-6" aria-hidden /></span>Manage
            </Link>
          ) : (
            <RailButton label={BUY_LABEL[item.kind] ?? "Buy"} onClick={() => onPanel("buy")} disabled={sold} highlight>
              <ShoppingBag className="h-6 w-6" aria-hidden />
            </RailButton>
          )}
          <RailButton label={saved ? "Saved" : "Save"} onClick={onToggleSave} pressed={saved}>
            <Bookmark className={cn("h-6 w-6 transition-transform", saved && "scale-110 fill-pop text-pop")} aria-hidden />
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
      className="group flex flex-col items-center gap-1 text-[11px] font-bold drop-shadow disabled:opacity-40">
      <span className={cn("grid h-12 w-12 place-items-center rounded-2xl backdrop-blur-md transition-all duration-200 group-hover:-translate-y-0.5 group-active:scale-90",
        highlight ? "-rotate-6 border-2 border-ink bg-pop text-ink shadow-[3px_3px_0_0_var(--campus)]" : "border border-white/20 bg-white/15 group-hover:bg-white/25")}>{children}</span>
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
      <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_25%,var(--campus),#0d0c0a_70%)]" aria-hidden>
        <span className="font-serif text-[10rem] italic leading-none text-white/25">{item.title.charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <>
      <div ref={ref} onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {media.map((m, i) => (
          // Media is absolutely positioned so it can never be taller than the screen: a too-tall
          // slide lets the browser scroll inside it before snapping, which felt like a lag.
          <div key={m.storage_path} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
            {m.media_type === "video"
              ? <ReelVideo src={mediaUrl(m.storage_path, "video")} play={active && i === idx} load={near} muted={muted} label={item.title} />
              // eslint-disable-next-line @next/next/no-img-element -- public storage URL
              : <img src={mediaUrl(m.storage_path, "image")} alt={i === 0 ? item.title : `${item.title}, photo ${i + 1}`} loading={near ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-contain" />}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="absolute inset-x-0 top-[4.25rem] flex justify-center gap-1.5" aria-hidden>
          {media.map((m, i) => <span key={m.storage_path} className={cn("h-1.5 rounded-full transition-all duration-300", i === idx ? "w-6 bg-pop" : "w-1.5 bg-white/50")} />)}
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
      onClick={() => setPaused((p) => !p)} className="absolute inset-0 h-full w-full object-contain" />
  );
}
