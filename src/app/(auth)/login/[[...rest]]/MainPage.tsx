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
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-gray-500 font-medium text-sm mt-4">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#F9FAFB] flex">
        {/* ── LEFT PANEL ── */}
        <div className="relative flex flex-col justify-center w-full lg:w-1/2 px-8 sm:px-16 py-16">
          <div className="relative z-10 max-w-sm w-full mx-auto">
            <Link href="/" className="inline-block mb-12">
              <span className="text-2xl font-black tracking-tight text-[#082830]">Framebooks</span>
            </Link>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-[#082830]">
              Welcome Back<span className="text-[#00E35B]">.</span>
            </h1>
            <p className="text-gray-600 text-sm mb-8 leading-relaxed">
              Sign in to FrameBooks to continue to your dashboard.
            </p>

            {/* Messages */}
            {errorMsg && (
              <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSocialSignIn}
              disabled={!!loadingProvider}
              className="w-full h-12 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm
                         hover:bg-gray-50 hover:border-gray-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-3 transition-all text-[#082830]"
            >
              {loadingProvider === "google"
                ? <Loader size="sm" />
                : <FcGoogle size={20} />}
              <span className="font-bold text-sm">Continue with Google</span>
            </button>

            <p className="mt-8 text-center text-xs text-gray-500 leading-relaxed">
              By continuing you agree to our{" "}
              <Link href="/terms" className="text-[#00C750] hover:underline">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-[#00C750] hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-1/2 relative bg-white border-l border-[#E5E7EB] items-center justify-center">
           <div className="max-w-md text-center p-12">
              <div className="w-16 h-16 bg-[#E6FDF0] text-[#00C750] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-3xl font-black text-[#082830] mb-4">Everything your finances need<span className="text-[#00E35B]">.</span></h2>
              <p className="text-gray-500 leading-relaxed">Manage invoices, expenses, quotations, and track your business growth all in one beautiful dashboard.</p>
           </div>
        </div>
      </div>
    </>
  );
}