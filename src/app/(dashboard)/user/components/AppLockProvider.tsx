"use client";
import { Loader } from "@/components/ui/Loader";


import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { MdLockOutline, MdLockOpen } from "react-icons/md";
import { Loader2 } from "lucide-react";

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
      if (savedDuration) {
        const parsed = parseInt(savedDuration, 10);
        duration = parsed === 0 ? 300000 : parsed;
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
          
          // Only lock if we were previously locked, or if the auto-lock duration has expired since last activity
          if (!savedUnlocked || (Date.now() - savedActivity > duration)) {
            setIsLocked(true);
            localStorage.setItem("app-lock-unlocked", "false");
          } else {
            setIsLocked(false);
          }
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
      <div className="bg-[#111] border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
        <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center bg-brand-500/10 border border-brand-500/20">
          <MdLockOutline className="w-6 h-6 text-brand-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Authentication Required</h3>
        <p className="text-gray-400 text-sm mb-6">This action requires you to verify your identity using your passkey.</p>

        {error && (
          <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center w-full">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-foreground rounded-xl font-semibold transition-colors"
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

import { motion, AnimatePresence } from 'framer-motion';

export function LockScreen() {
  const { unlock } = useAppLock();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex-1 flex flex-col items-center justify-center min-h-[60vh]"
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
          ) : (
            <motion.div
              key="locked"
              exit={{ scale: 0, opacity: 0 }}
            >
              <MdLockOutline className="w-10 h-10 text-brand-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <h2 className="text-3xl font-bold text-foreground mb-3 text-center">Dashboard Locked</h2>
      <p className="text-gray-400 mb-10 max-w-sm text-center leading-relaxed">
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
        className="w-full max-w-sm h-14 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-500/20"
      >
        {submitting ? (
          <>
            <Loader size="sm" /> Verifying...
          </>
        ) : (
          "Unlock Dashboard"
        )}
      </button>
    </motion.div>
  );
}
