// Swapp - campus marketplace. Vanilla TypeScript, no dependencies.

// ---------- EMAIL SETUP (free: emailjs.com, 200 emails/month) ----------
// 1) Create an EmailJS account, add an Email Service (Gmail etc.)
// 2) Create a template: To Email = {{to_email}}, body contains {{code}}
// 3) Paste your Service ID, Template ID and Public Key below.
const EMAILJS = { serviceId: "", templateId: "", publicKey: "" };

type Kind = "post" | "reel";
type Page = "login" | "signup" | "verify" | "setpw" | "main" | "feed" | "product" | "chat" | "new" | "compose";
type Tab = "buy" | "sell" | "requests" | "inbox";
type Sort = "relevance" | "low" | "high";
interface Listing { id: number; kind: Kind; title: string; price: number; desc: string; cond: string; seller: string; tags: string[]; emoji: string; hue: number; uni: string; img?: string; video?: string; likes?: number; acceptTrade?: boolean; tradeValue?: number; tradeFor?: string; sold: boolean; mine: boolean; }
interface Req { id: number; channel: string; text: string; tags: string[]; budget?: number; budgetMin?: number; budgetMax?: number; author: string; uni: string; }
interface Msg { me: boolean; text: string; sentAt?: number; }
interface Thread { key: string; who: string; ctx: string; msgs: Msg[]; uni: string; }
interface Draft { title: string; price: string; desc: string; cond: string; tags: string; img: string; video: string; kind: Kind; acceptTrade: boolean; tradeValue: string; tradeFor: string; }
interface Uni { name: string; short: string; p: string; a: string; spirit: string; people: string[]; }

const UNIS: Uni[] = [
  { name: "University of Alabama", short: "Bama", p: "#9E1B32", a: "#D8D8D8", spirit: "Crimson Tide game-day shirt", people: ["Maya Brooks", "Jordan Hale", "Tyler Nash", "Brielle Cox"] },
  { name: "Auburn University", short: "Auburn", p: "#0C2340", a: "#E87722", spirit: "War Eagle tailgate chair", people: ["Caleb Ross", "Hannah Yu", "Devon Pratt", "Skylar Dunn"] },
  { name: "Georgia Tech", short: "Tech", p: "#9a8a4a", a: "#003057", spirit: "Ramblin' Wreck hoodie", people: ["Arjun Rao", "Mei Lin", "Noah Frank", "Isla Grant"] },
  { name: "University of Michigan", short: "Michigan", p: "#00274C", a: "#FFCB05", spirit: "Go Blue winter beanie", people: ["Olivia Park", "Ethan Cole", "Zara Malik", "Lucas Webb"] },
];
const ITEMS: [string, number, string[], string, number, string, string, Kind][] = [
  ["Blue Prom Dress (M)", 45, ["dress", "formal"], "👗", 215, "Worn once. Satin, floor length, dry cleaned.", "Like new", "post"],
  ["ECE 301 Signals Textbook", 30, ["textbook", "ece"], "📘", 260, "Oppenheim 3rd ed. Light highlighting in ch. 1-4.", "Good", "reel"],
  ["Mini Fridge 3.2 cu ft", 60, ["dorm", "appliance"], "🧊", 190, "Works perfectly, small freezer. Pickup only.", "Good", "post"],
  ["TI-84 Plus Calculator", 55, ["ece", "calculator"], "🧮", 150, "Includes cover and fresh batteries.", "Good", "post"],
  ["Red Cocktail Dress (S)", 35, ["dress", "formal"], "💃", 350, "True to size. Video shows the fit.", "Like new", "reel"],
];

let nid = 1000;
function seedListings(): Listing[] {
  const out: Listing[] = [];
  UNIS.forEach((u, ui) => {
    const mk = (t: typeof ITEMS[0], i: number): Listing => ({ id: ui * 100 + i + 1, kind: t[7], title: t[0], price: t[1] + ui * 3, tags: t[2], emoji: t[3], hue: (t[4] + ui * 25) % 360, desc: t[5], cond: t[6], seller: u.people[i % 4], uni: u.name, sold: false, mine: false });
    ITEMS.forEach((t, i) => out.push(mk(t, i)));
    out.push({ id: ui * 100 + 50, kind: "post", title: u.spirit, price: 28, tags: ["spirit", "clothes"], emoji: "🎓", hue: 20 + ui * 70, desc: `Official ${u.short} gear, barely used.`, cond: "Like new", seller: u.people[3], uni: u.name, sold: false, mine: false });
    out.push({ id: ui * 100 + 60, kind: "post", title: "Desk Lamp + Organizer", price: 15, tags: ["dorm", "desk"], emoji: "💡", hue: 45, desc: "Past sale: LED lamp with USB port.", cond: "Good", seller: "You", uni: u.name, sold: true, mine: true });
  });
  return out;
}
function seedReqs(): Req[] {
  const out: Req[] = [];
  UNIS.forEach((u, ui) => {
    out.push({ id: ui * 100 + 1, channel: "Tutoring", text: ui % 2 ? "Need calculus II help before midterm" : "Looking for ECE tutor", tags: ["weekend", ui % 2 ? "math" : "ece"], budget: 25, author: u.people[0], uni: u.name });
    out.push({ id: ui * 100 + 2, channel: "Rides", text: `Airport ride from ${u.short} on Friday`, tags: ["airport", "friday"], budget: 30, author: u.people[1], uni: u.name });
    out.push({ id: ui * 100 + 3, channel: "Moving Help", text: "Need 2 people to move a couch", tags: ["move", "sunday"], budget: 40, author: u.people[2], uni: u.name });
  });
  return out;
}

