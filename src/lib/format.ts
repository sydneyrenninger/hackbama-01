// Display helpers shared by pages. Prices: formatPrice in @/lib/utils.

/** "just now", "5m", "3h", "2d", then a short date. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "10:42 AM" for chat bubbles. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatBudget(cents: number | null | undefined): string {
  if (cents == null) return "Flexible budget";
  const fraction = cents % 100 ? 2 : 0;
  return `Budget $${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: fraction, maximumFractionDigits: fraction })}`;
}

/** "$12.50" -> 1250. Empty/invalid -> null. */
export function dollarsToCents(value: FormDataEntryValue | string | null | undefined): number | null {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return String(value ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** "Maya Brooks" -> "MB". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Space-, comma- or #-separated tag input -> ["ece", "weekend"] (server normalizes again). */
export function splitTags(input: string): string[] {
  return input.split(/[\s,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}
