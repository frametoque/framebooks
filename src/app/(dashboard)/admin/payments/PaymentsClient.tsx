// src/app/(dashboard)/admin/payments/PaymentsClient.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Download, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RotateCcw, 
  Eye, 
  Plus, 
  Building2,
  CheckCircle2,
  FileText,
  ExternalLink,
  Calendar,
  X,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Money, StatusPill, PlanBadge, formatLKR } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { approvePayment, rejectPayment, createManualPayment } from "./actions";

export function PaymentsClient({
  initialData,
  summary,
  searchParams,
  allPlans,
  allTenants = [],
}: {
  initialData: any;
  summary: any;
  searchParams: any;
  allPlans: any[];
  allTenants?: any[];
}) {
  const router = useRouter();
  const [approveModalPay, setApproveModalPay] = useState<any | null>(null);
  const [approvePeriod, setApprovePeriod] = useState<string>("1_month");
  const [approveCustomMonths, setApproveCustomMonths] = useState<number>(1);
  const [approveNotes, setApproveNotes] = useState<string>("");
  const [approving, setApproving] = useState<boolean>(false);

  const [rejectModalPay, setRejectModalPay] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState<boolean>(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusToast, setStatusToast] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Manual payment form state
  const [selectedTenantId, setSelectedTenantId] = useState<number | "">(
    allTenants.length > 0 ? allTenants[0].id : ""
  );
  const [newAmount, setNewAmount] = useState(2500);
  const [newMethod, setNewMethod] = useState("bank_transfer");
  const [newPlanKey, setNewPlanKey] = useState("pro");
  const [newDuration, setNewDuration] = useState("1_month");
  const [newCustomMonths, setNewCustomMonths] = useState(1);
  const [newRef, setNewRef] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Preview slip modal state
  const [previewSlip, setPreviewSlip] = useState<{ url: string; ref?: string; tenant?: string } | null>(null);

  const { payments, totalCount, totalPages, page } = initialData;

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    params.set("page", "1");
    router.push(`/admin/payments?${params.toString()}`);
  };

  const exportCSV = () => {
    const headers = ["ID", "Reference", "Email", "Workspace", "Plan", "Amount", "Method", "Status", "Date"];
    const csvContent = [
      headers.join(","),
      ...payments.map((p: any) =>
        [
          p.id,
          `"${p.provider_reference || ''}"`,
          `"${p.user_email || ''}"`,
          `"${p.tenant_name || ''}"`,
          `"${p.plan_name || ''}"`,
          p.amount,
          p.method,
          p.status,
          `"${new Date(p.created_at).toISOString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) {
      alert("Please select a tenant/workspace.");
      return;
    }
    setSubmitting(true);
    try {
      await createManualPayment({
        tenantId: Number(selectedTenantId),
        planKey: newPlanKey,
        amount: Number(newAmount),
        period: newDuration,
        monthsCount: newDuration === "custom" ? Number(newCustomMonths) : undefined,
        method: newMethod,
        providerReference: newRef || undefined,
        receiptUrl: newReceiptUrl || undefined,
        notes: newNotes || undefined,
        isPaid: true,
      });
      setCreateModalOpen(false);
      setNewRef("");
      setNewReceiptUrl("");
      setNewNotes("");
      setStatusToast("Manual payment recorded & subscription extended");
      setTimeout(() => setStatusToast(""), 3500);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Couldn't record payment. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModalPay) return;
    setApproving(true);
    try {
      await approvePayment(approveModalPay.id, {
        period: approvePeriod,
        monthsCount: approvePeriod === "custom" ? Number(approveCustomMonths) : undefined,
        notes: approveNotes || undefined,
      });
      setStatusToast("Payment approved and subscription activated!");
      setTimeout(() => setStatusToast(""), 3500);
      setApproveModalPay(null);
      setApproveNotes("");
      setApprovePeriod("1_month");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to approve payment.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalPay) return;
    setRejecting(true);
    try {
      await rejectPayment(rejectModalPay.id, rejectReason || "Declined by admin");
      setStatusToast("Payment declined.");
      setTimeout(() => setStatusToast(""), 3500);
      setRejectModalPay(null);
      setRejectReason("");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to decline payment.");
    } finally {
      setRejecting(false);
    }
  };

  const activeStatusFilter = searchParams.status || "all";

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Top of Page: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Paid volume"
          value={summary.totalPaid}
          unit="LKR"
          icon={CreditCard}
          iconBg="bg-emerald-100/80 dark:bg-emerald-400/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
        />

        <AdminStatCard
          label="Pending review"
          value={summary.totalPending}
          unit="LKR"
          icon={Clock}
          iconBg="bg-amber-100/80 dark:bg-amber-400/10"
          iconColor="text-amber-700 dark:text-amber-400"
        />

        <AdminStatCard
          label="Failed"
          value={summary.totalFailed}
          unit="LKR"
          icon={XCircle}
          iconBg="bg-rose-100/80 dark:bg-rose-400/10"
          iconColor="text-rose-700 dark:text-rose-400"
        />

        <AdminStatCard
          label="Refunded"
          value={summary.totalRefunded}
          unit="LKR"
          icon={RotateCcw}
          iconBg="bg-purple-100/80 dark:bg-purple-400/10"
          iconColor="text-purple-700 dark:text-purple-400"
        />
      </div>

      {/* Filter Chips & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "paid", label: "Paid" },
            { key: "failed", label: "Failed" },
            { key: "refunded", label: "Refunded" },
          ].map((f) => {
            const active = activeStatusFilter.toLowerCase() === f.key.toLowerCase();
            return (
              <button
                key={f.key}
                onClick={() => updateFilters({ status: f.key === "all" ? null : f.key })}
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
              placeholder="Search reference or email..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-full text-xs sm:text-sm outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record payment</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-card hover:bg-muted/50 border border-border rounded-full text-foreground transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th className="p-4">Reference</th>
                <th className="p-4">Workspace</th>
                <th className="p-4">Plan</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">
                    No payments yet
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-mono text-xs font-semibold text-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{p.provider_reference || `PAY-${p.id}`}</span>
                        {p.receipt_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewSlip({ url: p.receipt_url, ref: p.provider_reference, tenant: p.tenant_name })}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30 hover:bg-brand-500/25 transition-colors cursor-pointer"
                            title="View customer payment slip"
                          >
                            Slip
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-foreground">{p.tenant_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.user_email || "—"}</div>
                    </td>

                    <td className="p-4">
                      <PlanBadge plan={p.plan_name} />
                    </td>

                    <td className="p-4 font-bold text-foreground">
                      {formatLKR(p.amount)}
                    </td>

                    <td className="p-4 capitalize text-xs text-muted-foreground">
                      {p.method ? p.method.replace("_", " ") : "Card"}
                    </td>

                    <td className="p-4">
                      <StatusPill status={p.status} />
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/payments/${p.id}`}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {p.status === "pending" && (
                          <>
                            <button
                              onClick={() => {
                                setApproveModalPay(p);
                                setApprovePeriod("1_month");
                                setApproveNotes("");
                              }}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="Approve & set time period"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectModalPay(p);
                                setRejectReason("");
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Decline"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Record Manual Payment</h3>
                <p className="text-xs text-muted-foreground">Select tenant, plan, and time period to activate</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Tenant / Business Workspace <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedTenantId}
                  onChange={(e) => {
                    const tid = Number(e.target.value);
                    setSelectedTenantId(tid);
                    const t = allTenants.find((item: any) => item.id === tid);
                    if (t?.plan) {
                      const matchPlan = allPlans.find((p: any) => p.name.toLowerCase() === t.plan.toLowerCase());
                      if (matchPlan) {
                        setNewPlanKey(matchPlan.key);
                        setNewAmount(matchPlan.price_monthly || 2500);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="">-- Choose Tenant Workspace --</option>
                  {allTenants.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (ID #{t.id} • Current: {t.plan || "Free"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Plan
                  </label>
                  <select
                    value={newPlanKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setNewPlanKey(key);
                      const pl = allPlans.find((p: any) => p.key === key);
                      if (pl) {
                        setNewAmount(pl.price_monthly || 2500);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {allPlans.map((pl) => (
                      <option key={pl.id} value={pl.key}>
                        {pl.name} ({formatLKR(pl.price_monthly)}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Amount (LKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Subscription Duration / Time Period <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { val: "1_month", label: "1 Month" },
                    { val: "2_months", label: "2 Months" },
                    { val: "3_months", label: "3 Months" },
                    { val: "6_months", label: "6 Months" },
                    { val: "1_year", label: "1 Year" },
                  ].map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setNewDuration(t.val)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                        newDuration === t.val
                          ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400 ring-1 ring-brand-500"
                          : "bg-background border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setNewDuration("custom")}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      newDuration === "custom"
                        ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    Custom Months
                  </button>
                  {newDuration === "custom" && (
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={newCustomMonths}
                      onChange={(e) => setNewCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold outline-none focus:border-brand-500"
                      placeholder="Months"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Payment Method
                  </label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card / Online</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="manual">Manual Admin Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Reference number (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-12345 or CHEQUE-99"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Payslip Image URL (optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newReceiptUrl}
                  onChange={(e) => setNewReceiptUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved by financial officer"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedTenantId}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Activate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Payment Modal with Time Period Selection */}
      {approveModalPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Approve Payment</h3>
                <p className="text-xs text-muted-foreground">Verify payment and set subscription duration</p>
              </div>
              <button
                type="button"
                onClick={() => setApproveModalPay(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Summary */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Tenant / Business:</span>
                <span className="font-bold text-foreground">{approveModalPay.tenant_name || "—"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">User Email:</span>
                <span className="text-foreground">{approveModalPay.user_email || "—"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Plan:</span>
                <PlanBadge plan={approveModalPay.plan_name} />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Amount Received:</span>
                <span className="font-bold text-foreground text-sm">{formatLKR(approveModalPay.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Reference:</span>
                <span className="font-mono text-muted-foreground">{approveModalPay.provider_reference}</span>
              </div>
            </div>

            {/* Slip Preview if available */}
            {approveModalPay.receipt_url && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground">Uploaded Payslip</span>
                  <a
                    href={approveModalPay.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open full slip</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="w-full h-44 rounded-2xl border border-border overflow-hidden bg-background relative flex items-center justify-center group">
                  {approveModalPay.receipt_url.endsWith(".pdf") ? (
                    <div className="flex flex-col items-center gap-2 p-4 text-muted-foreground">
                      <FileText className="w-10 h-10 text-brand-500" />
                      <span className="text-xs font-medium">PDF Payslip Document</span>
                    </div>
                  ) : (
                    <img
                      src={approveModalPay.receipt_url}
                      alt="Uploaded payslip"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Time Period Selection */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Set Subscription Time Period *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { val: "1_month", label: "1 Month" },
                  { val: "2_months", label: "2 Months" },
                  { val: "3_months", label: "3 Months" },
                  { val: "6_months", label: "6 Months" },
                  { val: "1_year", label: "1 Year" },
                ].map((t) => (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setApprovePeriod(t.val)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      approvePeriod === t.val
                        ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400 ring-1 ring-brand-500"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setApprovePeriod("custom")}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    approvePeriod === "custom"
                      ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  Custom Months
                </button>
                {approvePeriod === "custom" && (
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={approveCustomMonths}
                    onChange={(e) => setApproveCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold outline-none focus:border-brand-500"
                    placeholder="Months"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Admin Approval Notes (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Bank slip verified on portal"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setApproveModalPay(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors shadow-xs cursor-pointer"
              >
                {approving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Approve & Activate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      {rejectModalPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Decline Payment</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to decline {formatLKR(rejectModalPay.amount)} deposit for <strong className="text-foreground">{rejectModalPay.tenant_name || rejectModalPay.user_email}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Reason for decline
              </label>
              <input
                type="text"
                placeholder="e.g. Unreadable bank slip, amount mismatch"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRejectModalPay(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                {rejecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Decline payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Slip Modal */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Customer Payment Slip</h3>
                <p className="text-xs text-muted-foreground">
                  {previewSlip.tenant} • {previewSlip.ref}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewSlip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewSlip(null)}
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="w-full max-h-[70vh] overflow-auto rounded-2xl border border-border bg-background flex items-center justify-center p-2">
              {previewSlip.url.endsWith(".pdf") ? (
                <iframe src={previewSlip.url} className="w-full h-[60vh] rounded-xl" title="Payslip" />
              ) : (
                <img src={previewSlip.url} alt="Payment slip" className="max-w-full max-h-[65vh] object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
