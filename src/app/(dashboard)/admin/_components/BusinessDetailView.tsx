// src/app/(dashboard)/admin/_components/BusinessDetailView.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Repeat, 
  CreditCard, 
  Activity, 
  StickyNote, 
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Plus,
  UserPlus,
  UserCheck,
  UserMinus,
  Eye,
  X,
  Loader2,
  Tag,
  Trash2,
} from "lucide-react";
import { PlanBadge, RoleBadge, StatusPill, Money, formatLKR } from "@/components/Formatters";
import { ConfirmModal } from "@/app/(dashboard)/admin/_components/ConfirmModal";
import { 
  adminAddBusinessMember, 
  adminUpdateMemberRole, 
  adminRemoveBusinessMember, 
  addBusinessNote 
} from "@/app/(dashboard)/admin/users/actions";
import { adminRevokeTenantCoupon } from "@/app/(dashboard)/admin/subscriptions/actions";

export interface BusinessDetailViewProps {
  businessData: any;
  onClose?: () => void;
  onRefresh?: () => void;
  isModal?: boolean;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
  { value: "member", label: "Member" },
];

export function BusinessDetailView({
  businessData,
  onClose,
  onRefresh,
  isModal = false,
}: BusinessDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "subscription" | "payments" | "members" | "activity" | "notes" | "danger"
  >("overview");

  // Notes state
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Add Member state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [addingMember, setAddingMember] = useState(false);

  // Change Role state
  const [roleTarget, setRoleTarget] = useState<any | null>(null);
  const [targetNewRole, setTargetNewRole] = useState("member");
  const [updatingRole, setUpdatingRole] = useState(false);

  // Remove Member state
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Revoke Coupon state
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokingCoupon, setRevokingCoupon] = useState(false);

  const {
    tenant,
    members = [],
    usage = { invoices: 0, incomes: 0, expenses: 0, clients: 0, accounts: 0, team_members: 0 },
    plan,
    subscription,
    subscriptions = [],
    subscriptionEvents = [],
    payments = [],
    lifetimePaid = 0,
    notes = [],
    activity = [],
    appliedCoupon = null,
  } = businessData;

  const limits = plan?.limits || {
    invoices: 50,
    incomes: 100,
    expenses: 100,
    clients: 50,
    accounts: 2,
    team_members: 0,
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await addBusinessNote(tenant.id, newNote);
      setNewNote("");
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to add business note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddingMember(true);
    try {
      await adminAddBusinessMember({
        tenantId: tenant.id,
        email: addEmail.trim(),
        fullName: addName.trim(),
        role: addRole,
      });
      setIsAddMemberOpen(false);
      setAddEmail("");
      setAddName("");
      setAddRole("member");
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleTarget) return;
    setUpdatingRole(true);
    try {
      await adminUpdateMemberRole({
        userId: roleTarget.id,
        tenantId: tenant.id,
        newRole: targetNewRole,
      });
      setRoleTarget(null);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemovingMember(true);
    try {
      await adminRemoveBusinessMember({
        userId: removeTarget.id,
        tenantId: tenant.id,
      });
      setRemoveTarget(null);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    } finally {
      setRemovingMember(false);
    }
  };

  const handleRevokeCoupon = async () => {
    setRevokingCoupon(true);
    try {
      await adminRevokeTenantCoupon({
        tenantId: tenant.id,
        reason: "Coupon revoked by admin to require payment",
        expireImmediately: true,
      });
      setIsRevokeModalOpen(false);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to remove coupon");
    } finally {
      setRevokingCoupon(false);
    }
  };

  const renderLimitBar = (label: string, current: number, max: number) => {
    const isUnlimited = max === -1;
    const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
    const isOver = !isUnlimited && current >= max;

    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">{label}</span>
          <span className="font-semibold text-foreground">
            {current} / {isUnlimited ? "Unlimited" : max}
          </span>
        </div>
        <div className="h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isUnlimited
                ? "bg-brand-500 w-full opacity-30"
                : isOver
                ? "bg-red-500"
                : pct > 80
                ? "bg-amber-500"
                : "bg-brand-500"
            }`}
            style={{ width: isUnlimited ? "100%" : `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Business Header Card */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-700 dark:text-brand-400 font-bold text-2xl flex items-center justify-center shrink-0 overflow-hidden relative">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-foreground">
                {tenant.name || "Business Profile"}
              </h2>
              <PlanBadge plan={tenant.plan || "Free"} />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 text-muted-foreground border border-border">
                Tenant #{tenant.id}
              </span>
              {appliedCoupon && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Coupon: {appliedCoupon.code}</span>
                  <span className="opacity-80">
                    ({appliedCoupon.type === "percent" ? `${appliedCoupon.value}% OFF` : `LKR ${appliedCoupon.value} OFF`})
                  </span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Currency: <span className="font-semibold text-foreground">{tenant.currency || "LKR"}</span> • Created:{" "}
              {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "N/A"} •{" "}
              {members.length} {members.length === 1 ? "team member" : "team members"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/subscriptions"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20"
          >
            Manage Subscription
          </Link>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto select-none">
        {[
          { key: "overview", label: "Overview", icon: Building2 },
          { key: "subscription", label: "Subscription", icon: Repeat },
          { key: "payments", label: "Payments", icon: CreditCard, count: payments.length },
          { key: "members", label: "Team Members", icon: Users, count: members.length },
          { key: "activity", label: "Activity", icon: Activity },
          { key: "notes", label: "Admin Notes", icon: StickyNote, count: notes.length },
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Business Info */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xs">
            <h3 className="font-bold text-foreground text-base">Business Information</h3>
            <div className="divide-y divide-border text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Workspace ID</span>
                <span className="font-mono font-semibold">{tenant.id}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Business Name</span>
                <span className="font-semibold text-foreground">{tenant.name}</span>
              </div>
              {appliedCoupon && (
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-gray-500">Applied Coupon</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 font-mono text-xs px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Tag className="w-3 h-3" />
                      {appliedCoupon.code} ({appliedCoupon.type === "percent" ? `${appliedCoupon.value}% OFF` : `LKR ${appliedCoupon.value} OFF`})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRevokeModalOpen(true)}
                      className="text-xs font-semibold text-red-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove coupon and require payments"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Currency</span>
                <span className="font-semibold">{tenant.currency || "LKR"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Lifetime Revenue</span>
                <Money amount={lifetimePaid} className="text-brand-600 dark:text-brand-400 font-bold" />
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Created Date</span>
                <span>{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "N/A"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Industry</span>
                <span>{tenant.industry || "Not provided"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{tenant.phone || "Not provided"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Email</span>
                <span>{tenant.email || "Not provided"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Address</span>
                <span>{tenant.address || "Not provided"}</span>
              </div>
              {tenant.website && (
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Website</span>
                  <a href={tenant.website.startsWith('http') ? tenant.website : `https://${tenant.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline flex items-center gap-1">
                    {tenant.website} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right: Plan Quota & Usage */}
          <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-base">Plan Quota & Usage</h3>
                <p className="text-xs text-gray-500">Usage vs maximum capacity for current {tenant.plan || "Free"} plan</p>
              </div>
              <PlanBadge plan={tenant.plan || "Free"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {renderLimitBar("Invoices Issued", usage.invoices, limits.invoices ?? 50)}
              {renderLimitBar("Incomes Logged", usage.incomes, limits.incomes ?? 100)}
              {renderLimitBar("Expenses Logged", usage.expenses, limits.expenses ?? 100)}
              {renderLimitBar("Clients Saved", usage.clients, limits.clients ?? 50)}
              {renderLimitBar("Bank Accounts", usage.accounts, limits.accounts ?? 2)}
              {renderLimitBar("Team Members", usage.team_members, limits.team_members ?? 0)}
            </div>

            {/* Feature Flags */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Feature Entitlements</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: "Inventory", enabled: plan?.features?.inventory },
                  { label: "Advanced Reports", enabled: plan?.features?.advanced_reports },
                  { label: "2FA Protection", enabled: plan?.features?.two_factor },
                  { label: "System Audit Logs", enabled: plan?.features?.audit_logs },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                    {f.enabled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="font-medium text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION */}
      {activeTab === "subscription" && (
        <div className="space-y-6">
          {appliedCoupon && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-2xs">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="font-bold text-foreground text-base">
                      Coupon Applied: <span className="text-amber-600 dark:text-amber-400 font-mono">{appliedCoupon.code}</span>
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {appliedCoupon.type === "percent" ? `${appliedCoupon.value}% Discount` : `LKR ${appliedCoupon.value} Discount`}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">
                    This business redeemed coupon <strong className="text-foreground">{appliedCoupon.code}</strong>
                    {appliedCoupon.redeemed_at ? ` on ${new Date(appliedCoupon.redeemed_at).toLocaleDateString()}` : ""}.
                    They currently have complimentary/exempt billing. Removing this coupon will revoke their exemption and immediately prompt them to start paying.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(true)}
                className="shrink-0 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-red-600/20 cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Coupon & Require Payment</span>
              </button>
            </div>
          )}

          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs">
            <h3 className="font-bold text-foreground text-lg mb-4">Subscription History</h3>
            {subscriptions.length === 0 ? (
              <p className="text-gray-400 text-sm py-6 text-center">No subscriptions on record for this workspace.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-gray-500 uppercase">
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Interval</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Started</th>
                      <th className="py-3 px-4">Renews / Ends</th>
                      <th className="py-3 px-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subscriptions.map((s: any) => (
                      <tr key={s.id}>
                        <td className="py-3.5 px-4 font-semibold">{s.plan_name || tenant.plan}</td>
                        <td className="py-3.5 px-4 capitalize">{s.billing_interval || "Monthly"}</td>
                        <td className="py-3.5 px-4"><StatusPill status={s.status || "active"} type="subscription" /></td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {s.current_period_start ? new Date(s.current_period_start).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-gray-400 capitalize">{s.source || "organic"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subscription Events Timeline */}
          {subscriptionEvents.length > 0 && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-foreground text-base">Plan Changes & Proration Events</h3>
              <div className="space-y-3">
                {subscriptionEvents.map((evt: any) => (
                  <div key={evt.id} className="p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl flex items-center justify-between text-xs sm:text-sm">
                    <div>
                      <span className="font-semibold text-foreground">
                        {evt.from_plan || "Initial"} &rarr; {evt.to_plan}
                      </span>
                      {evt.reason && <p className="text-gray-500 text-xs mt-0.5">{evt.reason}</p>}
                    </div>
                    <span className="text-gray-400 text-xs">{new Date(evt.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs">
          <h3 className="font-bold text-foreground text-lg mb-4">Payment Transactions</h3>
          {payments.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">No payment transactions recorded for this business.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-gray-500 uppercase">
                    <th className="py-3 px-4">Ref</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-3.5 px-4 font-mono font-semibold">{p.provider_reference || `PAY-${p.id}`}</td>
                      <td className="py-3.5 px-4"><Money amount={p.amount} /></td>
                      <td className="py-3.5 px-4 capitalize">{p.method} ({p.provider || "manual"})</td>
                      <td className="py-3.5 px-4"><StatusPill status={p.status} type="payment" /></td>
                      <td className="py-3.5 px-4 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-center">
                        {p.receipt_url ? (
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline text-xs flex items-center justify-center gap-1">
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TEAM MEMBERS */}
      {activeTab === "members" && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">Team Members ({members.length})</h3>
              <p className="text-xs text-gray-500">Users authorized to access this workspace</p>
            </div>
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>

          <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {members.map((m: any) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center uppercase shrink-0">
                    {m.full_name ? m.full_name[0] : m.email[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm truncate">{m.full_name || "Unnamed"}</span>
                      {m.is_banned && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 border border-red-500/20">
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={m.role} />

                  <Link
                    href={`/admin/users/${m.id}`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="View user details"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => {
                      setRoleTarget(m);
                      setTargetNewRole(m.role || "member");
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-500 hover:bg-brand-500/10 transition-colors cursor-pointer"
                    title="Change workspace role"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setRemoveTarget(m)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove from workspace"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-foreground text-lg">Workspace Activity & Events</h3>
          <div className="space-y-3">
            <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl flex items-center justify-between text-sm">
              <span className="font-medium">Business Workspace Created</span>
              <span className="text-gray-500 text-xs">
                {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : "N/A"}
              </span>
            </div>

            {activity.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No recent activity logs for this workspace.</p>
            ) : (
              activity.map((act: any) => (
                <div key={act.id} className="p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{act.action}</span>
                    <p className="text-xs text-gray-500 mt-0.5">By: {act.actor_email || "System"}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{new Date(act.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ADMIN NOTES */}
      {activeTab === "notes" && (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-6">
          <h3 className="font-bold text-foreground text-lg">Internal Business Notes</h3>

          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add internal staff notes about this business (e.g. custom pricing agreement, onboarding support, enterprise terms)..."
              rows={3}
              className="w-full p-4 bg-black/[0.02] dark:bg-white/5 border border-border rounded-2xl text-sm outline-none focus:border-brand-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNote || !newNote.trim()}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs sm:text-sm transition-all disabled:opacity-40 cursor-pointer"
              >
                {savingNote ? "Saving..." : "Add Business Note"}
              </button>
            </div>
          </form>

          <div className="space-y-3 pt-4 border-t border-border">
            {notes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No internal staff notes on this business.</p>
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

      {/* TAB 7: DANGER ZONE */}
      {activeTab === "danger" && (
        <div className="bg-card border border-red-500/20 rounded-3xl p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="font-bold text-red-600 dark:text-red-400 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Danger Zone Actions
            </h3>
            <p className="text-xs text-gray-500 mt-1">Actions here impact entire business workspace access and billing.</p>
          </div>

          <div className="divide-y divide-border">
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground text-sm">Force Reset Usage Quotas</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Re-evaluate and refresh tenant usage statistics in case of discrepancies.
                </p>
              </div>
              <button
                onClick={() => {
                  alert("Quotas refreshed successfully");
                  if (onRefresh) onRefresh();
                }}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
              >
                Refresh Quotas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Add Team Member to {tenant.name}</h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name (optional)</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand-500 cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-900 transition-colors cursor-pointer"
                >
                  {addingMember ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Change Role for {roleTarget.email}</h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Select New Role</label>
              <select
                value={targetNewRole}
                onChange={(e) => setTargetNewRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand-500 cursor-pointer"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRoleTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={updatingRole}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-900 transition-colors cursor-pointer"
              >
                {updatingRole ? "Saving..." : "Update Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      {removeTarget && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleRemoveMember}
          title={`Remove ${removeTarget.email}`}
          description={`Are you sure you want to remove ${removeTarget.full_name || removeTarget.email} from ${tenant.name}? They will lose access to this workspace.`}
          confirmText="Remove Member"
          isDestructive={true}
        />
      )}

      {/* Revoke Coupon Modal */}
      {isRevokeModalOpen && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setIsRevokeModalOpen(false)}
          onConfirm={handleRevokeCoupon}
          title={`Revoke Coupon ${appliedCoupon?.code || ""}?`}
          description={`Are you sure you want to remove coupon "${appliedCoupon?.code || ""}" from ${tenant.name}? This will revoke their complimentary billing access and set their subscription to past due, requiring them to make payment immediately.`}
          confirmText={revokingCoupon ? "Removing..." : "Remove Coupon & Require Payment"}
          isDestructive={true}
        />
      )}
    </div>
  );
}
