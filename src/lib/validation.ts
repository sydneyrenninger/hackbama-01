import { z } from "zod";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // Supabase Auth bcrypt limit (bytes).

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .refine((p) => new TextEncoder().encode(p).length <= PASSWORD_MAX, "Use 72 bytes or fewer")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Include at least one letter and one number");

export const emailBody = z.object({ email: z.string().max(320) });
export const codeBody = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export const completeBody = z
  .object({
    displayName: z.string().trim().min(2, "Use at least 2 characters").max(40),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

// One-step signup (no email code) used by POST /api/auth/signup.
export const signupBody = z
  .object({
    email: z.string().max(320),
    displayName: z.string().trim().min(2, "Use at least 2 characters").max(40),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export const signInBody = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

export const newPasswordBody = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

const uuid = z.string().uuid();
const category = z.enum(["textbooks", "dorm", "lab", "tickets", "tutoring", "rides", "electronics", "furniture", "clothing", "other"]);
const moment = z.enum(["move_in", "semester_start", "midterms", "finals", "move_out", "anytime"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listingInput = z
  .object({
    tenantId: uuid.optional(),
    title: z.string().trim().min(3).max(90),
    description: z.string().trim().max(4000).default(""),
    category,
    kind: z.enum(["sale", "free", "trade", "borrow", "service"]),
    priceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
    condition: z.enum(["new", "like_new", "good", "fair", "worn"]).nullable().optional(),
    availableFrom: isoDate.nullable().optional(),
    availableUntil: isoDate.nullable().optional(),
    pickupNotes: z.string().trim().max(280).nullable().optional(),
    semesterMoments: z.array(moment).max(6).default([]),
    tradeWantsCategories: z.array(category).max(5).default([]),
    tradeWantsText: z.string().trim().max(280).nullable().optional(),
  })
  .refine((v) => v.kind !== "sale" || (v.priceCents ?? 0) > 0, { message: "Add a price", path: ["priceCents"] })
  .refine((v) => v.kind !== "trade" || v.tradeWantsCategories.length > 0, {
    message: "Pick at least one category you'd trade for", path: ["tradeWantsCategories"],
  });

export const requestInput = z.object({
  tenantId: uuid.optional(),
  title: z.string().trim().min(3).max(90),
  description: z.string().trim().max(2000).default(""),
  category,
  budgetCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  visibility: z.enum(["campus", "network"]).default("campus"),
  neededBy: isoDate.nullable().optional(),
});

export const ids = { uuid };
export const swipeInput = z.object({
  listingId: uuid, action: z.enum(["pass", "save", "interest"]), message: z.string().trim().max(1000).optional(),
});
export const messageInput = z.object({ conversationId: uuid, body: z.string().trim().min(1).max(4000) });
export const browseInput = z.object({
  scope: z.enum(["home", "memberships", "network", "custom"]),
  tenantIds: z.array(uuid).max(25).default([]),
  activeTenantId: uuid.nullable().optional(),
});
