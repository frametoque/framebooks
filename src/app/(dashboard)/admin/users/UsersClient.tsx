// src/app/(dashboard)/admin/users/UsersClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Download, 
  ShieldBan, 
  ShieldCheck, 
  Building2, 
  Users, 
  Layers, 
  Crown,
  Eye,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  Mail
} from "lucide-react";
import { PlanBadge, RoleBadge, StatusPill } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { ConfirmModal } from "@/app/(dashboard)/admin/_components/ConfirmModal";
import { 
  banUser, 
  unbanUser, 
  softDeleteUser,
  adminUpdateUserEmail 
} from "./actions";

export function UsersClient({
  initialData,
  searchParams,
}: {
  initialData: any;
  searchParams: any;
}) {
  const router = useRouter();
  const [banModalUser, setBanModalUser] = useState<any | null>(null);
  const [banReason, setBanReason] = useState("");
  const [unbanModalUser, setUnbanModalUser] = useState<any | null>(null);
  const [statusToast, setStatusToast] = useState("");

  // Delete user confirmation state
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: number; email: string; name?: string } | null>(null);
  const [submittingDeleteUser, setSubmittingDeleteUser] = useState(false);

  // Change email state
  const [changeEmailTarget, setChangeEmailTarget] = useState<{ id: number; email: string; name?: string } | null>(null);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");

  const { users, totalCount, totalPages, page } = initialData;

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(""), 3500);
  };

  const handleOpenChangeEmail = (user: { id: number; email: string; full_name?: string; name?: string }) => {
    setChangeEmailTarget({ id: user.id, email: user.email, name: user.full_name || user.name });
    setNewEmailInput(user.email);
    setEmailError("");
  };

  const handleChangeEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeEmailTarget) return;
    setEmailSubmitting(true);
    setEmailError("");
    try {
      const res = await adminUpdateUserEmail(changeEmailTarget.id, newEmailInput);
      showToast(res.message || "User email updated successfully");
      setChangeEmailTarget(null);
      router.refresh();
    } catch (err: any) {
      setEmailError(err.message || "Failed to update email");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    params.set("page", "1");
    router.push(`/admin/users?${params.toString()}`);
  };

  // Distinct businesses count
  const businessCount = useMemo(() => {
    const ids = new Set(
      users.flatMap((u: any) => 
        (u.linked_businesses || []).map((b: any) => b.id).concat(u.tenant_id ? [u.tenant_id] : [])
      )
    );
    return ids.size;
  }, [users]);

  const paidUsersCount = useMemo(() => {
    return users.filter((u: any) => u.current_plan && u.current_plan.toLowerCase() !== "free").length;
  }, [users]);

  const exportCSV = () => {
    const headers = ["ID", "Email", "Name", "Business", "Plan", "Role", "Status", "Joined"];
    const csvContent = [
      headers.join(","),
      ...users.map((r: any) =>
        [
          r.id,
          `"${r.email}"`,
          `"${r.full_name || ''}"`,
          `"${r.tenant_name || ''}"`,
          r.current_plan,
          r.workspace_role || r.role || "member",
          r.is_banned ? "banned" : "active",
          `"${new Date(r.created_at).toISOString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBan = async () => {
    if (!banModalUser) return;
    try {
      await banUser(banModalUser.id, banReason);
      showToast("User banned");
      setBanModalUser(null);
      setBanReason("");
      router.refresh();
    } catch {
      alert("Couldn't save. Try again.");
    }
  };

  const handleUnban = async () => {
    if (!unbanModalUser) return;
    try {
      await unbanUser(unbanModalUser.id);
      showToast("User unbanned");
      setUnbanModalUser(null);
      router.refresh();
    } catch {
      alert("Couldn't save. Try again.");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setSubmittingDeleteUser(true);
    try {
      await softDeleteUser(deleteUserTarget.id);
      showToast(`Permanently deleted account "${deleteUserTarget.email}"`);
      setDeleteUserTarget(null);
      router.refresh();
    } catch (err: any) {
      showToast(err.message || "Failed to delete account");
    } finally {
      setSubmittingDeleteUser(false);
    }
  };

  const activePlanFilter = searchParams.plan || "all";

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Total users"
          value={totalCount || users.length}
          icon={Users}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
        />

        <AdminStatCard
          label="Businesses"
          value={businessCount}
          icon={Building2}
          iconBg="bg-blue-100/80 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
        />

        <AdminStatCard
          label="Paid accounts"
          value={paidUsersCount}
          icon={Crown}
          iconBg="bg-emerald-100/80 dark:bg-emerald-400/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
        />

        <AdminStatCard
          label="Workspaces"
          value={businessCount || 1}
          icon={Layers}
          iconBg="bg-purple-100/80 dark:bg-purple-400/10"
          iconColor="text-purple-700 dark:text-purple-400"
        />
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All plans" },
            { key: "free", label: "Free" },
            { key: "pro", label: "Pro" },
            { key: "pro plus", label: "Pro Plus" },
          ].map((f) => {
            const active = activePlanFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => updateFilters({ plan: f.key === "all" ? null : f.key })}
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              defaultValue={searchParams.search || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateFilters({ search: (e.target as HTMLInputElement).value });
                }
              }}
              placeholder="Search users..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-full text-xs sm:text-sm outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-card hover:bg-muted/50 border border-border rounded-full text-foreground transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content: Users List Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        {users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No users found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="p-4">User</th>
                  <th className="p-4">Linked Businesses</th>
                  <th className="p-4">Role & Plan</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u: any) => {
                  const linked = u.linked_businesses || [];
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        u.is_banned ? "opacity-60 bg-red-500/[0.02]" : ""
                      }`}
                    >
                      {/* User Info Column */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {(u.full_name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <Link
                                href={`/admin/users/${u.id}`}
                                className="hover:underline hover:text-brand-600 dark:hover:text-brand-400 truncate max-w-[180px]"
                              >
                                {u.full_name || "Unnamed"}
                              </Link>
                              <span className="text-[10px] text-muted-foreground font-mono">#{u.id}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="truncate max-w-[200px]">{u.email}</span>
                              <button
                                type="button"
                                onClick={() => handleOpenChangeEmail(u)}
                                className="text-brand-600 dark:text-brand-400 hover:underline text-[11px] font-semibold cursor-pointer shrink-0"
                                title="Change user email address"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Linked Businesses Column */}
                      <td className="p-4">
                        {linked.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">None (Direct platform user)</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                            {linked.map((biz: any) => (
                              <Link
                                key={biz.id}
                                href={`/admin/businesses/${biz.id}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs border transition-all cursor-pointer ${
                                  biz.isActive
                                    ? "bg-brand-500/10 border-brand-500/30 text-brand-700 dark:text-brand-300 font-semibold hover:bg-brand-500/20"
                                    : "bg-muted/50 border-border text-foreground/80 hover:bg-muted hover:text-foreground"
                                }`}
                                title={`View business: ${biz.name} (${biz.role})`}
                              >
                                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[120px]">{biz.name}</span>
                                <span className="text-[10px] px-1 py-0.2 rounded bg-background/80 border border-border/50 text-muted-foreground font-medium">
                                  {biz.isOwner ? "Owner" : biz.role}
                                </span>
                                {biz.isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="Active workspace" />
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Role & Plan Column */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <RoleBadge role={u.workspace_role || u.role || "member"} />
                            <PlanBadge plan={u.current_plan || "Free"} />
                          </div>
                          {u.system_role && u.system_role !== 'user' && (
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 capitalize">
                              {u.system_role}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="p-4">
                        {u.is_banned ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Banned
                          </span>
                        ) : (
                          <StatusPill status="active" />
                        )}
                      </td>

                      {/* Joined Date Column */}
                      <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenChangeEmail(u)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-600 hover:bg-brand-500/10 transition-colors cursor-pointer"
                            title="Change email address"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/admin/users/${u.id}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="View user details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {u.is_banned ? (
                            <button
                              onClick={() => setUnbanModalUser(u)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="Unban user"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanModalUser(u)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Ban user"
                            >
                              <ShieldBan className="w-4 h-4" />
                            </button>
                          )}

                          {u.system_role !== 'super_admin' && (
                            <button
                              onClick={() => setDeleteUserTarget({ id: u.id, email: u.email, name: u.full_name || u.email })}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete user account"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div>
            Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total users)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilters({ page: String(Math.max(1, page - 1)) })}
              disabled={page <= 1}
              className="px-4 py-2 rounded-full border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer font-semibold shadow-2xs"
            >
              Previous
            </button>
            <button
              onClick={() => updateFilters({ page: String(Math.min(totalPages, page + 1)) })}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-full border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer font-semibold shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Ban user</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to ban {banModalUser.email}? They won't be able to log in.
            </p>

            <input
              type="text"
              placeholder="Reason (optional)"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setBanModalUser(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Ban user
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unban Confirmation Modal */}
      {unbanModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Unban user</h3>
            <p className="text-sm text-muted-foreground">
              Restore access for {unbanModalUser.email}?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setUnbanModalUser(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUnban}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold transition-colors cursor-pointer"
              >
                Unban user
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserTarget && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeleteUserTarget(null)}
          onConfirm={handleDeleteUser}
          title={`Delete Account: ${deleteUserTarget.email}?`}
          description={`Permanently deletes account "${deleteUserTarget.email}". They will immediately lose access to Framebooks. This action cannot be undone.`}
          confirmText={submittingDeleteUser ? "Deleting..." : "Permanently Delete Account"}
          isDestructive={true}
          typeToConfirmText={deleteUserTarget.email}
        />
      )}

      {/* Change Email Modal */}
      {changeEmailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Change User Email</h3>
                <p className="text-xs text-muted-foreground">
                  Update login email for {changeEmailTarget.name || changeEmailTarget.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangeEmailTarget(null)}
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
              <p><strong className="text-foreground">Current Email:</strong> {changeEmailTarget.email}</p>
              <p className="text-[11px] leading-relaxed">
                This will update their sign-in credentials and reassign ownership of their workspaces and team memberships to the new email address.
              </p>
            </div>

            <form onSubmit={handleChangeEmailSubmit} className="space-y-4">
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
                  onClick={() => setChangeEmailTarget(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSubmitting || !newEmailInput.trim() || newEmailInput.trim().toLowerCase() === changeEmailTarget.email.toLowerCase()}
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
