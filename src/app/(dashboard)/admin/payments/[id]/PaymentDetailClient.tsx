// src/app/(dashboard)/admin/payments/[id]/PaymentDetailClient.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  CreditCard, 
  Building2, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  FileText, 
  ExternalLink,
  Calendar,
  Clock,
  ArrowRight
} from "lucide-react";
import { Money, StatusPill, PlanBadge, formatLKR } from "@/components/Formatters";
import { ConfirmModal } from "@/app/(dashboard)/admin/_components/ConfirmModal";
import { approvePayment, rejectPayment, refundPayment } from "../actions";

export function PaymentDetailClient({ data }: { data: any }) {
  const router = useRouter();
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [approvePeriod, setApprovePeriod] = useState("1_month");
  const [approveCustomMonths, setApproveCustomMonths] = useState(1);
  const [approveNotes, setApproveNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(data.payment.amount);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const { payment, refunds } = data;

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundReason.trim()) {
      alert("Please enter a refund reason.");
      return;
    }
    setRefunding(true);
    try {
      await refundPayment(payment.id, Number(refundAmount), refundReason.trim());
      setRefundOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to process refund");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Details Header Card */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">
              {payment.provider_reference || `PAY-${payment.id}`}
            </span>
            <StatusPill status={payment.status} type="payment" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Recorded on {new Date(payment.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {payment.status === "pending" && (
            <>
              <button
                onClick={() => setConfirmApprove(true)}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-brand-900 font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20"
              >
                Approve Payment
              </button>
              <button
                onClick={() => {
                  setConfirmReject(true);
                  setRejectReason("");
                }}
                className="px-4 py-2.5 bg-red-600/15 hover:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-500/30 font-bold rounded-xl text-sm transition-all"
              >
                Reject Slip
              </button>
            </>
          )}

          {(payment.status === "paid" || payment.status === "partially_refunded") && (
            <button
              onClick={() => {
                setRefundAmount(payment.amount);
                setRefundReason("");
                setRefundOpen(true);
              }}
              className="px-4 py-2.5 bg-purple-600/15 hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold rounded-xl text-sm transition-all"
            >
              Issue Refund
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transaction breakdown & Slip preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-base">Transaction Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-xs text-gray-500 block">Total Amount</span>
                <span className="text-2xl font-bold text-foreground mt-1 block">
                  <Money amount={payment.amount} />
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-xs text-gray-500 block">Plan Upgraded</span>
                <div className="mt-2">
                  <PlanBadge plan={payment.plan_name} />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-xs text-gray-500 block">Payment Method</span>
                <span className="font-semibold text-foreground capitalize mt-1 block">
                  {payment.method} ({payment.provider})
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-xs text-gray-500 block">Settled At</span>
                <span className="font-semibold text-foreground mt-1 block">
                  {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "Unsettled"}
                </span>
              </div>
            </div>

            {payment.notes && (
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border text-sm">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Notes / Audit Remarks
                </span>
                <p className="text-foreground/90 whitespace-pre-wrap">{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Receipt / Slip Preview Viewer */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-base">Payment Slip / Receipt Document</h3>
              {payment.receipt_url && (
                <a
                  href={payment.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  Open Full Screen <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {payment.receipt_url ? (
              <div className="rounded-2xl border border-border overflow-hidden bg-black/5 dark:bg-black/30 p-2 flex items-center justify-center min-h-[300px]">
                {payment.receipt_url.endsWith(".pdf") ? (
                  <iframe
                    src={payment.receipt_url}
                    className="w-full h-[500px] rounded-xl border-0"
                    title="PDF Receipt Preview"
                  />
                ) : (
                  <img
                    src={payment.receipt_url}
                    alt="Deposit Receipt"
                    className="max-h-[500px] w-auto object-contain rounded-xl shadow-md"
                  />
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 text-sm border border-dashed border-border rounded-2xl">
                No deposit slip or receipt was uploaded for this transaction.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Customer & Refunds */}
        <div className="space-y-6">
          {/* Customer / Workspace Information */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-base">Customer & Workspace</h3>
            <div className="divide-y divide-border text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Workspace</span>
                <span className="font-semibold text-foreground">{payment.tenant_name || "N/A"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Owner Email</span>
                <span className="text-foreground">{payment.user_email || "N/A"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Subscription Status</span>
                <StatusPill status={payment.subscription_status} type="subscription" />
              </div>
            </div>

            {payment.user_id && (
              <Link
                href={`/admin/users/${payment.user_id}`}
                className="block text-center w-full py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border rounded-xl text-xs font-semibold text-foreground transition-colors"
              >
                View Customer Profile →
              </Link>
            )}
          </div>

          {/* Refunds List */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-base">Refund Records</h3>
            {refunds.length === 0 ? (
              <p className="text-gray-400 text-xs py-3 text-center">No refunds issued for this payment.</p>
            ) : (
              <div className="space-y-2.5">
                {refunds.map((r: any) => (
                  <div key={r.id} className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-600 dark:text-red-400">
                        Refunded {formatLKR(r.amount)}
                      </span>
                      <span className="text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-500 italic">"{r.reason}"</p>
                    <span className="text-[10px] text-gray-400 block">By: {r.processed_by}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve Modal with Time Period Selection */}
      {confirmApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-foreground">
              Approve Payment of {formatLKR(payment.amount)}
            </h3>
            <p className="text-xs text-muted-foreground">
              Verify transaction and set subscription extension period for <strong className="text-foreground">{payment.tenant_name || payment.user_email}</strong>.
            </p>

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
                Approval Notes (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Bank slip verified on statement"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmApprove(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={async () => {
                  setApproving(true);
                  try {
                    await approvePayment(payment.id, {
                      period: approvePeriod,
                      monthsCount: approvePeriod === "custom" ? approveCustomMonths : undefined,
                      notes: approveNotes || undefined,
                    });
                    setConfirmApprove(false);
                    router.refresh();
                  } catch (err: any) {
                    alert(err.message || "Failed to approve payment");
                  } finally {
                    setApproving(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors shadow-xs cursor-pointer"
              >
                {approving ? "Approving..." : "Approve & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {confirmReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-foreground">Reject Payment Record</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to reject this payment of {formatLKR(payment.amount)}?
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

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmReject(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejecting}
                onClick={async () => {
                  setRejecting(true);
                  try {
                    await rejectPayment(payment.id, rejectReason || "Rejected via payment detail page");
                    setConfirmReject(false);
                    router.refresh();
                  } catch (err: any) {
                    alert(err.message || "Failed to reject payment");
                  } finally {
                    setRejecting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                {rejecting ? "Rejecting..." : "Reject Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-foreground mb-4">Process refund</h3>
            <form onSubmit={handleRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Amount (Max: {formatLKR(payment.amount)})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payment.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Double payment"
                  className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRefundOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding || !refundReason.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-purple-600/20 disabled:opacity-40"
                >
                  {refunding ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
