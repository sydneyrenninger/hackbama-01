import "server-only";
import { Resend } from "resend";
import { emailConfigured, serverEnv } from "@/lib/env";

type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "provider_error" };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, reason: "not_configured" };
  const env = serverEnv();
  try {
    const { error } = await new Resend(env.resendApiKey).emails.send({ from: env.emailFrom!, to, subject, html, text });
    if (error) {
      console.error("[email] provider rejected message", error.name);
      return { ok: false, reason: "provider_error" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] provider request failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, reason: "provider_error" };
  }
}

export function sendVerificationCode(to: string, code: string, campusName: string | null) {
  const where = campusName ? ` for ${escape(campusName)}` : "";
  return send(
    to,
    `${code} is your Quad Exchange code`,
    `<div style="font-family:system-ui,sans-serif;max-width:480px">
       <p>Your verification code${where}:</p>
       <p style="font-size:32px;letter-spacing:8px;font-weight:700">${code}</p>
       <p>It expires in 10 minutes. If you didn't ask for this, ignore this email.</p>
     </div>`,
    `Your Quad Exchange verification code${campusName ? ` for ${campusName}` : ""}: ${code}\nIt expires in 10 minutes.`,
  );
}

export function sendPasswordReset(to: string, link: string) {
  return send(
    to,
    "Reset your Quad Exchange password",
    `<div style="font-family:system-ui,sans-serif;max-width:480px">
       <p>Use this link to choose a new password. It expires soon and works once.</p>
       <p><a href="${escape(link)}">Reset password</a></p>
       <p>If you didn't ask for this, ignore this email.</p>
     </div>`,
    `Reset your password: ${link}\nIf you didn't ask for this, ignore this email.`,
  );
}
