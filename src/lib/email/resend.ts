import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@effortlog.app";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://effortlog.vercel.app";
