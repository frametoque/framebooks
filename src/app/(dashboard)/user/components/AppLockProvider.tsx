"use client";
import { Loader } from "@/components/ui/Loader";


import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { MdLockOutline, MdLockOpen } from "react-icons/md";
import { Loader2, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";

type AppLockContextType = {
  isLocked: boolean;
  hasAppLock: boolean;
  lock: () => void;
  unlock: () => void;
  autoLockDuration: number;
  setAutoLockDuration: (duration: number) => void;
  highSecurityMode: boolean;
  setHighSecurityMode: (enabled: boolean) => void;
  requireAuth: (callback: () => void | Promise<void>, isMajor?: boolean) => void;
};

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error("useAppLock must be used within an AppLockProvider");
  }
  return context;
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasAppLock, setHasAppLock] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState<number>(300000); // Default to 5 minutes
  const [highSecurityMode, setHighSecurityMode] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isChecking, setIsChecking] = useState(true);
  const [authCallback, setAuthCallback] = useState<(() => void | Promise<void>) | null>(null);
  const lastSavedActivity = useRef<number>(Date.now());

  // Sync highSecurityMode to localStorage
  const updateHighSecurityMode = (enabled: boolean) => {
    setHighSecurityMode(enabled);
    localStorage.setItem("app-lock-hsm", enabled ? "true" : "false");
  };

  // Load settings & check if user has passkey
  useEffect(() => {
    const init = async () => {
      // Load duration from localStorage
      let duration = 300000;
      const savedDuration = localStorage.getItem("app-lock-duration");
      if (savedDuration !== null) {
        const parsed = parseInt(savedDuration, 10);
        duration = isNaN(parsed) ? 300000 : parsed;
        setAutoLockDuration(duration);
      }
      
      const savedHsm = localStorage.getItem("app-lock-hsm");
      if (savedHsm) {
        setHighSecurityMode(savedHsm === "true");
      }

      // Check if user has passkeys
      try {
        const checkRes = await fetch("/api/auth/passkey/2fa/check");
        const data = await checkRes.json();
        if (data.hasPasskeys) {
          setHasAppLock(true);
          
          // Check previous session state
          const savedUnlocked = localStorage.getItem("app-lock-unlocked") === "true";
          const savedActivityStr = localStorage.getItem("app-lock-last-activity");
          const savedActivity = savedActivityStr ? parseInt(savedActivityStr, 10) : 0;
          
          // Only lock if we were previously locked, or if auto-lock duration has expired since last activity (when auto-lock is enabled)
          const isExpired = duration > 0 && (Date.now() - savedActivity > duration);
          if (!savedUnlocked || isExpired) {
            setIsLocked(true);
            localStorage.setItem("app-lock-unlocked", "false");
          } else {
            setIsLocked(false);
          }
        } else {
          setHasAppLock(false);
          setIsLocked(false);
          localStorage.removeItem("app-lock-unlocked");
        }
      } catch (e) {
        console.error("Failed to check app lock status", e);
      } finally {
        setIsChecking(false);
      }
    };
    init();
  }, []);

  // Save duration to localStorage when changed
  useEffect(() => {
    localStorage.setItem("app-lock-duration", autoLockDuration.toString());
  }, [autoLockDuration]);

  // Handle auto-lock based on inactivity
  useEffect(() => {
    if (!hasAppLock || isLocked || autoLockDuration === 0) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > autoLockDuration) {
        setIsLocked(true);
        localStorage.setItem("app-lock-unlocked", "false");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasAppLock, isLocked, autoLockDuration, lastActivity]);

  // Track activity
  useEffect(() => {
    const updateActivity = () => {
      const now = Date.now();
      setLastActivity(now);
      
      // Throttle localStorage writes to once every 2 seconds
      if (now - lastSavedActivity.current > 2000) {
        localStorage.setItem("app-lock-last-activity", now.toString());
        lastSavedActivity.current = now;
      }
    };
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, updateActivity, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, updateActivity));
  }, []);

  const lock = () => {
    setIsLocked(true);
    localStorage.setItem("app-lock-unlocked", "false");
  };
  const unlock = () => {
    setIsLocked(false);
    const now = Date.now();
    setLastActivity(now);
    lastSavedActivity.current = now;
    localStorage.setItem("app-lock-unlocked", "true");
    localStorage.setItem("app-lock-last-activity", now.toString());
  };

  const requireAuth = (callback: () => void | Promise<void>, isMajor = false) => {
    if (!hasAppLock) {
      callback();
    } else {
      if (highSecurityMode || isMajor) {
        setAuthCallback(() => callback);
      } else {
        callback();
      }
    }
  };

  return (
    <AppLockContext.Provider
      value={{
        isLocked: isLocked && hasAppLock && !isChecking,
        hasAppLock,
        lock,
        unlock,
        autoLockDuration,
        setAutoLockDuration: (duration: number) => {
          setAutoLockDuration(duration);
          localStorage.setItem("app-lock-duration", duration.toString());
        },
        highSecurityMode,
        setHighSecurityMode: updateHighSecurityMode,
        requireAuth
      }}
    >
      {children}
      {authCallback && (
        <PasskeyAuthModal 
          onSuccess={() => {
            if (authCallback) authCallback();
            setAuthCallback(null);
          }}
          onCancel={() => setAuthCallback(null)}
        />
      )}
    </AppLockContext.Provider>
  );
}

