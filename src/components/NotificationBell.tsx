// src/components/NotificationBell.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Bell, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  ExternalLink,
  Check,
  X
} from "lucide-react";
import Link from "next/link";
import { getUserNotifications, dismissAnnouncement } from "@/app/(dashboard)/admin/announcements/actions";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await getUserNotifications();
      setItems(res || []);
    } catch {
      // Ignore network errors on background poll
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const handleMarkRead = async (id: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    );
    await dismissAnnouncement(id);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case "critical":
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Info className="w-3.5 h-3.5 text-sky-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-background animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Announcements
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-600 dark:text-brand-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications right now
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 text-xs transition-colors hover:bg-muted/40 ${
                    !item.is_read ? "bg-brand-500/5 dark:bg-brand-500/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h5 className="font-semibold text-foreground tracking-tight line-clamp-1">
                          {item.title}
                        </h5>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/40">
                        {item.link_url ? (
                          item.link_url.startsWith("https://") ? (
                            <a
                              href={item.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
                            >
                              <span>{item.link_label || "Learn more"}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <Link
                              href={item.link_url}
                              onClick={() => setOpen(false)}
                              className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
                            >
                              {item.link_label || "View"}
                            </Link>
                          )
                        ) : <span />}

                        {!item.is_read && (
                          <button
                            onClick={() => handleMarkRead(item.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Check className="w-3 h-3" />
                            <span>Mark read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
