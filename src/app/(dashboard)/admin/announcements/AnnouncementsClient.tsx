// src/app/(dashboard)/admin/announcements/AnnouncementsClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon,
  Eye,
  ExternalLink,
  X
} from "lucide-react";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { 
  createAnnouncement, 
  toggleAnnouncement, 
  deleteAnnouncement,
  AnnouncementData 
} from "./actions";

const typeStyles = {
  info: {
    container: "bg-sky-500/10 border-sky-500/25 text-sky-900 dark:text-sky-100",
    iconBg: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    icon: Info,
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  success: {
    container: "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-100",
    iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  warning: {
    container: "bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-100",
    iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  critical: {
    container: "bg-rose-500/10 border-rose-500/25 text-rose-900 dark:text-rose-100",
    iconBg: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
    icon: AlertOctagon,
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
};

export function AnnouncementsClient({ announcements }: { announcements: AnnouncementData[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [type, setType] = useState<"info" | "success" | "warning" | "critical">("info");
  const [dismissible, setDismissible] = useState(true);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [priority, setPriority] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [statusToast, setStatusToast] = useState("");

  const activeCount = announcements.filter((a) => a.is_active).length;
  const totalDismissals = announcements.reduce((sum, a) => sum + (a.dismissals_count || 0), 0);
  const maxReach = announcements.reduce((max, a) => Math.max(max, a.reach_count || 0), 0);

  const filtered = announcements.filter((a) => {
    if (activeFilter === "active") return a.is_active;
    if (activeFilter === "inactive") return !a.is_active;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAnnouncement({
        title,
        body,
        audience,
        type,
        dismissible,
        linkLabel: linkLabel || undefined,
        linkUrl: linkUrl || undefined,
        priority: Number(priority) || 0,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
      });
      setCreateOpen(false);
      setTitle("");
      setBody("");
      setLinkLabel("");
      setLinkUrl("");
      setStatusToast("Announcement created");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await toggleAnnouncement(id, !current);
      setStatusToast(!current ? "Announcement active" : "Announcement paused");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch {
      alert("Couldn't save. Try again.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await deleteAnnouncement(id);
      setStatusToast("Announcement deleted");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch {
      alert("Couldn't delete. Try again.");
    }
  };

  const previewStyle = typeStyles[type] || typeStyles.info;
  const PreviewIcon = previewStyle.icon;

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminStatCard
          label="Active notices"
          value={activeCount}
          icon={Megaphone}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
        />

        <AdminStatCard
          label="Total reach"
          value={maxReach || 2}
          unit="users"
          icon={Eye}
          iconBg="bg-blue-100/80 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
        />

        <AdminStatCard
          label="Dismissals"
          value={totalDismissals}
          icon={XCircle}
          iconBg="bg-purple-100/80 dark:bg-purple-400/10"
          iconColor="text-purple-700 dark:text-purple-400"
        />
      </div>

      {/* Filter Chips & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Paused" },
          ].map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key as any)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  active
                    ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                    : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-muted/50 shadow-2xs"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New announcement</span>
        </button>
      </div>

      {/* Announcements Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th className="p-4">Title</th>
                <th className="p-4">Type</th>
                <th className="p-4">Audience</th>
                <th className="p-4">Reach</th>
                <th className="p-4">Dismissed</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                    No announcements yet
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const s = typeStyles[a.type] || typeStyles.info;
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{a.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-sm">{a.body}</div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${s.badge}`}>
                          {a.type}
                        </span>
                      </td>

                      <td className="p-4 capitalize text-xs text-muted-foreground">
                        {a.audience}
                      </td>

                      <td className="p-4 text-xs font-medium text-foreground">
                        {a.reach_count || 0}
                      </td>

                      <td className="p-4 text-xs text-muted-foreground">
                        {a.dismissals_count || 0}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          a.is_active 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                            : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {a.is_active ? "Active" : "Paused"}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggle(a.id, a.is_active)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title={a.is_active ? "Pause" : "Activate"}
                          >
                            {a.is_active ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Announcement Modal with Live Preview */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">New announcement</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* LIVE PREVIEW BOX */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Live preview
              </span>
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${previewStyle.container}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-xl shrink-0 ${previewStyle.iconBg}`}>
                    <PreviewIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {title || "Announcement headline"}
                    </span>
                    <span className="text-muted-foreground text-[11px] line-clamp-1 block">
                      {body || "This message will be shown directly across customer dashboards."}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {linkLabel && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-background border border-border shadow-2xs">
                      {linkLabel}
                    </span>
                  )}
                  {dismissible && <X className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled maintenance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-semibold text-foreground outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Short, clear explanation for customers..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground outline-none"
                  >
                    <option value="info">Info (Blue)</option>
                    <option value="success">Success (Green)</option>
                    <option value="warning">Warning (Amber)</option>
                    <option value="critical">Critical (Red)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Audience
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground outline-none"
                  >
                    <option value="all">Everyone</option>
                    <option value="pro_plus">Pro Plus only</option>
                    <option value="pro">Pro only</option>
                    <option value="free">Free tier only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Button label (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Learn more"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Link URL (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://... or /user/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Starts on
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Ends on
                  </label>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Dismissible</span>
                  <span className="text-[11px] text-muted-foreground block">Allow users to close this notice</span>
                </div>
                <input
                  type="checkbox"
                  checked={dismissible}
                  onChange={(e) => setDismissible(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs sm:text-sm transition-colors shadow-xs"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Publish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
