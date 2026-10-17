/**
 * Creates clearly-labelled demo users and marketplace data through the
 * documented Supabase Admin API (no direct auth.users inserts).
 *
 *   npm run seed:demo -- --yes
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY),
 *           DEMO_USER_PASSWORD (never hardcoded). Refuses to run without --yes.
 */
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--yes")) {
  console.error("Refusing to seed without --yes. This writes demo users and listings to the configured project.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD;
if (!url || !key || !password || password.length < 10) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, secret key, or DEMO_USER_PASSWORD (10+ chars).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const UA = "a1000000-0000-4000-8000-000000000001";
const RB = "a1000000-0000-4000-8000-000000000002";

const people = [
  { email: "qx-demo-alex@crimson.ua.edu", name: "Alex (demo)" },
  { email: "qx-demo-blair@crimson.ua.edu", name: "Blair (demo)" },
  { email: "qx-demo-casey@demo-riverbend.edu", name: "Casey (demo)" },
  { email: "qx-demo-devon@demo-riverbend.edu", name: "Devon (demo)" },
];

async function ensureUser(email: string, name: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: password!, email_confirm: true, user_metadata: { display_name: name, demo: true } });
  if (data?.user) return data.user.id;
  if ((error as { code?: string })?.code !== "email_exists") throw error;
  for (let page = 1; page < 50; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = list?.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (!list || list.users.length < 200) break;
  }
  throw new Error(`could not find existing user ${email}`);
}

const ids: Record<string, string> = {};
for (const p of people) {
  ids[p.name] = await ensureUser(p.email, p.name);
  const { error } = await admin.rpc("provision_account", { p_user_id: ids[p.name], p_display_name: p.name });
  if (error) throw error;
}
const [alex, blair, casey, devon] = people.map((p) => ids[p.name]);

const L = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`;
const listings = [
  // Three-way cycle across campuses: Alex(textbooks→lab) · Blair(lab→electronics) · Casey(electronics→textbooks)
  { id: L(1), tags: ["chemistry","ch-231"], tenant_id: UA, seller_id: alex,  title: "Organic Chemistry (Klein, 4e)", category: "textbooks", kind: "trade", trade_wants_categories: ["lab"], trade_wants_text: "goggles lab coat", condition: "good", semester_moments: ["semester_start"] },
  { id: L(2), tags: ["lab","goggles"], tenant_id: UA, seller_id: blair, title: "Lab goggles + size M lab coat", category: "lab", kind: "trade", trade_wants_categories: ["electronics"], trade_wants_text: "graphing calculator", condition: "like_new", semester_moments: ["semester_start"] },
  { id: L(3), tags: ["calculator","ti-84"], tenant_id: RB, seller_id: casey, title: "TI-84 Plus graphing calculator", category: "electronics", kind: "trade", trade_wants_categories: ["textbooks"], trade_wants_text: "chemistry textbook", condition: "good", semester_moments: ["finals"] },
  // Direct swap: Devon ↔ Alex
  { id: L(4), tags: ["lamp","dorm"], tenant_id: RB, seller_id: devon, title: "Desk lamp with USB port", category: "dorm", kind: "trade", trade_wants_categories: ["textbooks"], condition: "good", semester_moments: ["move_in"] },
  { id: L(5), tags: ["psychology","psy-101"], tenant_id: UA, seller_id: alex,  title: "Intro Psych textbook", category: "textbooks", kind: "trade", trade_wants_categories: ["dorm"], condition: "fair", semester_moments: ["move_in"] },
  // Semester-aware sale items
  { id: L(6), tags: ["fridge","dorm"], tenant_id: UA, seller_id: blair, title: "Mini fridge, pickup at move-out", category: "dorm", kind: "sale", price_cents: 6000, condition: "good", semester_moments: ["move_out", "move_in"], available_from: "2026-12-11", available_until: "2027-01-20", pickup_notes: "Ridgecrest lobby, evenings" },
  { id: L(7), tags: ["calculus","tutoring"], tenant_id: UA, seller_id: alex,  title: "Calc II tutoring before finals", category: "tutoring", kind: "service", price_cents: 2000, semester_moments: ["finals", "midterms"] },
  { id: L(8), tags: ["airport","rides"], tenant_id: RB, seller_id: casey, title: "Ride to the airport, Dec 18", category: "rides", kind: "service", price_cents: 1500, semester_moments: ["move_out"] },
  { id: L(9), tags: ["free","dorm"], tenant_id: RB, seller_id: devon, title: "Free shower caddy", category: "dorm", kind: "free", semester_moments: ["move_in"] },
];
const { error: le } = await admin.from("listings").upsert(listings, { onConflict: "id", ignoreDuplicates: true });
if (le) throw le;

const { error: re } = await admin.from("requests").upsert([
  { id: "cccccccc-0000-4000-8000-000000000001", tenant_id: UA, requester_id: blair, title: "Need a chemistry textbook", category: "textbooks", channel_id: "dddddddd-0000-4000-8000-000000000004", tags: ["chemistry"], budget_cents: 4000, visibility: "network" },
  { id: "cccccccc-0000-4000-8000-000000000002", tenant_id: RB, requester_id: devon, title: "Looking for a mini fridge for spring", category: "dorm", channel_id: "dddddddd-0000-4000-8000-000000000005", tags: ["fridge"], budget_cents: 7000, visibility: "network", needed_by: "2027-01-15" },
], { onConflict: "id", ignoreDuplicates: true });
if (re) throw re;

console.log("Demo data ready. Sign in as any qx-demo-* user with DEMO_USER_PASSWORD.");
