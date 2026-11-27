"use client";

import React, { useState, useEffect } from "react";
import { History, Search, RefreshCw, X, Receipt, RotateCcw, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { loadPosOrdersAction, refundPosOrderAction, voidPosOrderAction } from "@/app/(dashboard)/pos/actions/sales";
import { ReceiptModal } from "./ReceiptModal";

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  canRefund?: boolean;
  canVoid?: boolean;
  tenantName?: string;
  customLayout?: { id: string; name: string; definition: any } | null;
  receiptHeader?: string;
  receiptFooter?: string;
}

export function OrderHistoryModal({
  isOpen,
  onClose,
  canRefund = false,
  canVoid = false,
  tenantName = "Framebooks Store",
  customLayout = null,
  receiptHeader = "",
  receiptFooter = "Thank you for your purchase!",
}: OrderHistoryModalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen, search]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await loadPosOrdersAction({ search, limit: 50 });
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
      } else if (res.error) {
        console.error("loadPosOrdersAction error:", res.error);
      }
    } catch (e) {
      console.error("loadOrders exception:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (orderId: number, orderNum: string) => {
    const reason = prompt(`Refund order #${orderNum}?\nEnter reason:`, "Customer return");
    if (!reason) return;

    setActionInProgress(orderId);
    try {
      const res = await refundPosOrderAction(orderId, reason);
      if (res.success) {
        setToastMsg({ type: 'success', text: `Order #${orderNum} has been refunded and stock restored.` });
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated({
          source: 'pos_refund',
          orderNumber: orderNum,
          items: (res as any).restoredItems,
        })).catch(() => {});
        await loadOrders();
      } else {
        setToastMsg({ type: 'error', text: res.error || "Failed to refund order." });
      }
    } catch (e: any) {
      setToastMsg({ type: 'error', text: e.message || "Failed to refund order." });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleVoid = async (orderId: number, orderNum: string) => {
    const reason = prompt(`Void order #${orderNum}?\nEnter reason:`, "Voided transaction");
    if (!reason) return;

    setActionInProgress(orderId);
    try {
      const res = await voidPosOrderAction(orderId, reason);
      if (res.success) {
        setToastMsg({ type: 'success', text: `Order #${orderNum} has been voided and stock restored.` });
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated({
          source: 'pos_void',
          orderNumber: orderNum,
          items: (res as any).restoredItems,
        })).catch(() => {});
        await loadOrders();
      } else {
        setToastMsg({ type: 'error', text: res.error || "Failed to void order." });
      }
    } catch (e: any) {
      setToastMsg({ type: 'error', text: e.message || "Failed to void order." });
    } finally {
      setActionInProgress(null);
    }
  };

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col relative h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <h2 className="text-base font-bold text-foreground">POS Sales History & Orders</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-border bg-card flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-foreground outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={loadOrders}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-gray-400 hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              toastMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}
          >
            <span>{toastMsg.text}</span>
            <button onClick={() => setToastMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Orders Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Loading transactions...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 text-xs">
              <History className="w-8 h-8 mb-2 opacity-40" />
              <span>No POS orders found.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="text-gray-400 font-semibold uppercase">
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-4 whitespace-nowrap z-10">Order #</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-3 whitespace-nowrap z-10">Date & Time</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-3 whitespace-nowrap z-10">Customer</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-3 whitespace-nowrap z-10">Method</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-3 text-right whitespace-nowrap z-10">Total</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-3 text-center whitespace-nowrap z-10">Status</th>
                  <th className="sticky top-0 bg-card border-b border-border py-3 px-4 text-right whitespace-nowrap z-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {ord.order_number}
                    </td>
                    <td className="py-3.5 px-3 text-gray-400">
                      {new Date(ord.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-foreground">
                      {ord.customer_name}
                    </td>
                    <td className="py-3.5 px-3 text-gray-400">
                      {ord.payment_method}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-foreground">
                      LKR {formatLKR(ord.total_amount)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ord.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : ord.status === "refunded"
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-red-500/15 text-red-500"
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="px-2.5 py-1 rounded-lg border border-border hover:bg-black/5 dark:hover:bg-white/5 text-gray-300 font-semibold text-[11px] flex items-center gap-1"
                          title="View receipt"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>

                        {ord.status === "completed" && canRefund && (
                          <button
                            onClick={() => handleRefund(ord.id, ord.order_number)}
                            disabled={actionInProgress === ord.id}
                            className="px-2 py-1 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-semibold text-[11px] flex items-center gap-1"
                            title="Refund items and restore stock"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Refund</span>
                          </button>
                        )}

                        {ord.status === "completed" && canVoid && (
                          <button
                            onClick={() => handleVoid(ord.id, ord.order_number)}
                            disabled={actionInProgress === ord.id}
                            className="px-2 py-1 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 font-semibold text-[11px] flex items-center gap-1"
                            title="Void order and cancel invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Void</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Receipt sub-modal */}
        <ReceiptModal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          tenantName={tenantName}
          customLayout={customLayout}
          receiptHeader={receiptHeader}
          receiptFooter={receiptFooter}
        />
      </div>
    </div>
  );
}
