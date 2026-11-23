// src/lib/notifications/notificationManager.ts
"use client";

export interface NotificationPreferences {
  pushEnabled: boolean;
  remindTransactions: boolean;
  reminderFrequency: "daily" | "weekly";
  reminderDayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  reminderTime: string; // "18:00"
  notifyScheduledExpenses: boolean;
  lastReminderSentDate?: string; // YYYY-MM-DD
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  remindTransactions: true,
  reminderFrequency: "daily",
  reminderDayOfWeek: 5, // Friday
  reminderTime: "18:00",
  notifyScheduledExpenses: true,
};

const STORAGE_KEY = "framebooks_notification_prefs";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function saveNotificationPreferences(
  updates: Partial<NotificationPreferences>
): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const current = getNotificationPreferences();
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("framebooks:notification-prefs-changed", { detail: updated })
    );
    return updated;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function requestPushPermission(): Promise<{
  granted: boolean;
  permission: NotificationPermission | "unsupported";
}> {
  if (!isPushSupported()) {
    return { granted: false, permission: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    saveNotificationPreferences({ pushEnabled: granted });

    if (granted && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: "PUSH_ENABLED" });
      }).catch(() => {});
    }

    return { granted, permission };
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return { granted: false, permission: Notification.permission };
  }
}

export async function sendLocalPushNotification(
  title: string,
  options?: {
    body?: string;
    url?: string;
    tag?: string;
  }
): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") {
    return false;
  }

  const notifOptions = {
    body: options?.body || "",
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: options?.tag || "framebooks-alert",
    data: {
      url: options?.url || "/user/dashboard",
    },
  };

  try {
    // 1. Try via Service Worker if registered
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notifOptions);
          return true;
        }
      } catch {}
    }

    // 2. Fallback to Window Notification constructor
    const n = new Notification(title, notifOptions);
    n.onclick = () => {
      n.close();
      if (typeof window !== "undefined" && options?.url) {
        window.location.href = options.url;
      }
    };
    return true;
  } catch (e) {
    console.error("Failed to show browser notification:", e);
    return false;
  }
}

/**
 * Checks client-side reminder schedule without consuming server background tasks / Vercel CPU.
 */
export function checkAndTriggerReminders(): void {
  if (typeof window === "undefined") return;

  const prefs = getNotificationPreferences();
  if (!prefs.pushEnabled || !prefs.remindTransactions) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${date}`;

  // Check if reminder was already delivered today
  if (prefs.lastReminderSentDate === todayStr) {
    return;
  }

  // Parse target reminder time (HH:MM)
  const [targetHourStr, targetMinStr] = (prefs.reminderTime || "18:00").split(":");
  const targetHour = parseInt(targetHourStr || "18", 10);
  const targetMin = parseInt(targetMinStr || "00", 10);

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const isTimeReached =
    currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin);

  if (!isTimeReached) {
    return;
  }

  if (prefs.reminderFrequency === "daily") {
    sendLocalPushNotification("Reminder: Log Your Transactions", {
      body: "Take a moment to record today's income, expenses, and invoices in Framebooks.",
      url: "/user/expenses",
      tag: "transaction-reminder-daily",
    });
    saveNotificationPreferences({ lastReminderSentDate: todayStr });
  } else if (prefs.reminderFrequency === "weekly") {
    // Check day of week (0 = Sunday, 1 = Monday, ...)
    const dayOfWeek = now.getDay();
    if (dayOfWeek === prefs.reminderDayOfWeek) {
      sendLocalPushNotification("Weekly Financial Check-In", {
        body: "Time for your weekly bookkeeping. Keep all your transactions and balances balanced.",
        url: "/user/expenses",
        tag: "transaction-reminder-weekly",
      });
      saveNotificationPreferences({ lastReminderSentDate: todayStr });
    }
  }
}

/**
 * Notifies the user when scheduled recurring expenses are automatically logged.
 */
export function notifyScheduledExpenses(
  items: Array<{ title: string; amount: number }>
): void {
  if (!items || items.length === 0) return;

  const prefs = getNotificationPreferences();
  if (!prefs.pushEnabled || !prefs.notifyScheduledExpenses) return;
  if (Notification.permission !== "granted") return;

  if (items.length === 1) {
    const item = items[0];
    const amountStr = Number(item.amount).toLocaleString();
    sendLocalPushNotification("Scheduled Expense Logged", {
      body: `"${item.title}" (LKR ${amountStr}) was automatically recorded into expenses.`,
      url: "/user/expenses",
      tag: `scheduled-expense-${Date.now()}`,
    });
  } else {
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    const amountStr = total.toLocaleString();
    sendLocalPushNotification(`${items.length} Scheduled Expenses Logged`, {
      body: `Total LKR ${amountStr} across ${items.length} recurring schedules was automatically recorded.`,
      url: "/user/expenses",
      tag: `scheduled-expenses-${Date.now()}`,
    });
  }
}

/**
 * Checks for newly published broadcast push notifications from the admin dashboard.
 * Runs strictly client-side when the user has an active tab — ZERO Vercel background tasks or CPU.
 */
export async function checkAndTriggerAdminPushNotifications(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== "granted") {
    return;
  }

  const prefs = getNotificationPreferences();
  if (!prefs.pushEnabled) {
    return;
  }

  try {
    const { getPendingPushNotifications } = await import(
      "@/app/(dashboard)/admin/announcements/actions"
    );
    const pending = await getPendingPushNotifications();
    if (!pending || pending.length === 0) return;

    const storageKey = "framebooks:pushed_admin_announcements";
    let pushedIds: number[] = [];
    try {
      pushedIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      pushedIds = [];
    }

    for (const item of pending) {
      if (!pushedIds.includes(item.id)) {
        await sendLocalPushNotification(item.title, {
          body: item.body,
          url: item.link_url || "/user/dashboard",
          tag: `admin-push-${item.id}`,
        });
        pushedIds.push(item.id);
      }
    }

    if (pushedIds.length > 100) {
      pushedIds = pushedIds.slice(-100);
    }
    localStorage.setItem(storageKey, JSON.stringify(pushedIds));
  } catch (e) {
    console.warn("Failed checking admin push notifications:", e);
  }
}
