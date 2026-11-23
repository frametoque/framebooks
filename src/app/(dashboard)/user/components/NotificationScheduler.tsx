// src/app/(dashboard)/user/components/NotificationScheduler.tsx
"use client";

import { useEffect, useRef } from "react";
import {
  checkAndTriggerReminders,
  notifyScheduledExpenses,
  checkAndTriggerAdminPushNotifications,
} from "@/lib/notifications/notificationManager";
import { checkAndProcessRecurringExpenses } from "@/app/(dashboard)/user/actions/actions";

/**
 * Lightweight client-side notification scheduler.
 * Runs in the user's browser while active — ZERO Vercel background tasks or CPU consumption.
 */
export function NotificationScheduler() {
  const processedRef = useRef(false);

  useEffect(() => {
    // 1. Ensure Service Worker is registered for Web Push and Click actions
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for worker updates
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("Service worker registration error:", err);
        });
    }

    // 2. Client-side reminder check
    const runReminderCheck = () => {
      checkAndTriggerReminders();
    };

    // 3. Check for newly logged recurring expenses once per active session
    const runScheduledExpenseCheck = async () => {
      if (processedRef.current) return;
      processedRef.current = true;
      try {
        const logged = await checkAndProcessRecurringExpenses();
        if (logged && logged.length > 0) {
          notifyScheduledExpenses(logged);
        }
      } catch (err) {
        console.warn("Error checking recurring expenses:", err);
      }
    };

    // 4. Check for newly published broadcast push notifications from admin
    const runAdminPushCheck = () => {
      checkAndTriggerAdminPushNotifications().catch(() => {});
    };

    // Initial check on page load
    runReminderCheck();
    runScheduledExpenseCheck();
    runAdminPushCheck();

    // Re-check when user switches back to the active tab (zero continuous timer)
    const handleVisibility = () => {
      if (!document.hidden) {
        runReminderCheck();
        runAdminPushCheck();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
