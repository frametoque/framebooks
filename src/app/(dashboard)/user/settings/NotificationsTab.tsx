// src/app/(dashboard)/user/settings/NotificationsTab.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  Check,
  Info,
} from "lucide-react";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  requestPushPermission,
  getNotificationPermission,
  sendLocalPushNotification,
  isPushSupported,
  NotificationPreferences,
} from "@/lib/notifications/notificationManager";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_PRESETS = [
  { value: "09:00", label: "09:00 AM (Morning)" },
  { value: "13:00", label: "01:00 PM (Afternoon)" },
  { value: "18:00", label: "06:00 PM (End of Day)" },
  { value: "20:00", label: "08:00 PM (Evening)" },
];

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [testSent, setTestSent] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
    setPrefs(getNotificationPreferences());

    const handlePrefsChange = (e: Event) => {
      const custom = e as CustomEvent<NotificationPreferences>;
      if (custom.detail) {
        setPrefs(custom.detail);
      }
    };

    window.addEventListener("framebooks:notification-prefs-changed", handlePrefsChange);
    return () => {
      window.removeEventListener("framebooks:notification-prefs-changed", handlePrefsChange);
    };
  }, []);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleTogglePush = async () => {
    if (!isPushSupported()) {
      alert("Push notifications are not supported by your current browser.");
      return;
    }

    if (prefs.pushEnabled) {
      // Turn off
      const updated = saveNotificationPreferences({ pushEnabled: false });
      setPrefs(updated);
      showToast("Push notifications paused.");
    } else {
      // Turn on -> prompt for browser permission
      const res = await requestPushPermission();
      setPermission(res.permission);
      if (res.granted) {
        const updated = saveNotificationPreferences({ pushEnabled: true });
        setPrefs(updated);
        showToast("Push notifications enabled!");
        // Send welcome notification
        sendLocalPushNotification("Push Notifications Active", {
          body: "You will now receive transaction reminders and automated alerts from Framebooks.",
          url: "/user/settings/notifications",
          tag: "welcome-push",
        });
      } else if (res.permission === "denied") {
        const updated = saveNotificationPreferences({ pushEnabled: false });
        setPrefs(updated);
      }
    }
  };

  const handleUpdate = (updates: Partial<NotificationPreferences>) => {
    const updated = saveNotificationPreferences(updates);
    setPrefs(updated);
    showToast("Preferences saved.");
  };

  const handleSendTestNotification = async () => {
    if (permission !== "granted") {
      const res = await requestPushPermission();
      setPermission(res.permission);
      if (!res.granted) return;
    }

    const ok = await sendLocalPushNotification("Framebooks Test Alert", {
      body: "Browser push notifications are configured and functioning seamlessly!",
      url: "/user/settings/notifications",
      tag: "test-notification-" + Date.now(),
    });

    if (ok) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
      showToast("Test notification dispatched.");
    } else {
      alert("Unable to deliver notification. Please ensure browser permissions are allowed.");
    }
  };

  const supported = isPushSupported();

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-foreground text-background font-semibold text-xs shadow-xl animate-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-brand-500" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* 1. Master Push Notification Control */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-foreground">Browser Push Notifications</h3>
              {permission === "granted" && prefs.pushEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : permission === "denied" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-3 h-3" /> Blocked in Browser
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Permission Required
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            {prefs.pushEnabled && permission === "granted" && (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                title="Send a sample notification to your device"
              >
                <Send className="w-3.5 h-3.5 text-brand-500" />
                <span>{testSent ? "Dispatched!" : "Test Notification"}</span>
              </button>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={prefs.pushEnabled && permission === "granted"}
              disabled={!supported}
              onClick={handleTogglePush}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                prefs.pushEnabled && permission === "granted" ? "bg-brand-500" : "bg-muted"
              } ${!supported ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  prefs.pushEnabled && permission === "granted" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {permission === "denied" && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Notifications Blocked</span>
              <p className="leading-relaxed text-[11px]">
                Your browser is currently blocking notifications for Framebooks. Click the lock/settings icon in your browser URL bar, set Notifications to "Allow", and reload the page to activate.
              </p>
            </div>
          </div>
        )}

        {!supported && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>Web Push notifications are not supported in your current browser environment.</span>
          </div>
        )}
      </div>

      {/* 2. Transaction Logging Reminders */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Transaction Logging Reminders</h3>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.remindTransactions}
            onClick={() => handleUpdate({ remindTransactions: !prefs.remindTransactions })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.remindTransactions ? "bg-brand-500" : "bg-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                prefs.remindTransactions ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {prefs.remindTransactions && (
          <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Frequency Selection */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Reminder Frequency
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdate({ reminderFrequency: "daily" })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    prefs.reminderFrequency === "daily"
                      ? "border-brand-500 bg-brand-500/10 text-foreground ring-1 ring-brand-500"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ reminderFrequency: "weekly" })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    prefs.reminderFrequency === "weekly"
                      ? "border-brand-500 bg-brand-500/10 text-foreground ring-1 ring-brand-500"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Weekly Day of Week Picker */}
            {prefs.reminderFrequency === "weekly" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Day of the Week
                </label>
                <select
                  value={prefs.reminderDayOfWeek}
                  onChange={(e) => handleUpdate({ reminderDayOfWeek: parseInt(e.target.value, 10) })}
                  className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      Every {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reminder Time Picker */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Notification Time
              </label>
              <div className="space-y-2">
                <input
                  type="time"
                  value={prefs.reminderTime}
                  onChange={(e) => handleUpdate({ reminderTime: e.target.value })}
                  className="w-full px-3.5 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <div className="flex items-center gap-1 flex-wrap">
                  {TIME_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handleUpdate({ reminderTime: p.value })}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                        prefs.reminderTime === p.value
                          ? "border-brand-500 bg-brand-500/15 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {p.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Automated Scheduled Expense Logging Alerts */}
      <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Scheduled Recurring Expense Alerts</h3>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.notifyScheduledExpenses}
            onClick={() => handleUpdate({ notifyScheduledExpenses: !prefs.notifyScheduledExpenses })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.notifyScheduledExpenses ? "bg-brand-500" : "bg-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                prefs.notifyScheduledExpenses ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
