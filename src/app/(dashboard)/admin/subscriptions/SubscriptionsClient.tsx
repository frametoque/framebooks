// src/app/(dashboard)/admin/subscriptions/SubscriptionsClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Building2,
  Layers,
  Crown,
  Repeat,
  Eye,
  UserPlus,
  UserCheck,
  UserMinus,
  ShieldCheck,
  ShieldBan,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { PlanBadge, RoleBadge, StatusPill } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { PlanChangeModal } from "@/app/(dashboard)/admin/_components/PlanChangeModal";
import { BusinessDetailView } from "@/app/(dashboard)/admin/_components/BusinessDetailView";
import {
  banUser,
  unbanUser,
  getBusinessDetails,
  adminAddBusinessMember,
  adminUpdateMemberRole,
  adminRemoveBusinessMember,
} from "@/app/(dashboard)/admin/users/actions";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner", description: "Full workspace control & billing access" },
  { value: "admin", label: "Admin", description: "Manage members, settings, and business records" },
  { value: "editor", label: "Editor", description: "Create and update invoices, incomes, expenses" },
  { value: "accountant", label: "Accountant", description: "View and manage financial entries and reports" },
  { value: "viewer", label: "Viewer", description: "Read-only access to records and invoices" },
  { value: "member", label: "Member", description: "Standard workspace member" },
];

