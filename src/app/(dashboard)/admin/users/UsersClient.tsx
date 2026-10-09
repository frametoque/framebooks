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
  UserPlus,
  UserMinus,
  UserCheck,
  X,
  Loader2,
  FileText,
  DollarSign,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { PlanBadge, RoleBadge, StatusPill } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { BusinessDetailView } from "@/app/(dashboard)/admin/_components/BusinessDetailView";
import { 
  banUser, 
  unbanUser, 
  getBusinessDetails, 
  adminAddBusinessMember, 
  adminUpdateMemberRole, 
  adminRemoveBusinessMember 
} from "./actions";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner", description: "Full workspace control & billing" },
  { value: "admin", label: "Admin", description: "Manage team, settings & finances" },
  { value: "accountant", label: "Accountant", description: "Manage ledger, incomes, expenses & reports" },
  { value: "editor", label: "Editor", description: "Create invoices, clients & quotations" },
  { value: "viewer", label: "Viewer", description: "Read-only access to business data" },
  { value: "member", label: "Member", description: "Standard team member" },
];

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

  // Business view modal state
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [loadingBusinessModal, setLoadingBusinessModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);

  // Add member modal state
  const [addMemberBusiness, setAddMemberBusiness] = useState<{ tenantId: number; name: string } | null>(null);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("member");
  const [addMemberSubmitting, setAddMemberSubmitting] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");

  // Change role modal state
  const [roleModalTarget, setRoleModalTarget] = useState<{ user: any; tenantId: number; businessName: string } | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState("member");
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleError, setRoleError] = useState("");

  // Remove member confirmation state
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ user: any; tenantId: number; businessName: string } | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const { users, totalCount, totalPages, page } = initialData;

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(""), 3500);
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

  // Group users by business
  const businessGroups = useMemo(() => {
    const map = new Map<string, { id: number | null; name: string; plan: string; logoUrl?: string | null; users: any[] }>();

    users.forEach((u: any) => {
      const key = u.tenant_id ? `tenant-${u.tenant_id}` : "unassigned";
      const name = u.tenant_name || "Direct platform account";
      const plan = u.current_plan || "Free";
      const logoUrl = u.tenant_logo_url || null;

      if (!map.has(key)) {
        map.set(key, {
          id: u.tenant_id || null,
          name,
          plan,
          logoUrl,
          users: [],
        });
      }
      map.get(key)!.users.push(u);
    });

    return Array.from(map.values());
  }, [users]);

  // Distinct businesses count
  const businessCount = useMemo(() => {
    const ids = new Set(users.map((u: any) => u.tenant_id).filter(Boolean));
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

  // View Business Action
  const handleOpenBusiness = async (tenantId: number) => {
    setBusinessModalOpen(true);
    setLoadingBusinessModal(true);
    try {
      const details = await getBusinessDetails(tenantId);
      setSelectedBusiness(details);
    } catch (err: any) {
      alert(err.message || "Failed to load business details");
      setBusinessModalOpen(false);
    } finally {
      setLoadingBusinessModal(false);
    }
  };

  // Open Add Member
  const handleOpenAddMember = (tenantId: number, name: string) => {
    setAddMemberBusiness({ tenantId, name });
    setAddMemberEmail("");
    setAddMemberName("");
    setAddMemberRole("member");
    setAddMemberError("");
  };

  // Submit Add Member
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberBusiness) return;
    setAddMemberSubmitting(true);
    setAddMemberError("");
    try {
      await adminAddBusinessMember({
        tenantId: addMemberBusiness.tenantId,
        email: addMemberEmail,
        fullName: addMemberName,
        role: addMemberRole,
      });
      showToast(`Member added to ${addMemberBusiness.name}`);
      setAddMemberBusiness(null);
      router.refresh();
      if (businessModalOpen && selectedBusiness?.tenant?.id === addMemberBusiness.tenantId) {
        handleOpenBusiness(addMemberBusiness.tenantId);
      }
    } catch (err: any) {
      setAddMemberError(err.message || "Failed to add member");
    } finally {
      setAddMemberSubmitting(false);
    }
  };

  // Open Change Role Modal
  const handleOpenChangeRole = (user: any, tenantId: number, businessName: string) => {
    setRoleModalTarget({ user, tenantId, businessName });
    setSelectedNewRole(user.workspace_role || user.role || "member");
    setRoleError("");
  };

  // Submit Change Role
  const handleChangeRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalTarget) return;
    setRoleSubmitting(true);
    setRoleError("");
    try {
      await adminUpdateMemberRole({
        userId: roleModalTarget.user.id,
        tenantId: roleModalTarget.tenantId,
        newRole: selectedNewRole,
      });
      showToast(`Role updated to ${selectedNewRole}`);
      setRoleModalTarget(null);
      router.refresh();
      if (businessModalOpen && selectedBusiness?.tenant?.id === roleModalTarget.tenantId) {
        handleOpenBusiness(roleModalTarget.tenantId);
      }
    } catch (err: any) {
      setRoleError(err.message || "Failed to update role");
    } finally {
      setRoleSubmitting(false);
    }
  };

  // Open Remove Member Confirmation
  const handleOpenRemoveMember = (user: any, tenantId: number, businessName: string) => {
    setRemoveMemberTarget({ user, tenantId, businessName });
  };

  // Confirm Remove Member
  const handleConfirmRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemoveSubmitting(true);
    try {
      await adminRemoveBusinessMember({
        userId: removeMemberTarget.user.id,
        tenantId: removeMemberTarget.tenantId,
      });
      showToast(`Removed from ${removeMemberTarget.businessName}`);
      setRemoveMemberTarget(null);
      router.refresh();
      if (businessModalOpen && selectedBusiness?.tenant?.id === removeMemberTarget.tenantId) {
        handleOpenBusiness(removeMemberTarget.tenantId);
      }
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    } finally {
      setRemoveSubmitting(false);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

      {/* Users Grouped by Business */}
      <div className="space-y-6">
        {businessGroups.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground text-sm shadow-xs">
            No users found
          </div>
        ) : (
          businessGroups.map((group) => (
            <div
              key={group.id || "unassigned"}
              className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs"
            >
              {/* Business Header with View Action & Member Controls */}
              <div className="p-5 sm:p-6 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 overflow-hidden relative">
                    {group.logoUrl ? (
                      <img
                        src={group.logoUrl}
                        alt={group.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                          const fallback = e.currentTarget.parentElement?.querySelector(".fallback-building-icon");
                          if (fallback) (fallback as HTMLElement).classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <Building2 className={`w-5 h-5 fallback-building-icon ${group.logoUrl ? "hidden" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground text-base truncate">
                        {group.name}
                      </h3>
                      <PlanBadge plan={group.plan} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.users.length} {group.users.length === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>

                {group.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenAddMember(group.id!, group.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
                      title="Add a team member to this business"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-brand-500" />
                      <span>Add member</span>
                    </button>

                    <button
                      onClick={() => handleOpenBusiness(group.id!)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs font-bold text-brand-700 dark:text-brand-400 transition-colors cursor-pointer shadow-2xs"
                      title="View full business details and management"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View business</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Members Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                      <th className="p-4">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Joined</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.users.map((u: any) => (
                      <tr
                        key={u.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          u.is_banned ? "opacity-60 bg-red-500/[0.02]" : ""
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {(u.full_name || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">
                                {u.full_name || "Unnamed"}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <RoleBadge role={u.workspace_role || u.role || "member"} />
                        </td>

                        <td className="p-4">
                          {u.is_banned ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              Banned
                            </span>
                          ) : (
                            <StatusPill status="active" />
                          )}
                        </td>

                        <td className="p-4 text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="View user details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {group.id && (
                              <>
                                <button
                                  onClick={() => handleOpenChangeRole(u, group.id!, group.name)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-500 hover:bg-brand-500/10 transition-colors cursor-pointer"
                                  title="Change team member role"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleOpenRemoveMember(u, group.id!, group.name)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Remove from this business"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {u.is_banned ? (
                              <button
                                onClick={() => setUnbanModalUser(u)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                title="Unban"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setBanModalUser(u)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Ban"
                              >
                                <ShieldBan className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* VIEW BUSINESS DETAILS MODAL */}
      {businessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 max-w-5xl w-full shadow-2xl max-h-[92vh] overflow-y-auto">
            {loadingBusinessModal ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                <span className="text-sm">Loading business details...</span>
              </div>
            ) : selectedBusiness ? (
              <BusinessDetailView
                businessData={selectedBusiness}
                isModal={true}
                onClose={() => {
                  setBusinessModalOpen(false);
                  setSelectedBusiness(null);
                }}
                onRefresh={() => handleOpenBusiness(selectedBusiness.tenant.id)}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {addMemberBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Add Team Member</h3>
                <p className="text-xs text-muted-foreground">To {addMemberBusiness.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAddMemberBusiness(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addMemberError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addMemberError}</span>
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="member@business.com"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={addMemberName}
                  onChange={(e) => setAddMemberName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Role in Business
                </label>
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold outline-none focus:border-brand-500 cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddMemberBusiness(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {addMemberSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE ROLE MODAL */}
      {roleModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Change Member Role</h3>
                <p className="text-xs text-muted-foreground">In {roleModalTarget.businessName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalTarget(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {roleError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground text-sm">
                  {roleModalTarget.user.full_name || "Unnamed"}
                </div>
                <div className="text-xs text-muted-foreground">{roleModalTarget.user.email}</div>
              </div>
              <RoleBadge role={roleModalTarget.user.workspace_role || roleModalTarget.user.role || "member"} />
            </div>

            <form onSubmit={handleChangeRoleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Select New Role
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((r) => {
                    const isSelected = selectedNewRole.toLowerCase() === r.value.toLowerCase();
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSelectedNewRole(r.value)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand-500/10 border-brand-500 ring-1 ring-brand-500"
                            : "bg-background border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-xs text-foreground">{r.label}</div>
                            <div className="text-[11px] text-muted-foreground">{r.description}</div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRoleModalTarget(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {roleSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE MEMBER CONFIRMATION MODAL */}
      {removeMemberTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Remove Team Member</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong className="text-foreground">{removeMemberTarget.user.full_name || removeMemberTarget.user.email}</strong> from <strong className="text-foreground">{removeMemberTarget.businessName}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              Their access to this workspace's invoices, clients, and financial entries will be revoked immediately.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRemoveMemberTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveMember}
                disabled={removeSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                {removeSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Remove member</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
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
    </div>
  );
}
