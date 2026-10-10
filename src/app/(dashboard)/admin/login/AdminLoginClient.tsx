"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function AdminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || "/admin";
  const callbackUrl =
    !rawCallback || rawCallback.includes("/admin/login") ? "/admin" : rawCallback;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const timeoutTimer = setTimeout(() => {
      setLoading(false);
      setError("Request timed out. Please check your network and try again.");
    }, 12000);

    try {
      const res = await signIn("admin-credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      clearTimeout(timeoutTimer);

      if (!res) {
        setError("No response from server. Please try again.");
        setLoading(false);
        return;
      }

      if (res.error) {
        setError("Invalid email or password.");
        setLoading(false);
      } else if (res.ok) {
        window.location.replace(callbackUrl);
      } else {
        setError("Sign in failed. Please verify credentials.");
        setLoading(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      setError(err?.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-background flex">
      {/* ── LEFT PANEL ── */}
      <div className="relative flex flex-col justify-center w-full lg:w-1/2 px-8 sm:px-16 py-16">
        <div className="relative z-10 max-w-sm w-full mx-auto">
          <Link href="/" className="inline-block mb-12">
            <span className="text-2xl font-black tracking-tight text-[#082830] dark:text-foreground">
              Framebooks
            </span>
          </Link>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-[#082830] dark:text-foreground">
            Welcome Back<span className="text-[#00E35B]">.</span>
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground text-sm mb-8 leading-relaxed">
            Sign in to FrameBooks admin portal to continue.
          </p>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {error}
            </div>
          )}

          {/* Form: Email & Password */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="w-full h-12 px-4 rounded-2xl bg-white dark:bg-card border border-[#E5E7EB] dark:border-border text-foreground text-sm outline-none focus:border-[#00E35B] focus:ring-1 focus:ring-[#00E35B] transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-11 rounded-2xl bg-white dark:bg-card border border-[#E5E7EB] dark:border-border text-foreground text-sm outline-none focus:border-[#00E35B] focus:ring-1 focus:ring-[#00E35B] transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 !mt-6 rounded-2xl bg-[#00E35B] hover:bg-[#00c750] text-[#082830] font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Admin Portal &bull; End-to-end encrypted
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-white dark:bg-card/50 border-l border-[#E5E7EB] dark:border-border items-center justify-center">
        <div className="max-w-md text-center p-12">
          <div className="w-16 h-16 bg-[#E6FDF0] dark:bg-brand-500/15 text-[#00C750] dark:text-brand-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-brand-500/20">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-[#082830] dark:text-foreground mb-4">
            Everything your finances need<span className="text-[#00E35B]">.</span>
          </h2>
          <p className="text-gray-500 dark:text-muted-foreground leading-relaxed">
            Manage invoices, expenses, quotations, and track your business growth all in one beautiful dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