function PasskeyAuthModal({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authRes = await fetch("/api/auth/passkey/2fa/generate");
      const options = await authRes.json();
      if (options.error) throw new Error(options.error);

      const attResp = await startAuthentication(options);

      const verifyRes = await fetch("/api/auth/passkey/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });

      const verification = await verifyRes.json();
      if (verification.verified) {
        onSuccess();
      } else {
        setError(verification.error || "Verification failed");
      }
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "AbortError" || (e.message && e.message.includes("abort signal"))) {
        setError(""); // Ignore aborts gracefully
      } else {
        setError("Failed: " + (e.message || "Unknown error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    handleVerify();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
        <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center bg-brand-500/10 border border-brand-500/20">
          <MdLockOutline className="w-6 h-6 text-brand-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Authentication Required</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">This action requires you to verify your identity using your passkey.</p>

        {error && (
          <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center w-full">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-card border border-border hover:bg-black/5 dark:hover:bg-white/10 text-foreground rounded-xl font-semibold transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={submitting}
            className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {submitting ? <Loader size="sm" /> : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LockScreen() {
  const { unlock } = useAppLock();
  const [mode, setMode] = useState<"passkey" | "otp_request" | "otp_verify">("passkey");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // OTP recovery state
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleUnlock = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authRes = await fetch("/api/auth/passkey/2fa/generate");
      const options = await authRes.json();

      if (options.error) throw new Error(options.error);

      const attResp = await startAuthentication(options);

      const verifyRes = await fetch("/api/auth/passkey/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });

      const verification = await verifyRes.json();
      if (verification.verified) {
        setSuccess(true);
        setTimeout(() => {
          unlock();
        }, 800);
      } else {
        setError(verification.error || "Failed to verify passkey.");
      }
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "AbortError" || (e.message && e.message.includes("abort signal"))) {
        setError(""); // Ignore aborts gracefully
      } else {
        setError("Failed: " + (e.message || "Unknown error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/passkey/recovery/send-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }
      setMaskedEmail(data.maskedEmail || "your email");
      setMode("otp_verify");
      setResendCooldown(60);
    } catch (err: any) {
      setOtpError(err.message || "Failed to send verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/auth/passkey/recovery/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }
      setSuccess(true);
      setTimeout(() => {
        unlock();
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setOtpError(err.message || "Verification failed. Please check the code.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      <motion.div 
        className="w-24 h-24 bg-brand-500/10 rounded-full flex items-center justify-center mb-8 border border-brand-500/20 shadow-[0_0_40px_rgba(0,227,91,0.1)] relative"
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="unlocked"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <MdLockOpen className="w-10 h-10 text-brand-500" />
            </motion.div>
          ) : mode === "passkey" ? (
            <motion.div
              key="locked"
              exit={{ scale: 0, opacity: 0 }}
            >
              <MdLockOutline className="w-10 h-10 text-brand-500" />
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Mail className="w-10 h-10 text-brand-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* PASSKEY MODE */}
      {mode === "passkey" && (
        <>
          <h2 className="text-3xl font-bold text-foreground mb-3 text-center">Dashboard Locked</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-10 max-w-sm text-center leading-relaxed">
            App Lock is enabled. Please authenticate using your passkey to continue your session securely.
          </p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center max-w-sm w-full"
            >
              {error}
            </motion.div>
          )}

          <button
            onClick={handleUnlock}
            disabled={submitting}
            className="w-full max-w-sm h-14 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-500/20 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader size="sm" /> Verifying...
              </>
            ) : (
              "Unlock Dashboard"
            )}
          </button>

          <div className="flex flex-col items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setOtpError("");
                setMode("otp_request");
              }}
              className="text-xs text-gray-400 hover:text-brand-500 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Can't authenticate? Unlock via Email OTP
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-gray-500 hover:text-foreground transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {/* OTP REQUEST MODE */}
      {mode === "otp_request" && (
        <div className="max-w-sm w-full text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Verify Your Identity</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
            To securely bypass App Lock, we will send a 6-digit one-time verification code to your verified account email address.
          </p>

          {otpError && (
            <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {otpError}
            </div>
          )}

          <button
            onClick={handleSendOtp}
            disabled={otpLoading}
            className="w-full h-14 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-500/20 cursor-pointer mb-3"
          >
            {otpLoading ? (
              <>
                <Loader size="sm" /> Sending Code...
              </>
            ) : (
              "Send Verification Code"
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setOtpError("");
              setMode("passkey");
            }}
            className="text-xs text-gray-400 hover:text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto mt-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Passkey
          </button>
        </div>
      )}

      {/* OTP VERIFY MODE */}
      {mode === "otp_verify" && (
        <form onSubmit={handleVerifyOtp} className="max-w-sm w-full text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Enter Verification Code</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
            We sent a 6-digit code to <strong className="text-foreground">{maskedEmail}</strong>. Enter it below to unlock your dashboard.
          </p>

          {otpError && (
            <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {otpError}
            </div>
          )}

          <div className="mb-6">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full h-16 text-center font-mono text-3xl tracking-[0.5em] rounded-2xl bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-foreground transition-all shadow-2xs"
            />
          </div>

          <button
            type="submit"
            disabled={otpLoading || otpCode.length !== 6}
            className="w-full h-14 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-500/20 cursor-pointer mb-3"
          >
            {otpLoading ? (
              <>
                <Loader size="sm" /> Verifying...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-5 h-5" /> Verified!
              </>
            ) : (
              "Verify & Unlock Dashboard"
            )}
          </button>

          <div className="flex items-center justify-between mt-4 px-2">
            <button
              type="button"
              onClick={() => {
                setOtpError("");
                setMode("passkey");
              }}
              className="text-xs text-gray-400 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {resendCooldown > 0 ? (
              <span className="text-xs text-gray-500">Resend code in {resendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpLoading}
                className="text-xs text-brand-500 hover:underline cursor-pointer"
              >
                Resend Code
              </button>
            )}
          </div>
        </form>
      )}
    </motion.div>
  );
}
