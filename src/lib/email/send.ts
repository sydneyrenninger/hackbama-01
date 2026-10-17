import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { emailConfigured, serverEnv } from "@/lib/env";

type SendResult = { ok: true } | { ok: false; reason: "not_configured" | "provider_error" };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

let transporter: Transporter | null = null;
function transport(): Transporter {
  if (!transporter) {
    const env = serverEnv();
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: env.gmailUser, pass: env.gmailAppPassword },
    });
  }
  return transporter;
}

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, reason: "not_configured" };
  try {
    await transport().sendMail({ from: `"Bama Buy" <${serverEnv().gmailUser}>`, to, subject, html, text });
    return { ok: true };
  } catch (e) {
    // Log the error code only; never the code being sent or credentials.
    console.error("[email] SMTP send failed", (e as { code?: string })?.code ?? "unknown");
    return { ok: false, reason: "provider_error" };
  }
}

export function sendVerificationCode(to: string, code: string, campusName: string | null) {
  const where = campusName ? ` for ${escape(campusName)}` : "";
  return send(
    to,
    `${code} is your Bama Buy code`,
    `<div style="font-family:system-ui,sans-serif;max-width:480px">
       <p>Your verification code${where}:</p>
       <p style="font-size:32px;letter-spacing:8px;font-weight:700">${code}</p>
       <p>It expires in 10 minutes. If you didn't ask for this, ignore this email.</p>
     </div>`,
    `Your Bama Buy verification code${campusName ? ` for ${campusName}` : ""}: ${code}\nIt expires in 10 minutes.`,
  );
}

export function sendPasswordReset(to: string, link: string) {
  return send(
    to,
    "Reset your Bama Buy password",
    `<div style="font-family:system-ui,sans-serif;max-width:480px">
       <p>Use this link to choose a new password. It expires soon and works once.</p>
       <p><a href="${escape(link)}">Reset password</a></p>
       <p>If you didn't ask for this, ignore this email.</p>
     </div>`,
    `Reset your password: ${link}\nIf you didn't ask for this, ignore this email.`,
  );
}