import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. Supports both the current Supabase key names
 * (publishable / secret) and the legacy names (anon / service_role).
 */
const schema = z.object({
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(20),
  supabaseSecretKey: z.string().min(20),
  resendApiKey: z.string().min(10).optional(),
  emailFrom: z.string().min(3).optional(),
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
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    emailFrom: process.env.EMAIL_FROM || undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
    verificationPepper: process.env.VERIFICATION_PEPPER,
    unknownDomainPolicy: process.env.UNKNOWN_DOMAIN_POLICY || undefined,
  });
  if (!parsed.success) {
    // Names only; never values.
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server configuration: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

export function emailConfigured(): boolean {
  const e = serverEnv();
  return Boolean(e.resendApiKey && e.emailFrom);
}
