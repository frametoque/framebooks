// src/components/AnnouncementBanner.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  X 
} from "lucide-react";
import Link from "next/link";
import { AnnouncementData, dismissAnnouncement } from "@/app/(dashboard)/admin/announcements/actions";

export interface AnnouncementBannerProps {
  initialAnnouncements?: AnnouncementData[];
  userPlan?: string;
}

const typeStyles = {
  info: {
    container: "bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/25 text-sky-900 dark:text-sky-100",
    iconBg: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    icon: Info,
    btn: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  success: {
    container: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 text-emerald-900 dark:text-emerald-100",
    iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  warning: {
    container: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 text-amber-900 dark:text-amber-100",
    iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  critical: {
    container: "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 text-rose-900 dark:text-rose-100",
    iconBg: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
    icon: AlertOctagon,
    btn: "bg-rose-600 hover:bg-rose-700 text-white",
  },
};

let cachedAnnouncements: AnnouncementData[] | null = null;
let fetchPromise: Promise<AnnouncementData[]> | null = null;

async function fetchUserAnnouncements(): Promise<AnnouncementData[]> {
  if (cachedAnnouncements !== null) {
    return cachedAnnouncements;
  }
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = fetch("/api/announcements")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const list = Array.isArray(data?.announcements) ? data.announcements : [];
      cachedAnnouncements = list;
      fetchPromise = null;
      return list;
    })
    .catch((err) => {
      console.error("Announcement fetch error:", err);
      cachedAnnouncements = [];
      fetchPromise = null;
      return [];
    });

  return fetchPromise;
}

export function AnnouncementBanner({ initialAnnouncements }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>(
    initialAnnouncements || cachedAnnouncements || []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const hasMountedRef = React.useRef(false);

  React.useEffect(() => {
    if (initialAnnouncements && initialAnnouncements.length > 0) {
      setAnnouncements(initialAnnouncements);
      cachedAnnouncements = initialAnnouncements;
      return;
    }

    if (hasMountedRef.current && announcements.length > 0) {
      return;
    }
    hasMountedRef.current = true;

    fetchUserAnnouncements().then((data) => {
      setAnnouncements(data);
    });
  }, []);

  if (!announcements || announcements.length === 0) return null;

  const current = announcements[currentIndex] || announcements[0];
  const style = typeStyles[current.type] || typeStyles.info;
  const Icon = style.icon;

  const handleDismiss = async () => {
    const toDismiss = current;
    // Optimistic removal
    const remaining = announcements.filter((_, idx) => idx !== currentIndex);
    setAnnouncements(remaining);
    cachedAnnouncements = remaining;
    if (currentIndex >= remaining.length && remaining.length > 0) {
      setCurrentIndex(0);
    }

    try {
      const res = await dismissAnnouncement(toDismiss.id);
      if (!res.success) {
        // Rollback on failure
        setAnnouncements((prev) => [toDismiss, ...prev]);
        cachedAnnouncements = announcements;
      }
    } catch {
      setAnnouncements((prev) => [toDismiss, ...prev]);
      cachedAnnouncements = announcements;
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  // Safe link validation: only allow https or relative
  const isValidUrl = current.link_url && (current.link_url.startsWith("https://") || current.link_url.startsWith("/"));

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current.id}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden mb-6"
      >
        <div
          className={`p-3 sm:p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm ${style.container}`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${style.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground tracking-tight">
                  {current.title}
                </span>
                {announcements.length > 1 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground">
                    {currentIndex + 1} of {announcements.length}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2 leading-relaxed">
                {current.body}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center ml-auto">
            {isValidUrl && (
              current.link_url!.startsWith("https://") ? (
                <a
                  href={current.link_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-background/80 hover:bg-background border border-border shadow-2xs transition-colors"
                >
                  <span>{current.link_label || "Learn more"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <Link
                  href={current.link_url!}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-background/80 hover:bg-background border border-border shadow-2xs transition-colors"
                >
                  <span>{current.link_label || "View"}</span>
                </Link>
              )
            )}

            {announcements.length > 1 && (
              <div className="flex items-center gap-1 border-l border-border/40 pl-2">
                <button
                  onClick={handlePrev}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {current.dismissible !== false && (
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
