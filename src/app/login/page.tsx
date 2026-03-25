"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, ArrowRight, Loader2 } from "lucide-react";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      setError("Email not found. Please contact your administrator.");
      return;
    }
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError("Invalid or expired code. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] px-4">
      {/* Logo / Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
          <svg viewBox="0 0 40 40" className="w-9 h-9 fill-white">
            <rect x="4" y="8" width="22" height="3" rx="1.5" />
            <rect x="4" y="14" width="16" height="3" rx="1.5" />
            <rect x="4" y="20" width="20" height="3" rx="1.5" />
            <circle cx="30" cy="28" r="8" fill="none" stroke="white" strokeWidth="3" />
            <path d="M27 28l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">EffortLog</h1>
        <p className="text-blue-200 text-sm mt-1">Time &amp; Effort Reporting</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {step === "email" ? (
          <form onSubmit={sendOtp} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Sign In</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your work email to receive a 6-digit code.
              </p>
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Send Code <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Check your email</h2>
              <p className="text-sm text-slate-500 mt-1">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-slate-700">{email}</span>
              </p>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Verify &amp; Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
              }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-blue-200/60 text-xs">
        © {new Date().getFullYear()} EffortLog · Federal Grant Compliance
      </p>
    </div>
  );
}
