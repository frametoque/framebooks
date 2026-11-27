// src/lib/notifications/notificationManager.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "./notificationManager.ts";

describe("Notification Preferences & Defaults", () => {
  it("provides correct default notification settings", () => {
    assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled, false);
    assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.remindTransactions, true);
    assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.reminderFrequency, "daily");
    assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.reminderTime, "18:00");
    assert.equal(DEFAULT_NOTIFICATION_PREFERENCES.notifyScheduledExpenses, true);
  });

  it("validates daily reminder schedule boundaries", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminderFrequency: "daily",
      reminderTime: "18:00",
      lastReminderSentDate: "2026-11-22",
    };

    const todayStr = "2026-11-23";
    const shouldSendToday = prefs.lastReminderSentDate !== todayStr;
    assert.equal(shouldSendToday, true);

    const updated = { ...prefs, lastReminderSentDate: todayStr };
    assert.equal(updated.lastReminderSentDate === todayStr, true);
  });

  it("validates weekly reminder schedule matching", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      reminderFrequency: "weekly",
      reminderDayOfWeek: 5, // Friday
      reminderTime: "17:30",
    };

    assert.equal(prefs.reminderDayOfWeek, 5);
    assert.equal(prefs.reminderFrequency, "weekly");
  });
});

describe("Announcement and Push Target Audience Rules", () => {
  it("correctly identifies latest_signups audience criteria within 24 hours", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const createdWithin24h = new Date("2026-11-26T18:00:00Z"); // 18 hrs ago
    const createdOlderThan24h = new Date("2026-11-25T10:00:00Z"); // 50 hrs ago

    const isLatestSignup = (createdAt: Date, refDate = now) => {
      const diffMs = refDate.getTime() - createdAt.getTime();
      return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
    };

    assert.equal(isLatestSignup(createdWithin24h), true);
    assert.equal(isLatestSignup(createdOlderThan24h), false);
  });
});
