import { Resend } from "resend";

// Lazy initialization — only creates the client when first used at runtime,
// not during the Next.js build phase when env vars are unavailable.
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const FROM =
  process.env.RESEND_FROM_EMAIL ?? "noreply@effortlog.app";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://effortlog.vercel.app";
