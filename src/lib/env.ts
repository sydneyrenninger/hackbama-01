import "server-only";
import { z } from "zod";

const schema = z.object({
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(20),
  supabaseSecretKey: z.string().min(20),
  gmailUser: z.string().email().optional(),
  gmailAppPassword: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().length(16, "GMAIL_APP_PASSWORD must be the 16-character app password"))
    .optional(),
  appUrl: z.string().url(),
  verificationPepper: z.string().min(32, "VERIFICATION_PEPPER must be at least 32 characters"),
  unknownDomainPolicy: z.enum(["provision_pending", "reject"]).default("provision_pending"),
});

let cached: z.infer<typeof schema> | null = null;

export function serverEnv() {
  if (cached) return cached;
  const parsed = schema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    gmailUser: process.env.GMAIL_USER || undefined,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
    verificationPepper: process.env.VERIFICATION_PEPPER,
    unknownDomainPolicy: process.env.UNKNOWN_DOMAIN_POLICY || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server configuration: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

export function emailConfigured(): boolean {
  const e = serverEnv();
  return Boolean(e.gmailUser && e.gmailAppPassword);
}