export function SubscriptionsClient({
  initialData,
  allPlans,
  searchParams,
}: {
  initialData: any;
  allPlans: any[];
  searchParams: any;
}) {
  const router = useRouter();

  // Toast notification state
  const [statusToast, setStatusToast] = useState<string>("");

  // Plan change modal state
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Business view modal state
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [loadingBusinessModal, setLoadingBusinessModal] = useState(false);

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

  // Ban / Unban modal state
  const [banModalUser, setBanModalUser] = useState<any | null>(null);
  const [unbanModalUser, setUnbanModalUser] = useState<any | null>(null);
  const [banReason, setBanReason] = useState("");

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
    router.push(`/admin/subscriptions?${params.toString()}`);
  };

  // Group users by business/workspace
  const businessGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        id: number | null;
        name: string;
        plan: string;
        logoUrl?: string | null;
        subscriptionId?: number | null;
        billingInterval?: string;
        currentPeriodEnd?: string | null;
        users: any[];
      }
    >();

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
          subscriptionId: u.subscription_id || null,
          billingInterval: u.billing_interval || null,
          currentPeriodEnd: u.current_period_end || u.plan_expires_at || null,
          users: [],
        });
      }
      map.get(key)!.users.push(u);
    });

    return Array.from(map.values());
  }, [users]);

  // Distinct businesses counts
  const businessCount = useMemo(() => {
    const ids = new Set(users.map((u: any) => u.tenant_id).filter(Boolean));
    return ids.size;
  }, [users]);

  const proPlusCount = useMemo(() => {
    return businessGroups.filter((b) => b.plan.toLowerCase().includes("plus")).length;
  }, [businessGroups]);

  const proCount = useMemo(() => {
    return businessGroups.filter(
      (b) => b.plan.toLowerCase().includes("pro") && !b.plan.toLowerCase().includes("plus")
    ).length;
  }, [businessGroups]);

  const freeCount = useMemo(() => {
    return businessGroups.filter((b) => b.plan.toLowerCase().includes("free")).length;
  }, [businessGroups]);

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
    link.setAttribute("download", `subscriptions_${Date.now()}.csv`);
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
      if (businessModalOpen && selectedBusiness?.tenant?.id) {
        handleOpenBusiness(selectedBusiness.tenant.id);
      }
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
      if (businessModalOpen && selectedBusiness?.tenant?.id) {
        handleOpenBusiness(selectedBusiness.tenant.id);
      }
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

  // Open Plan Change Modal for a business group
  const handleOpenChangePlan = (group: any) => {
    const matchedPlan = allPlans.find(
      (p) =>
        p.name?.toLowerCase() === group.plan?.toLowerCase() ||
        p.key?.toLowerCase() === group.plan?.toLowerCase()
    );
    setSelectedSub({
      id: group.subscriptionId || 0,
      tenant_id: group.id,
      tenant_name: group.name,
      current_plan_name: group.plan,
      plan_id: matchedPlan?.id || (allPlans[0] ? allPlans[0].id : 1),
      billing_interval: group.billingInterval || "monthly",
      current_period_end: group.currentPeriodEnd,
    });
  };

  const activePlanFilter = searchParams.plan || "all";

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-xl text-xs sm:text-sm font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Active subscriptions"
          value={businessCount || 1}
          icon={Repeat}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
        />

        <AdminStatCard
          label="Pro Plus"
          value={proPlusCount}
          icon={Crown}
          iconBg="bg-emerald-100/80 dark:bg-emerald-400/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
        />

        <AdminStatCard
          label="Pro"
          value={proCount}
          icon={Layers}
          iconBg="bg-blue-100/80 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
        />

        <AdminStatCard
          label="Free"
          value={freeCount}
          icon={Building2}
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
              placeholder="Search workspaces or members..."
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

      {/* Subscriptions Grouped by Business */}
      <div className="space-y-6">
        {businessGroups.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground text-sm shadow-xs">
            No subscriptions or workspaces found
          </div>
        ) : (
          businessGroups.map((group) => {
            const owner =
              group.users.find(
                (u: any) => (u.workspace_role || u.role)?.toLowerCase() === "owner"
              ) ||
              group.users.find(
                (u: any) => (u.workspace_role || u.role)?.toLowerCase() === "admin"
              ) ||
              group.users[0];
            const ownerEmail = owner?.email;

            return (
              <div
                key={group.id || "unassigned"}
                className="bg-card border border-border rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs hover:border-border/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Business Info: Logo, Name, Plan, Date & Owner Email */}
                <div className="flex items-center gap-3.5 min-w-0">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground text-base truncate">
                        {group.name}
                      </h3>
                      <PlanBadge plan={group.plan} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {group.currentPeriodEnd ? (
                        <span>
                          Renewal:{" "}
                          {new Date(group.currentPeriodEnd).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : owner?.created_at ? (
                        <span>
                          Joined:{" "}
                          {new Date(owner.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : null}
                      {ownerEmail && (
                        <>
                          <span>•</span>
                          <span className="text-foreground/90 font-medium">{ownerEmail}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Business Controls */}
                {group.id && (
                  <div className="flex items-center gap-2 flex-wrap shrink-0 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleOpenChangePlan(group)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
                      title="Change subscription plan"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Change plan</span>
                    </button>

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
                      title="View full business details and team members"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View business</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>      {/* VIEW BUSINESS DETAILS MODAL */}
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Assign New Role
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((r) => {
                    const isSelected = selectedNewRole === r.value;
                    return (
                      <div
                        key={r.value}
                        onClick={() => setSelectedNewRole(r.value)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "border-brand-500 bg-brand-500/10 text-foreground"
                            : "border-border hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div className="font-bold text-foreground text-sm flex items-center justify-between">
                          <span>{r.label}</span>
                          {isSelected && <span className="text-brand-500">✓</span>}
                        </div>
                        <p className="text-[11px] mt-0.5">{r.description}</p>
                      </div>
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
                  <span>Save Role</span>
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
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <UserMinus className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">Remove Team Member?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Are you sure you want to remove <span className="font-semibold text-foreground">{removeMemberTarget.user.full_name || removeMemberTarget.user.email}</span> from <span className="font-semibold text-foreground">{removeMemberTarget.businessName}</span>?
              </p>
              <p className="text-[11px] text-muted-foreground mt-2 bg-muted/30 p-2.5 rounded-xl border border-border">
                Their personal account will remain intact, but they will immediately lose access to this workspace's invoices, clients, and records.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
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
                className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
              >
                {removeSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Remove Member</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN CHANGE MODAL */}
      {selectedSub && (
        <PlanChangeModal
          isOpen={!!selectedSub}
          subscription={selectedSub}
          allPlans={allPlans}
          onClose={() => setSelectedSub(null)}
          onSuccess={() => {
            setSelectedSub(null);
            showToast("Plan changed successfully");
            router.refresh();
          }}
        />
      )}

      {/* BAN USER MODAL */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Ban User</h3>
              <button
                type="button"
                onClick={() => setBanModalUser(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to ban <span className="font-semibold text-foreground">{banModalUser.email}</span>? They will be immediately blocked from signing in.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Reason for ban (optional)
              </label>
              <textarea
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Violation of terms, suspicious activity..."
                className="w-full p-3 bg-background border border-border rounded-xl text-xs outline-none focus:border-brand-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setBanModalUser(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBan}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNBAN USER MODAL */}
      {unbanModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Unban User</h3>
              <button
                type="button"
                onClick={() => setUnbanModalUser(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Restore access for <span className="font-semibold text-foreground">{unbanModalUser.email}</span>? They will be permitted to log in again.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setUnbanModalUser(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnban}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
              >
                Confirm Unban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
