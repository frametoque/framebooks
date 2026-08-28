"use client";
import { Loader } from "@/components/ui/Loader";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FcGoogle } from "react-icons/fc";

const protectImage = (e: any) => e.preventDefault();

export default function CustomLogin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [errorMsg, setErrorMsg] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) setErrorMsg(decodeURIComponent(error));
  }, [searchParams]);

  useEffect(() => {
    if (status === "authenticated") {
      const checkAndRedirect = async () => {
        try {
          const response = await fetch("/api/auth/check-role");
          const data = await response.json();
          const redirectPath = data.isNewUser ? "/onboarding" : (data.isAdmin ? "/admin" : "/user/dashboard");
          router.replace(redirectPath);
        } catch (err: any) {
          if (err.name === 'TypeError' || err.message === 'Failed to fetch') return;
          router.replace("/user/dashboard");
        }
      };
      checkAndRedirect();
    }
  }, [status, router]);

  async function handleSocialSignIn() {
    if (loadingProvider) return;
    setLoadingProvider("google");
    setErrorMsg("");
    try {
      await signIn("google", { callbackUrl: "/user/dashboard" });
    } catch (err: any) {
      console.error("SignIn Error:", err);
      setErrorMsg("Failed to sign in with Google.");
      setLoadingProvider(null);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-slate-400 text-sm mt-4">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-black flex">
        {/* ── LEFT PANEL ── */}
        <div className="relative flex flex-col justify-center w-full lg:w-1/2 px-8 sm:px-16 py-16">
          <div className="relative z-10 max-w-sm w-full mx-auto">
            <Link href="/" className="inline-block mb-12">
              <Image
                src="/logos/ft/name-logo.png"
                alt="FrameBooks"
                width={160}
                height={32}
                className="h-8 w-auto opacity-90 hover:opacity-100 transition-opacity"
                onContextMenu={protectImage}
                onDragStart={protectImage}
              />
            </Link>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
              <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                Welcome{" "}
              </span>
              <span className="bg-gradient-to-b from-brand-400 to-brand-600 bg-clip-text text-transparent">
                Back.
              </span>
            </h1>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Sign in to FrameBooks to continue to your dashboard.
            </p>

            {/* Messages */}
            {errorMsg && (
              <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSocialSignIn}
              disabled={!!loadingProvider}
              className="w-full h-12 rounded-2xl bg-slate-900 border border-slate-800
                         hover:bg-slate-800 hover:border-brand-500/40
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-3 transition-all"
            >
              {loadingProvider === "google"
                ? <Loader size="sm" />
                : <FcGoogle size={20} />}
              <span className="text-slate-300 font-medium text-sm">Continue with Google</span>
            </button>

            <p className="mt-8 text-center text-xs text-slate-600 leading-relaxed">
              By continuing you agree to our{" "}
              <Link href="/terms" className="text-brand-500 hover:text-brand-400 transition-colors">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-brand-500 hover:text-brand-400 transition-colors">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
          <Image
            src="/login-cover.jpg"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 to-transparent" />
        </div>
      </div>
    </>
  );
}