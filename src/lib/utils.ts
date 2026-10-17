import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatPrice(cents: number | null | undefined, kind?: string) {
  if (kind === "free") return "Free";
  if (kind === "trade") return "Trade";
  if (kind === "borrow") return "Borrow";
  if (cents == null) return kind === "service" ? "Ask" : "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
