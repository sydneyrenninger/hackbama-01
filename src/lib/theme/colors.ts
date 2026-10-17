export type TenantTheme = { primary_color: string; secondary_color: string };

const HEX = /^#([0-9a-f]{6})$/i;

export function hexToRgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  if (!m) throw new Error("invalid_hex");
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = "#14161B";
export const WHITE = "#FFFFFF";

export function readableOn(bg: string): string {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}

export function mix(hex: string, withHex: string, amount: number): string {
  const a = hexToRgb(hex), b = hexToRgb(withHex);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** CSS custom properties consumed by globals.css / shadcn tokens. */
export function themeVars(t: TenantTheme): Record<string, string> {
  const primary = HEX.test(t.primary_color) ? t.primary_color : "#2F5D8A";
  const secondary = HEX.test(t.secondary_color) ? t.secondary_color : "#5B6B7A";
  return {
    "--campus": primary,
    "--campus-foreground": readableOn(primary),
    "--campus-soft": mix(primary, WHITE, 0.9),
    "--campus-strong": mix(primary, INK, 0.25),
    "--campus-accent": secondary,
    "--campus-accent-foreground": readableOn(secondary),
  };
}