let listings = seedListings(), reqs = seedReqs();
let threads: Record<string, Thread> = {};
let saved: number[] = [];
let liked: number[] = [];
let users: Record<string, { pw: string; uni: string }> = {};
let channels = ["Tutoring", "Rides", "Housing", "Moving Help"];
let initialUni = UNIS[0];
try {
  const d = JSON.parse(localStorage.getItem("swapp") ?? "null");
  if (d) { listings = d.listings; reqs = d.reqs; threads = d.threads; saved = d.saved; liked = d.liked ?? []; users = d.users; channels = d.channels; initialUni = UNIS.find(u => u.name === d.uni) ?? initialUni; }
} catch { /* ignore */ }
nid = Math.max(nid, ...listings.map(l => l.id + 1), ...reqs.map(r => r.id + 1));
function persist() {
  try { localStorage.setItem("swapp", JSON.stringify({ listings: listings.map(l => ({ ...l, video: l.video?.startsWith("blob:") ? undefined : l.video })), reqs, threads, saved, liked, users, channels, uni: S.uni.name })); }
  catch { toast("Storage full - large photos won't persist"); }
}

const emptyDraft = (): Draft => ({ title: "", price: "", desc: "", cond: "Good", tags: "", img: "", video: "", kind: "post", acceptTrade: false, tradeValue: "", tradeFor: "" });
const S = { page: "login" as Page, tab: "buy" as Tab, uni: initialUni, me: "You", email: "", code: "", demoCode: false, err: "", toast: "", query: "", reqQuery: "", sort: "relevance" as Sort, filters: false, showSaved: false, mode: "all" as "all" | Kind, cur: 0, feedIdx: 0, chan: "All", prev: "main" as Page, th: "", sellTab: "active" as "active" | "sold", draft: emptyDraft(), showReq: false, busy: false };
const root = document.getElementById("app") as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const val = (id: string) => ((document.getElementById(id) as HTMLInputElement | null)?.value ?? "").trim();
const tagsOf = (s: string) => s.split(/[\s,#]+/).filter(Boolean).map(t => t.toLowerCase());
const tagH = (t: string[]) => t.map(x => `<span class="tag">#${esc(x)}</span>`).join("");
const grad = (h: number) => `background:linear-gradient(145deg,hsl(${h} 34% 91%),hsl(${(h + 28) % 360} 38% 78%))`;
const L = (id: number) => listings.find(l => l.id === id) as Listing;
const initial = (n: string) => esc(n.trim().charAt(0).toUpperCase() || "?");

function toast(t: string) { S.toast = t; render(); setTimeout(() => { S.toast = ""; render(); }, 3200); }
function go(p: Page, from?: Page) { if (from) S.prev = from; S.page = p; S.err = ""; render(); }

function media(l: Listing, play = false): string {
  if (l.video) return `<video class="m" src="${l.video}" muted loop playsinline ${play ? "autoplay" : ""}></video>`;
  if (l.img) return `<img class="m" src="${l.img}" alt="">`;
  return `<div class="m" style="${grad(l.hue)}">${l.emoji}</div>`;
}
function listingCaption(title: string, price: number | string, details: string): string {
  const intro = `Willing to sell ${title} for $${price}.`;
  const extra = details.trim();
  return extra ? `${intro} ${extra}${/[.!?]$/.test(extra) ? "" : "."}` : intro;
}
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function visible(): Listing[] {
  const q = S.query.toLowerCase().split(/\s+/).filter(Boolean);
  const sc = (l: Listing) => q.reduce((n, w) => n + (l.title.toLowerCase().includes(w) ? 3 : 0) + (l.tags.some(t => t.includes(w)) ? 2 : 0) + (l.desc.toLowerCase().includes(w) ? 1 : 0), 0);
  let r = listings.filter(l => l.uni === S.uni.name && !l.sold && (S.mode === "all" || l.kind === S.mode) && (!q.length || sc(l) > 0));
  r = S.sort === "low" ? [...r].sort((a, b) => a.price - b.price) : S.sort === "high" ? [...r].sort((a, b) => b.price - a.price) : [...r].sort((a, b) => sc(b) - sc(a));
  return r;
}
function tile(l: Listing, a = "open"): string {
  return `<article class="tile ${l.kind} ${l.sold ? "sold" : ""}" data-a="${a}" data-id="${l.id}"><div class="tile-media">${media(l)}<span class="pill">${l.sold ? "Sold" : l.kind === "reel" ? "▶ Reel" : "Photo"}</span><span class="pr">$${l.price}${l.acceptTrade ? " · Trade" : ""}</span></div><div class="tt"><b>${esc(l.title)}</b><span class="tile-seller">${esc(l.seller)} · ${esc(l.cond)}</span><div class="tile-tags">${tagH(l.tags)}</div><span class="tile-open">View listing <span aria-hidden="true">→</span></span></div></article>`;
}
const bar = () => `<div class="bar"><span class="logo">swapp</span><span class="sp"></span><select id="uni" data-a="uni">${UNIS.map(u => `<option ${u.name === S.uni.name ? "selected" : ""}>${u.name}</option>`).join("")}</select><button class="g" data-a="logout" title="Log out">⎋</button></div>`;
const navH = () => `<div class="nav">${([["buy", "✦ Buy"], ["sell", "＋ Sell"], ["requests", "☰ Requests"], ["inbox", "✉ Inbox"]] as [Tab, string][]).map(([k, t]) => `<button class="${S.tab === k ? "on" : ""}" data-a="tab" data-k="${k}">${t}</button>`).join("")}</div>`;
const authBox = (x: string) => `<div class="auth"><div class="logo" style="font-size:40px">swapp</div>${x}<div class="err">${esc(S.err)}</div></div>`;
const uniSel = () => `<select id="uni" data-a="uni">${UNIS.map(u => `<option ${u.name === S.uni.name ? "selected" : ""}>${u.name}</option>`).join("")}</select>`;

function view(): string {
  switch (S.page) {
    case "login": return authBox(`<div class="av">👤</div><b>Welcome back</b>${uniSel()}<input id="email" type="email" placeholder="School email" value="${esc(S.email)}"><input id="pw" type="password" placeholder="Password"><button class="pri" data-a="login">Login</button><button class="g" data-a="p-signup">New here? Sign up</button><button class="g" data-a="demo-login">Explore the demo without an account</button>`);
    case "signup": return authBox(`<b>Create your account</b>${uniSel()}<input id="email" type="email" autocomplete="email" placeholder="University email (e.g. student@school.edu)">${!EMAILJS.serviceId || !EMAILJS.templateId || !EMAILJS.publicKey ? `<span class="mut">Email delivery isn't configured. A demo verification code will appear on the next screen.</span>` : ""}<button class="pri" data-a="send" ${S.busy ? "disabled" : ""}>${S.busy ? "Sending..." : "Send verification code"}</button><button class="g" data-a="p-login">Back to login</button>`);
    case "verify": return authBox(`<b>Verification code</b><span class="mut">${S.demoCode ? `Email delivery isn't configured for ${esc(S.email)}.` : `We sent 6 digits to ${esc(S.email)}`}</span>${S.demoCode ? `<div class="card">Use this demo code:<br><b style="font-size:24px;letter-spacing:4px">${esc(S.code)}</b></div>` : ""}<input id="code" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit code" style="text-align:center;letter-spacing:10px;font-size:24px"><button class="pri" data-a="verify">Verify</button><button class="g" data-a="send">Resend code</button>`);
    case "setpw": return authBox(`<b>Set password</b><input id="pw1" type="password" placeholder="Password (8+ characters)"><input id="pw2" type="password" placeholder="Retype password"><button class="pri" data-a="setpw">Set</button>`);
    case "main": return bar() + (S.tab === "buy" ? buyH() : S.tab === "sell" ? sellH() : S.tab === "requests" ? reqH() : inboxH()) + navH();
    case "feed": return feedH();
    case "product": return productH();
    case "chat": return chatH();
    case "new": return newH();
    case "compose": return composeH();
  }
}

function buyH(): string {
  const campusItems = visible();
  const savedCount = campusItems.filter(l => saved.includes(l.id)).length;
  const items = campusItems.filter(l => !S.showSaved || saved.includes(l.id));
  const m = (k: string, t: string) => `<button class="${S.mode === k ? "on" : ""}" data-a="mode" data-k="${k}">${t}</button>`;
  const so = (k: Sort, t: string) => `<button class="${S.sort === k ? "on" : ""}" data-a="sort" data-k="${k}">${t}</button>`;
  return `<h2>Discover at ${esc(S.uni.short)}</h2><div class="row"><input id="q" placeholder="Search Blue Dress, #ece, #textbook…" value="${esc(S.query)}"><button class="pri" data-a="search">Search</button><button data-a="filters">Filters</button></div>
  ${S.filters ? `<div class="chips">${so("low", "Price: low to high")}${so("high", "Price: high to low")}${so("relevance", "Relevance")}</div>` : ""}
  <div class="chips">${m("all", "All")}${m("post", "Posts")}${m("reel", "Reels")}<button class="${S.showSaved ? "on" : ""}" data-a="saved-filter" aria-pressed="${S.showSaved}">${S.showSaved ? "Show all listings" : `Saved (${savedCount})`}</button></div>
  <div class="grid">${items.map(l => tile(l)).join("") || `<p class="mut">${S.showSaved ? "No saved listings yet. Save an item to find it here." : `Nothing here yet at ${esc(S.uni.name)}.`}</p>`}</div>`;
}
function feedH(): string {
  const items = visible();
  return `<button class="back" data-a="back">← Back</button><div class="feed" id="feed">${items.map(l => `<section class="reelv">${media(l, true)}<div class="sh"></div>
  <div class="info"><div class="t">${esc(l.title)}</div><div style="font-weight:800;font-size:18px">$${l.price}</div><div style="opacity:.85">${esc(l.seller)} · ${esc(l.cond)}</div><div style="opacity:.85;font-size:13px;margin:4px 0">${esc(l.desc)}</div>${tagH(l.tags)}</div>
  <div class="act"><div><button data-a="like" data-id="${l.id}">${liked.includes(l.id) ? "♥" : "♡"}</button><small>${l.likes ?? 0} likes</small></div><div><button data-a="product" data-id="${l.id}">👁</button><small>View</small></div><div><button data-a="buy" data-id="${l.id}">🛍</button><small>Buy</small></div><div><button data-a="save" data-id="${l.id}">${saved.includes(l.id) ? "🔖" : "🏷"}</button><small>${saved.includes(l.id) ? "Saved" : "Save"}</small></div><div><button data-a="dm" data-id="${l.id}">💬</button><small>Contact</small></div></div></section>`).join("")}</div>`;
}
function productH(): string {
  const l = L(S.cur);
  return `<div class="bar"><button data-a="back">← Back</button><span class="mut">${esc(UNIS.find(u => u.name === l.uni)?.short ?? l.uni)} marketplace</span></div><article class="product-detail">
  <div class="product-visual">${l.video ? `<video src="${l.video}" controls playsinline preload="metadata"></video>` : media(l)}</div>
  <div class="product-info"><span class="mut">${esc(l.seller)} · ${esc(l.cond)} · ${l.kind === "reel" ? "Video listing" : "Photo listing"}</span><h2>${esc(l.title)}</h2><div class="product-price">$${l.price}</div>
  <p class="product-description">${esc(l.desc)}</p>${l.acceptTrade ? `<div><span class="tag">Open to trade${l.tradeValue ? ` · value ~$${l.tradeValue}` : ""}${l.tradeFor ? ` · wants ${esc(l.tradeFor)}` : ""}</span></div>` : ""}
  <div class="product-tags">${tagH(l.tags)}</div><p class="mut">${l.likes ?? 0} likes</p>
  <div class="row"><button class="pri" data-a="buy" data-id="${l.id}">Buy</button>${l.acceptTrade ? `<button data-a="trade-offer" data-id="${l.id}">Make a trade offer</button>` : ""}<button data-a="dm" data-id="${l.id}">Contact seller</button><button data-a="save" data-id="${l.id}">${saved.includes(l.id) ? "Saved" : "Save"}</button><button class="social-like ${liked.includes(l.id) ? "liked" : ""}" data-a="like" data-id="${l.id}" aria-label="${liked.includes(l.id) ? "Unlike" : "Like"} listing">${liked.includes(l.id) ? "♥" : "♡"}</button></div></div></article>`;
}
function sellH(): string {
  const mine = listings.filter(l => l.mine && l.uni === S.uni.name), act = mine.filter(l => !l.sold), sold = mine.filter(l => l.sold);
  const list = S.sellTab === "active" ? act : sold;
  return `<h2>Your shop</h2><div class="stats"><div><b>${act.length}</b><span class="mut">Active</span></div><div><b>${sold.length}</b><span class="mut">Sold</span></div><div><b>$${sold.reduce((s, l) => s + l.price, 0)}</b><span class="mut">Earned</span></div></div>
  <div class="row"><button class="pri" data-a="newprod">＋ Sell something</button><button class="${S.sellTab === "active" ? "on" : ""}" data-a="stab" data-k="active">Active</button><button class="${S.sellTab === "sold" ? "on" : ""}" data-a="stab" data-k="sold">Past sales</button></div>
  <div class="grid">${list.map(l => `<div>${tile(l, "product")}${l.sold ? "" : `<div class="row" style="margin-top:8px"><button data-a="marksold" data-id="${l.id}">Mark sold</button><button class="g" data-a="del" data-id="${l.id}">Delete</button></div>`}</div>`).join("") || `<p class="mut">${S.sellTab === "active" ? "Nothing listed yet. Tap Sell something." : "No past sales yet."}</p>`}</div>`;
}
function newH(): string {
  const d = S.draft;
  return `<div class="bar"><button data-a="back">← Back</button><span class="mut">Step 1 of 2 · Product</span></div><div class="form"><h2>Add your product</h2>
  <div class="post-kind"><button class="${d.kind === "post" ? "on" : ""}" data-a="kind" data-k="post">Photo post</button><button class="${d.kind === "reel" ? "on" : ""}" data-a="kind" data-k="reel">Video reel</button></div>
  <label class="drop ${d.kind === "reel" ? "reel-drop" : ""}" for="f-media">${d.kind === "reel" ? d.video ? `<video src="${d.video}" muted playsinline></video><span class="drop-label">Tap to replace video</span>` : "🎬<br>Add a video for your reel" : d.img ? `<img src="${d.img}" alt="">` : "📷<br>Add a photo for your post"}</label><input id="f-media" data-f="${d.kind === "reel" ? "vid" : "img"}" type="file" accept="${d.kind === "reel" ? "video/*" : "image/*"}" hidden>
  <input id="d-title" placeholder="Item name" value="${esc(d.title)}"><label class="field-label" for="d-price">Asking price</label><div class="price-field"><span>$</span><input id="d-price" type="number" min="0" step="0.01" placeholder="0.00" value="${esc(d.price)}"></div>
  <label class="trade-option"><input id="d-trade" type="checkbox" data-a="toggle-trade" ${d.acceptTrade ? "checked" : ""}><span><b>Open to trade</b><small>Let buyers offer an item or a cash-and-item deal.</small></span></label>
  ${d.acceptTrade ? `<div class="trade-fields"><label class="field-label" for="d-tradeValue">Trade value equivalent ($)</label><div class="price-field"><span>$</span><input id="d-tradeValue" type="number" min="0" step="0.01" placeholder="Optional" value="${esc(d.tradeValue)}"></div><label class="field-label" for="d-tradeFor">What would you trade for?</label><input id="d-tradeFor" placeholder="e.g. textbook, desk chair, or similar offer" value="${esc(d.tradeFor)}"></div>` : ""}
  <textarea id="d-desc" rows="3" placeholder="Add extra details (optional)">${esc(d.desc)}</textarea>
  <select id="d-cond">${["New", "Like new", "Good", "Fair"].map(c => `<option ${c === d.cond ? "selected" : ""}>${c}</option>`).join("")}</select>
  <input id="d-tags" placeholder="Tags (required) #dress #ece #textbook" value="${esc(d.tags)}"><div class="err">${esc(S.err)}</div><button class="pri" data-a="tocompose">Next →</button></div>`;
}
function composeH(): string {
  const d = S.draft, isReel = d.kind === "reel";
  const fake: Listing = { id: 0, kind: d.kind, title: d.title, price: Number(d.price), desc: listingCaption(d.title, d.price, d.desc), cond: d.cond, seller: S.me, tags: tagsOf(d.tags), emoji: "📦", hue: 280, uni: S.uni.name, img: d.img, video: d.video || undefined, sold: false, mine: true };
  return `<div class="bar"><button data-a="back">← Back</button><span class="mut">Step 2 of 2 · Edit and preview</span></div><div class="form"><h2>Review your post</h2>
  <div class="social-card"><div class="social-head"><div class="social-avatar">${initial(S.me)}</div><div><b>${esc(S.me)}</b><small>${esc(S.uni.short)} campus marketplace</small></div><span class="social-kind">${isReel ? "REEL" : "POST"}</span></div><div class="social-media">${media(fake, true)}</div><div class="social-actions"><span>♡</span><span>◯</span><span>⌁</span><span class="social-spacer"></span><span>▱</span></div><div class="social-caption"><b>${esc(S.me)}</b> <span data-preview-caption>${esc(fake.desc)}</span><div class="social-price" data-preview-price>$${esc(d.price)}${d.acceptTrade ? " · Open to trade" : ""}</div><div data-preview-trade>${d.acceptTrade ? `<span class="tag">Trade value ~$${esc(d.tradeValue || d.price)}${d.tradeFor ? ` · Wants ${esc(d.tradeFor)}` : ""}</span>` : ""}</div><div data-preview-tags>${tagH(tagsOf(d.tags))}</div></div></div>
  <div class="edit-post"><h3>Edit your caption</h3><p class="mut">The price and item are included automatically. Add any extra details below.</p><input id="d-title" placeholder="Item name" value="${esc(d.title)}"><label class="field-label" for="d-price">Asking price ($)</label><input id="d-price" type="number" min="0" step="0.01" placeholder="0.00" value="${esc(d.price)}"><textarea id="d-desc" rows="4" placeholder="Add extra details about the item (optional)">${esc(d.desc)}</textarea><input id="d-tags" placeholder="Tags #dress #ece" value="${esc(d.tags)}"><select id="d-cond">${["New", "Like new", "Good", "Fair"].map(c => `<option ${c === d.cond ? "selected" : ""}>${c}</option>`).join("")}</select>
  <label class="trade-option"><input id="d-trade" type="checkbox" data-a="toggle-trade" ${d.acceptTrade ? "checked" : ""}><span><b>Open to trade</b><small>Show that you will consider other items or mixed offers.</small></span></label>
  ${d.acceptTrade ? `<div class="trade-fields"><label class="field-label" for="d-tradeValue">Trade value equivalent ($)</label><input id="d-tradeValue" type="number" min="0" step="0.01" placeholder="Optional" value="${esc(d.tradeValue)}"><label class="field-label" for="d-tradeFor">What would you trade for?</label><input id="d-tradeFor" placeholder="Describe items or offers you would accept" value="${esc(d.tradeFor)}"></div>` : ""}</div>
  <span class="mut">Need a different ${isReel ? "video" : "photo"}? Go back to change your media.</span>
  <div class="err">${esc(S.err)}</div><button class="pri" data-a="publish">Publish to ${esc(S.uni.short)}</button></div>`;
}
function reqH(): string {
  const q = S.reqQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const categoryScore = (c: string) => q.reduce((score, word) => score + (c.toLowerCase() === word ? 10 : c.toLowerCase().startsWith(word) ? 7 : c.toLowerCase().includes(word) ? 5 : 0), 0);
  const contentScore = (r: Req) => q.reduce((score, word) => score + (r.text.toLowerCase().includes(word) ? 3 : 0) + (r.tags.some(t => t.includes(word)) ? 2 : 0), 0);
  const orderedChannels = [...channels].sort((a, b) => categoryScore(b) - categoryScore(a));
  const rs = reqs.filter(r => r.uni === S.uni.name && (S.chan === "All" || r.channel === S.chan))
    .filter(r => !q.length || categoryScore(r.channel) > 0 || contentScore(r) > 0)
    .sort((a, b) => categoryScore(b.channel) - categoryScore(a.channel) || contentScore(b) - contentScore(a));
  return `<h2>Find a request</h2><div class="search-panel"><div class="row"><input id="rq" placeholder="Search categories or requests (e.g. tutoring, rides, calculus)" value="${esc(S.reqQuery)}"><button class="pri" data-a="req-search">Search</button></div><p class="mut">Matching categories appear first, followed by related requests.</p></div><div class="chips">${["All", ...orderedChannels].map(c => `<button class="${S.chan === c ? "on" : ""}" data-a="chan" data-k="${esc(c)}">${esc(c)}${q.length && c !== "All" && categoryScore(c) ? " · match" : ""}</button>`).join("")}<button data-a="newchan">+ Request category</button></div>
  <div class="row"><button class="pri" data-a="togreq">${S.showReq ? "Close" : "＋ Post a request"}</button></div>
  ${S.showReq ? `<div class="card form" style="max-width:none"><select id="r-chan">${channels.map(c => `<option ${c === S.chan ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><input id="r-text" placeholder="Looking for ECE tutor…"><input id="r-tags" placeholder="Tags (required) #weekend #budget"><label class="field-label">What is your budget range?</label><div class="price-range"><div class="price-field"><span>$</span><input id="r-budgetMin" type="number" min="0" placeholder="From"></div><span class="mut">to</span><div class="price-field"><span>$</span><input id="r-budgetMax" type="number" min="0" placeholder="To"></div></div><div class="err">${esc(S.err)}</div><button class="pri" data-a="postreq">Post request</button></div>` : ""}
  ${rs.map(r => { const min = r.budgetMin ?? r.budget, max = r.budgetMax ?? r.budget, budget = min !== undefined && max !== undefined ? (min === max ? `$${min}` : `$${min}–$${max}`) : min !== undefined ? `from $${min}` : max !== undefined ? `up to $${max}` : "Flexible"; return `<div class="card"><div class="th"><div class="av">${initial(r.author)}</div><div style="flex:1"><b>${esc(r.text)}</b><br><span class="mut">${esc(r.author)} · ${esc(r.channel)} · budget ${budget}</span></div></div>${tagH(r.tags)}<div class="row" style="margin:10px 0 0"><button class="pri" data-a="help" data-id="${r.id}">I can help</button></div></div>`; }).join("") || `<p class="mut">${q.length ? "No matching requests. Try another category or search term." : `No requests yet at ${esc(S.uni.short)}.`}</p>`}`;
}
function inboxH(): string {
  const ts = Object.values(threads).filter(t => t.uni === S.uni.name);
  return `<h2>Messages</h2><div class="inbox-list">${ts.map(t => { const last = t.msgs[t.msgs.length - 1]; return `<div class="card inbox-item"><button class="inbox-open" data-a="thread" data-k="${esc(t.key)}"><span class="av">${initial(t.who)}</span><span class="inbox-copy"><b>${esc(t.who)} <span class="mut">· ${esc(t.ctx)}</span></b><span class="inbox-preview">${esc(last?.text ?? "")}</span></span><time class="inbox-time">${last ? messageTime(last.sentAt) : ""}</time></button><button class="inbox-delete" data-a="delete-thread" data-k="${esc(t.key)}" aria-label="Delete conversation with ${esc(t.who)}" title="Delete conversation">×</button></div>`; }).join("") || `<p class="mut">No messages yet. Contact a seller or tap "I can help" on a request.</p>`}</div>`;
}
function chatH(): string {
  const t = threads[S.th];
  return `<div class="bar"><button data-a="back">← Back</button><div class="th"><div class="av" style="width:38px;height:38px;font-size:15px;margin:0">${initial(t.who)}</div><div><b>${esc(t.who)}</b><br><span class="mut" style="font-size:12px">${esc(t.ctx)}</span></div></div></div>
  <div class="form" style="max-width:640px"><div class="chat">${t.msgs.map(m => `<div class="b ${m.me ? "me" : ""}"><span>${esc(m.text)}</span><time class="message-time" ${m.sentAt && Number.isFinite(m.sentAt) ? `datetime="${new Date(m.sentAt).toISOString()}"` : ""}>${messageTime(m.sentAt)}</time></div>`).join("")}</div><div class="row"><input id="msg" placeholder="Message…"><button class="pri" data-a="send-msg">Send</button></div></div>`;
}

function messageTime(sentAt?: number): string {
  if (!sentAt || !Number.isFinite(sentAt)) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(sentAt));
}

function openThread(key: string, who: string, ctx: string, first: string) {
  const message = { me: true, text: first, sentAt: Date.now() };
  if (!threads[key]) threads[key] = { key, who, ctx, uni: S.uni.name, msgs: [message] };
  else threads[key].msgs.push(message);
  S.th = key; persist(); go("chat", S.page);
}
function reply(key: string) {
  setTimeout(() => { const t = threads[key]; if (!t) return; t.msgs.push({ me: false, text: ["Hey! Yes, still available 🙌", "Sure, we can meet on campus - when are you free?", "Sounds good, message me the time!"][t.msgs.length % 3], sentAt: Date.now() }); persist(); if (S.page === "chat" && S.th === key) render(); }, 1100);
}
async function sendCode() {
  S.code = String(Math.floor(100000 + Math.random() * 900000)); S.demoCode = false; S.busy = true; render();
  const { serviceId, templateId, publicKey } = EMAILJS;
  if (!serviceId || !templateId || !publicKey) { S.busy = false; S.demoCode = true; return go("verify"); }
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_id: serviceId, template_id: templateId, user_id: publicKey, template_params: { to_email: S.email, code: S.code } }) });
    S.busy = false; if (!r.ok) throw new Error(await r.text());
    go("verify"); toast("Code sent - check your inbox");
  } catch (e) { S.busy = false; S.demoCode = false; S.err = "Couldn't send email: " + String(e).slice(0, 80); render(); }
}
function grabDraft() {
  const d = S.draft;
  if (document.getElementById("d-title")) {
    d.title = val("d-title"); d.price = val("d-price"); d.desc = val("d-desc"); d.cond = val("d-cond"); d.tags = val("d-tags");
    d.acceptTrade = (document.getElementById("d-trade") as HTMLInputElement | null)?.checked ?? d.acceptTrade;
    d.tradeValue = val("d-tradeValue"); d.tradeFor = val("d-tradeFor");
  }
}
function readFile(f: File, cb: (url: string, isVideo: boolean) => void) {
  if (f.type.startsWith("video/")) return cb(URL.createObjectURL(f), true);
  const fr = new FileReader(); fr.onload = () => cb(String(fr.result), false); fr.readAsDataURL(f);
}

function act(a: string, el: HTMLElement) {
  const id = Number(el.dataset.id ?? 0), k = el.dataset.k ?? "";
  switch (a) {
    case "uni": S.uni = UNIS.find(u => u.name === (el as HTMLSelectElement).value) ?? S.uni; if (S.page === "main" && users[S.email]) users[S.email].uni = S.uni.name; persist(); return render();
    case "p-signup": return go("signup"); case "p-login": return go("login");
    case "login": { const e = normalizeEmail(val("email")), u = users[e]; if (!u || u.pw !== val("pw")) { S.email = e; S.err = "Email or password is incorrect. If you are new, create an account first."; return render(); }
      S.email = e; S.me = e.split("@")[0]; S.uni = UNIS.find(campus => campus.name === u.uni) ?? S.uni; persist(); S.tab = "buy"; return go("main"); }
    case "demo-login": S.email = ""; S.me = "Demo Student"; S.tab = "buy"; persist(); return go("main");
    case "send": { if (S.page === "signup") { const e = normalizeEmail(val("email")); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { S.err = "Enter a valid email address (for example, student@school.edu)."; return render(); } S.email = e; } return void sendCode(); }
    case "verify": if (val("code") !== S.code) { S.err = "Incorrect code."; return render(); } return go("setpw");
    case "setpw": { const p = val("pw1"); if (p.length < 8) { S.err = "Password needs 8+ characters."; return render(); } if (p !== val("pw2")) { S.err = "Passwords don't match."; return render(); }
      users[S.email] = { pw: p, uni: S.uni.name }; S.me = S.email.split("@")[0]; persist(); S.tab = "buy"; return go("main"); }
    case "logout": return go("login");
    case "tab": S.tab = k as Tab; return go("main");
    case "mode": S.mode = k as typeof S.mode; return render();
    case "saved-filter": S.showSaved = !S.showSaved; return render();
    case "search": S.query = val("q"); return render();
    case "req-search": S.reqQuery = val("rq"); S.chan = "All"; return render();
    case "filters": S.query = val("q"); S.filters = !S.filters; return render();
    case "sort": S.sort = k as Sort; return render();
    case "open": S.feedIdx = visible().findIndex(l => l.id === id); S.cur = id; return go("feed", "main");
    case "back": if (S.page === "compose") return go("new"); S.page = S.page === "chat" || S.page === "product" || S.page === "new" ? (S.prev === "feed" && S.page === "product" ? "feed" : "main") : "main"; if (S.page === "feed") S.feedIdx = Math.max(0, visible().findIndex(l => l.id === S.cur)); return render();
    case "product": S.cur = id; return go("product", S.page);
    case "buy": { const l = L(id); return openThread(`l${id}`, l.seller, l.title, `Hey, I want to buy "${l.title}" for $${l.price}.`), reply(`l${id}`); }
    case "trade-offer": { const l = L(id); const offer = prompt(`What would you like to offer in trade for "${l.title}"?`)?.trim(); if (!offer) return; return openThread(`l${id}`, l.seller, l.title, `Hi! I'd like to offer ${offer} in trade for "${l.title}".`), reply(`l${id}`); }
    case "dm": { const l = L(id); return openThread(`l${id}`, l.seller, l.title, `Hey, I'm interested in "${l.title}". Is the $${l.price} price negotiable? I'm open to discussing an offer.`), reply(`l${id}`); }
    case "save": saved = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; persist(); { const f = document.getElementById("feed"); const st = f?.scrollTop ?? 0; render(); const f2 = document.getElementById("feed"); if (f2) f2.scrollTop = st; } return;
    case "like": { const l = L(id), feed = document.getElementById("feed"), st = feed?.scrollTop; if (liked.includes(id)) { liked = liked.filter(x => x !== id); l.likes = Math.max(0, (l.likes ?? 0) - 1); } else { liked.push(id); l.likes = (l.likes ?? 0) + 1; } persist(); render(); if (st !== undefined) { const nextFeed = document.getElementById("feed"); if (nextFeed) nextFeed.scrollTop = st; } return; }
    case "thread": S.th = k; return go("chat", "main");
    case "send-msg": { const t = val("msg"); if (!t) return; threads[S.th].msgs.push({ me: true, text: t, sentAt: Date.now() }); persist(); render(); return reply(S.th); }
    case "delete-thread": delete threads[k]; if (S.th === k) S.th = ""; persist(); return render();
    case "stab": S.sellTab = k as "active" | "sold"; return render();
    case "marksold": L(id).sold = true; persist(); return toast("Moved to past sales 🎉");
    case "del": listings = listings.filter(l => l.id !== id); persist(); return render();
    case "newprod": S.draft = emptyDraft(); return go("new");
    case "tocompose": { grabDraft(); const d = S.draft; if (d.kind === "post" && !d.img) { S.err = "Add a photo for your post."; return render(); } if (d.kind === "reel" && !d.video) { S.err = "Add a video for your reel."; return render(); } if (!d.title || d.price === "" || !Number.isFinite(Number(d.price)) || Number(d.price) < 0) { S.err = "Enter an item name and a valid price of $0 or more."; return render(); } if (!tagsOf(d.tags).length) { S.err = "At least one tag is required."; return render(); } return go("compose"); }
    case "kind": grabDraft(); S.draft.kind = k as Kind; if (k === "reel") { S.draft.img = ""; S.draft.video = ""; } else { S.draft.video = ""; S.draft.img = ""; } return render();
    case "toggle-trade": grabDraft(); S.draft.acceptTrade = (el as HTMLInputElement).checked; return render();
    case "publish": { grabDraft(); const d = S.draft; const tradeValue = d.tradeValue ? Number(d.tradeValue) : undefined; if ((d.kind === "post" && !d.img) || (d.kind === "reel" && !d.video)) { S.err = d.kind === "reel" ? "Add a video for your reel." : "Add a photo for your post."; return render(); } if (!d.title || !tagsOf(d.tags).length || !Number.isFinite(Number(d.price)) || Number(d.price) < 0) { S.err = "Check the title, tags, and asking price before publishing."; return render(); } if (d.tradeValue && (!Number.isFinite(Number(d.tradeValue)) || Number(d.tradeValue) < 0)) { S.err = "Enter a valid trade value."; return render(); } listings.unshift({ id: nid++, kind: d.kind, title: d.title, price: Number(d.price), desc: listingCaption(d.title, d.price, d.desc), cond: d.cond, seller: S.me, tags: tagsOf(d.tags), emoji: "📦", hue: 280, uni: S.uni.name, img: d.kind === "post" ? d.img : undefined, video: d.kind === "reel" ? d.video : undefined, acceptTrade: d.acceptTrade, tradeValue, tradeFor: d.tradeFor.trim() || undefined, sold: false, mine: true }); persist(); S.tab = "buy"; go("main"); return toast("Published! It's live for your campus."); }
    case "chan": S.chan = k; return render();
    case "newchan": { const n = prompt("New channel (e.g. Photography)")?.trim(); if (n && !channels.includes(n)) { channels.push(n); persist(); } return render(); }
    case "togreq": S.showReq = !S.showReq; return render();
    case "postreq": { const tg = tagsOf(val("r-tags")), tx = val("r-text"), minText = val("r-budgetMin"), maxText = val("r-budgetMax"), min = minText ? Number(minText) : undefined, max = maxText ? Number(maxText) : undefined; if (!tx || !tg.length) { S.err = "Describe the request and add a tag."; return render(); } if ((minText && (!Number.isFinite(Number(minText)) || Number(minText) < 0)) || (maxText && (!Number.isFinite(Number(maxText)) || Number(maxText) < 0)) || (min !== undefined && max !== undefined && min > max)) { S.err = "Enter a valid budget range (the minimum must not exceed the maximum)."; return render(); }
      reqs.unshift({ id: nid++, channel: val("r-chan"), text: tx, tags: tg, budgetMin: min, budgetMax: max, author: S.me, uni: S.uni.name }); persist(); S.showReq = false; return render(); }
    case "help": { const r = reqs.find(x => x.id === id) as Req; return openThread(`r${id}`, r.author, r.text, `Hi ${r.author.split(" ")[0]}, I can help with "${r.text}"!`), reply(`r${id}`); }
  }
}

document.addEventListener("click", e => { const el = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null; if (el && el.tagName !== "SELECT") act(el.dataset.a as string, el); });
document.addEventListener("change", e => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.a === "uni") return act("uni", el);
  if (el.dataset.f && el.files?.[0]) {
    const file = el.files[0], wantsVideo = el.dataset.f === "vid";
    if (wantsVideo ? !file.type.startsWith("video/") : !file.type.startsWith("image/")) {
      S.err = wantsVideo ? "Reels only accept video files." : "Photo posts only accept image files.";
      return render();
    }
    grabDraft();
    readFile(file, (url, isVideo) => { if (isVideo) { S.draft.video = url; S.draft.img = ""; } else { S.draft.img = url; S.draft.video = ""; } render(); });
  }
});
document.addEventListener("input", e => {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (S.page !== "compose" || !["d-title", "d-price", "d-desc", "d-tags", "d-tradeValue", "d-tradeFor"].includes(el.id)) return;
  const d = S.draft;
  if (el.id === "d-title") d.title = el.value;
  else if (el.id === "d-price") d.price = el.value;
  else if (el.id === "d-desc") d.desc = el.value;
  else if (el.id === "d-tags") d.tags = el.value;
  else if (el.id === "d-tradeValue") d.tradeValue = el.value;
  else d.tradeFor = el.value;
  const caption = document.querySelector("[data-preview-caption]"), price = document.querySelector("[data-preview-price]"), tags = document.querySelector("[data-preview-tags]"), trade = document.querySelector("[data-preview-trade]");
  if (price) price.textContent = `$${d.price}${d.acceptTrade ? " · Open to trade" : ""}`;
  if (caption) caption.textContent = listingCaption(d.title, d.price, d.desc);
  if (tags) tags.innerHTML = tagH(tagsOf(d.tags));
  if (trade) trade.innerHTML = d.acceptTrade ? `<span class="tag">Trade value ~$${esc(d.tradeValue || d.price)}${d.tradeFor ? ` · Wants ${esc(d.tradeFor)}` : ""}</span>` : "";
});
document.addEventListener("keydown", e => { if (e.key !== "Enter") return; const id = (e.target as HTMLElement).id;
  const m: Record<string, string> = { q: "search", rq: "req-search", msg: "send-msg", email: S.page === "login" ? "login" : "send", pw: "login", code: "verify", pw2: "setpw" };
  if (m[id]) act(m[id], e.target as HTMLElement); });

function render() {
  const s = document.documentElement.style, hex = S.uni.p.slice(1), rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), luminance = rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0); s.setProperty("--p", S.uni.p); s.setProperty("--a", S.uni.a); s.setProperty("--pt", luminance > .179 ? "#211a1b" : "#ffffff");
  const top = window.scrollY; root.innerHTML = view() + (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : "");
  const f = document.getElementById("feed");
  if (f && S.feedIdx >= 0) { f.scrollTop = S.feedIdx * f.clientHeight; S.feedIdx = -1; } else window.scrollTo(0, top);
}
render();
