// src/app/(dashboard)/admin/users/[id]/UserDetailClient.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  User, 
  Building2, 
  StickyNote, 
  AlertTriangle,
  ShieldCheck,
  ShieldBan,
  ArrowRight,
  Clock,
  Mail,
  Phone,
  Briefcase,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Crown
} from "lucide-react";
import { PlanBadge, RoleBadge } from "@/components/Formatters";
import { ConfirmModal } from "@/app/(dashboard)/admin/_components/ConfirmModal";
import { banUser, unbanUser, softDeleteUser, addUserNote, adminUpdateUserEmail } from "../actions";

export function UserDetailClient({ data }: { data: any }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "businesses" | "security" | "notes" | "danger">("profile");
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmUnban, setConfirmUnban] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Email Change State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [statusToast, setStatusToast] = useState("");

  const { user, notes = [], linkedBusinesses = [] } = data;

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(""), 4000);
  };

  const handleOpenEmailModal = () => {
    setNewEmailInput(user.email || "");
    setEmailError("");
    setEmailModalOpen(true);
  };

  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubmitting(true);
    setEmailError("");
    try {
      const res = await adminUpdateUserEmail(user.id, newEmailInput);
      showToast(res.message || "Email address updated successfully");
      setEmailModalOpen(false);
      user.email = newEmailInput.trim().toLowerCase();
      router.refresh();
    } catch (err: any) {
      setEmailError(err.message || "Failed to update email address");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await addUserNote(user.id, newNote);
      setNewNote("");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* User Header Profile Card */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-700 dark:text-brand-400 font-bold text-2xl flex items-center justify-center uppercase shrink-0">
            {user.full_name ? user.full_name[0] : user.email[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-foreground">
                {user.full_name || "Unnamed Account"}
              </h2>
              <RoleBadge role={user.role || user.workspace_role || "member"} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 text-muted-foreground border border-border">
                {user.system_role === "super_admin"
                  ? "Super Admin"
                  : user.system_role === "admin"
                  ? "Admin"
                  : user.system_role === "support"
                  ? "Support"
                  : "Standard User"}
              </span>
              {user.is_banned && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/20">
                  BANNED
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </span>
              <button
                type="button"
                onClick={handleOpenEmailModal}
                className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                title="Change user email address"
              >
                <Edit2 className="w-3 h-3" />
                <span>Change Email</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenEmailModal}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs sm:text-sm font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
          >
            <Mail className="w-4 h-4 text-brand-500" />
            <span>Change Email</span>
          </button>

          {user.tenant_id && (
            <Link
              href={`/admin/businesses/${user.tenant_id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20"
            >
              <Building2 className="w-4 h-4" />
              <span>View Business Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto select-none">
        {[
          { key: "profile", label: "User Profile", icon: User },
          { key: "businesses", label: "Linked Businesses", icon: Building2, count: linkedBusinesses.length },
          { key: "security", label: "Security & Access", icon: ShieldCheck },
          { key: "notes", label: "Staff Notes", icon: StickyNote, count: notes.length },
          { key: "danger", label: "Danger Zone", icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? "bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30"
                : "text-gray-500 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 text-xs flex items-center justify-center font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: USER PROFILE */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xs">
              <h3 className="font-bold text-foreground text-base">Account Identity</h3>
              <div className="divide-y divide-border text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">User ID</span>
                  <span className="font-mono font-semibold">{user.id}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Full Name</span>
                  <span className="font-semibold text-foreground">{user.full_name || "Not provided"}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-gray-500">Email Address</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{user.email}</span>
                    <button
                      type="button"
                      onClick={handleOpenEmailModal}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-colors cursor-pointer"
                      title="Change email"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{user.phone || "Not provided"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Company</span>
                <span>{user.company || "Not provided"}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xs">
            <h3 className="font-bold text-foreground text-base">Workspace & Platform Role</h3>
            <div className="divide-y divide-border text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Workspace Role</span>
                <RoleBadge role={user.role || user.workspace_role || "member"} />
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Platform Staff Role</span>
                <span className="font-semibold text-foreground capitalize">{user.system_role || "user"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Joined Date</span>
                <span>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Last Seen / Login</span>
                <span>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never logged in"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Signup Source</span>
                <span className="font-mono text-xs">{user.signup_source || "self_serve"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Businesses Quick Summary */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-base">Linked Businesses & Workspaces</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connected workspaces owned by or shared with this user ({linkedBusinesses.length})
              </p>
            </div>
            {linkedBusinesses.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("businesses")}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                View all ({linkedBusinesses.length})
              </button>
            )}
          </div>

          {linkedBusinesses.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No businesses currently associated with this account.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {linkedBusinesses.slice(0, 3).map((biz: any) => (
                <div
                  key={biz.id}
                  className="p-3.5 rounded-2xl bg-muted/30 border border-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-foreground truncate">{biz.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleBadge role={biz.role} />
                        {biz.isActive && (
                          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold">• Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/businesses/${biz.id}`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    title="View business"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* TAB 2: LINKED BUSINESSES */}
      {activeTab === "businesses" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-500" />
                  <span>Linked Businesses & Workspaces</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All workspace accounts owned by, administered by, or shared with {user.full_name || user.email}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border w-fit">
                {linkedBusinesses.length} {linkedBusinesses.length === 1 ? "workspace" : "workspaces"}
              </span>
            </div>

            {linkedBusinesses.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No businesses or workspaces are linked to this user's email ({user.email}).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {linkedBusinesses.map((biz: any) => (
                  <div
                    key={biz.id}
                    className="p-5 rounded-2xl bg-card border border-border hover:border-brand-500/30 transition-all shadow-2xs flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-foreground text-base truncate">{biz.name}</h4>
                            <PlanBadge plan={biz.plan || "Free"} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Workspace ID #{biz.id}</p>
                        </div>
                      </div>

                      {biz.isActive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30 shrink-0">
                          Active Workspace
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Role:</span>
                        <RoleBadge role={biz.role} />
                        {biz.isOwner && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Crown className="w-3 h-3" />
                            Owner
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/admin/businesses/${biz.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs font-bold text-brand-700 dark:text-brand-400 transition-colors cursor-pointer"
                      >
                        <span>View Business</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & ACCESS */}
      {activeTab === "security" && (
        <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-2xs">
          <h3 className="font-bold text-foreground text-base">Security & Authentication Status</h3>

          <div className="divide-y divide-border text-sm">
            {/* Email Address & Recovery */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-foreground block">Account Login Email</span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  Current login: <strong className="text-foreground">{user.email}</strong>. Use when a user loses email access or requests an account transfer.
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenEmailModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Change Email Address</span>
              </button>
            </div>

            <div className="py-4 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Account Status</span>
                <span className="text-xs text-gray-500">
                  {user.is_banned ? `Banned on ${new Date(user.banned_at).toLocaleDateString()}` : "Normal active standing"}
                </span>
              </div>
              {user.is_banned ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/20">
                  Suspended
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                  Active
                </span>
              )}
            </div>

            {user.banned_reason && (
              <div className="py-3">
                <span className="text-xs text-gray-500 block mb-1">Suspension Reason</span>
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  {user.banned_reason}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3">
            {user.is_banned ? (
              <button
                onClick={() => setConfirmUnban(true)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-brand-900 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Unban User Account
              </button>
            ) : (
              <button
                onClick={() => setConfirmBan(true)}
                className="px-4 py-2 bg-red-600/15 hover:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-500/30 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Suspend / Ban Account
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STAFF NOTES */}
      {activeTab === "notes" && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-6">
          <h3 className="font-bold text-foreground text-lg">Staff Internal Notes on {user.full_name || user.email}</h3>

          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add internal notes about this specific user (e.g. verified phone, support ticket reference, password reset request)..."
              rows={3}
              className="w-full p-4 bg-black/[0.02] dark:bg-white/5 border border-border rounded-2xl text-sm outline-none focus:border-brand-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNote || !newNote.trim()}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs sm:text-sm transition-all disabled:opacity-40 cursor-pointer"
              >
                {savingNote ? "Saving..." : "Add User Note"}
              </button>
            </div>
          </form>

          <div className="space-y-3 pt-4 border-t border-border">
            {notes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No internal staff notes on this user account.</p>
            ) : (
              notes.map((n: any) => (
                <div key={n.id} className="p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-foreground">{n.author_name || n.author_email}</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DANGER ZONE */}
      {activeTab === "danger" && (
        <div className="bg-card border border-red-500/20 rounded-3xl p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="font-bold text-red-600 dark:text-red-400 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Danger Zone Actions
            </h3>
            <p className="text-xs text-gray-500 mt-1">Actions here directly impact this individual user's account access.</p>
          </div>

          <div className="divide-y divide-border">
            {/* Ban / Unban */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {user.is_banned ? "Unban Account" : "Suspend / Ban Account"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {user.is_banned
                    ? "Restore access for this user so they can log in normally."
                    : "Immediately block this user from accessing Framebooks."}
                </p>
              </div>
              {user.is_banned ? (
                <button
                  onClick={() => setConfirmUnban(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-brand-900 font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Unban User
                </button>
              ) : (
                <button
                  onClick={() => setConfirmBan(true)}
                  className="px-4 py-2 bg-red-600/15 hover:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-500/30 font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Ban User
                </button>
              )}
            </div>

            {/* Soft Delete */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-red-600 dark:text-red-400 text-sm">Soft Delete Account</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Archive this user account and remove it from active user lists. Data can be recovered if needed.
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmBan && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmBan(false)}
          onConfirm={async () => {
            await banUser(user.id, "Banned by administrator via user portal");
            router.refresh();
          }}
          title={`Ban ${user.email}`}
          description="Are you sure you want to suspend this account? The user will be blocked from logging into Framebooks."
          confirmText="Confirm Ban"
          isDestructive={true}
          typeToConfirmText={user.email}
        />
      )}

      {confirmUnban && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmUnban(false)}
          onConfirm={async () => {
            await unbanUser(user.id);
            router.refresh();
          }}
          title={`Unban ${user.email}`}
          description="Are you sure you want to restore access for this user?"
          confirmText="Confirm Unban"
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await softDeleteUser(user.id);
            router.push("/admin/users");
          }}
          title={`Delete ${user.email}`}
          description="This will soft-delete the user record. To confirm permanent archival, please type their email below:"
          confirmText="Delete Account"
          isDestructive={true}
          typeToConfirmText={user.email}
        />
      )}

      {/* Change Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Change Account Email</h3>
                <p className="text-xs text-muted-foreground">Update login email and workspace ownership</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Current Email:</strong> {user.email}</p>
              <p className="text-[11px] leading-relaxed">
                Updating this email will change their login address and automatically update ownership of any workspaces or team memberships linked to their account.
              </p>
            </div>

            <form onSubmit={handleEmailChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  New Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="new-email@example.com"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSubmitting || !newEmailInput.trim() || newEmailInput.trim().toLowerCase() === user.email.toLowerCase()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {emailSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
