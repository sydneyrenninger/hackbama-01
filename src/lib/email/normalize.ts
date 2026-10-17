export type EduEmail =
  | { ok: true; email: string; canonical: string; domain: string }
  | { ok: false; reason: "invalid" | "not_edu" };

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/;

/**
 * Lowercases and validates an address, requiring a .edu domain.
 * `canonical` strips +tags so one mailbox cannot farm rate limits.
 */
export function normalizeEduEmail(input: string): EduEmail {
  const email = input.normalize("NFKC").trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return { ok: false, reason: "invalid" };
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return { ok: false, reason: "invalid" };

  const local = email.slice(0, at);
  const domain = email.slice(at + 1).replace(/\.$/, "");
  if (!LOCAL.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, reason: "invalid" };
  }
  const labels = domain.split(".");
  if (labels.length < 2 || domain.length > 253 || !labels.every((l) => LABEL.test(l))) {
    return { ok: false, reason: "invalid" };
  }
  if (labels[labels.length - 1] !== "edu") return { ok: false, reason: "not_edu" };

  const base = local.split("+")[0] || local;
  return { ok: true, email: `${local}@${domain}`, canonical: `${base}@${domain}`, domain };
}

/** "mail.cs.ua.edu" -> ["mail.cs.ua.edu", "cs.ua.edu", "ua.edu"] (mirrors the SQL resolver). */
export function domainCandidates(domain: string): string[] {
  const labels = domain.toLowerCase().split(".");
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join("."));
  return out;
}

export function registrableEduDomain(domain: string): string {
  return domain.toLowerCase().split(".").slice(-2).join(".");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your email";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
