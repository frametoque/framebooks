"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Minus, Trash2, Search, Camera, AlertCircle, CheckCircle2, ArrowRightLeft, Loader2 } from "lucide-react";
import { editPosOrderAction, CartItem } from "@/app/(dashboard)/pos/actions/sales";
import { loadStockProductsAction } from "@/app/(dashboard)/pos/actions/stock";
import { CameraScannerModal } from "./CameraScannerModal";
import { playScanSound } from "./useHardwareBarcodeScanner";

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  onOrderUpdated: () => void;
}

export function EditOrderModal({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
}: EditOrderModalProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [reason, setReason] = useState("Customer changed item / exchange");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Product search / exchange state
  const [productSearch, setProductSearch] = useState("");
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      const parsedItems: CartItem[] = Array.isArray(order.items)
        ? JSON.parse(JSON.stringify(order.items))
        : typeof order.items_json === "string"
        ? JSON.parse(order.items_json)
        : Array.isArray(order.items_json)
        ? JSON.parse(JSON.stringify(order.items_json))
        : [];

      setItems(parsedItems);
      setReason("Customer changed item / exchange");
      setErrorMsg(null);
      setProductSearch("");
      setSearchResults([]);
    }
  }, [order, isOpen]);

  // Product search query
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const res = await loadStockProductsAction({ search: productSearch.trim(), limit: 6 });
        if (res.success && Array.isArray(res.items)) {
          setSearchResults(res.items);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error("Error searching stock products:", err);
      } finally {
        setSearchingProducts(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearch]);

  if (!isOpen || !order) return null;

  const originalTotal = parseFloat(order.total_amount || 0);
  const newSubtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);

  // Scale discount proportionally if original had a discount
  const oldSubtotal = parseFloat(order.subtotal || 0);
  const oldDiscount = parseFloat(order.discount_amount || 0);
  let newDiscount = 0;
  if (oldSubtotal > 0 && oldDiscount > 0) {
    const ratio = oldDiscount / oldSubtotal;
    newDiscount = Math.round(newSubtotal * ratio * 100) / 100;
  }

  // Scale tax proportionally
  const oldTax = parseFloat(order.tax_amount || 0);
  let newTax = 0;
  if (oldSubtotal > 0 && oldTax > 0) {
    const taxable = Math.max(0, newSubtotal - newDiscount);
    const oldTaxable = Math.max(0, oldSubtotal - oldDiscount);
    const taxRatio = oldTax / (oldTaxable || 1);
    newTax = Math.round(taxable * taxRatio * 100) / 100;
  }

  const newTotal = Math.max(0, Math.round((newSubtotal - newDiscount + newTax) * 100) / 100);
  const diff = Math.round((newTotal - originalTotal) * 100) / 100;

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg("Order must contain at least one item. If all items are returned, use the Refund button instead.");
      return;
    }
    setErrorMsg(null);
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProduct = (prod: any) => {
    playScanSound('beep');
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => Number(it.id) === Number(prod.id));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: (Number(copy[existingIdx].quantity) || 0) + 1,
        };
        return copy;
      }

      const newItem: CartItem = {
        id: Number(prod.id),
        name: prod.item_name,
        sku: prod.sku || "",
        price: parseFloat(prod.selling_price || 0),
        costPrice: parseFloat(prod.cost_price || 0),
        quantity: 1,
        category: prod.category || "",
        unit: prod.unit || "unit",
      };
      return [...prev, newItem];
    });

    setProductSearch("");
    setSearchResults([]);
  };

  const handleCameraScanDetected = async (code: string) => {
    setIsCameraOpen(false);
    playScanSound('beep');
    try {
      const res = await loadStockProductsAction({ search: code.trim(), limit: 1 });
      if (res.success && res.items && res.items.length > 0) {
        handleAddProduct(res.items[0]);
      } else {
        setErrorMsg(`No product found with barcode: ${code}`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to find product by scanned barcode.");
    }
  };

  const handleSave = async () => {
    if (items.length === 0) {
      setErrorMsg("Order cannot be empty. Please use Refund if the customer returned everything.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await editPosOrderAction(order.id, items, reason);
      if (res.success) {
        if (typeof window !== "undefined") {
          import("@/lib/pos/product-sync-events")
            .then((m) =>
              m.broadcastStockUpdated({
                source: "pos_edit",
                orderNumber: order.order_number,
                items: res.updatedStockItems,
              })
            )
            .catch(() => {});
        }
        onOrderUpdated();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to update order.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred while updating order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Edit Order Items</h3>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                  {order.order_number}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Modify quantities or replace single items without refunding the entire bill
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-500 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Item List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Order Items ({items.length})
              </span>
              <span className="text-xs text-gray-400">
                Customer: <strong className="text-foreground">{order.customer_name || "Walk-in Customer"}</strong>
              </span>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-black/5 dark:bg-white/[0.02]">
              {items.map((item, idx) => {
                const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                return (
                  <div key={`${item.id}-${idx}`} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{item.name}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        <span>•</span>
                        <span>Unit: LKR {formatLKR(item.price)}</span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-6 h-6 rounded-lg bg-card hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) handleUpdateQty(idx, val);
                        }}
                        className="w-10 text-center bg-transparent text-xs font-bold text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-card hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line total */}
                    <div className="text-right min-w-[90px]">
                      <div className="text-xs font-bold text-foreground">LKR {formatLKR(lineTotal)}</div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Remove item from bill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add / Exchange Product Section */}
          <div className="p-4 rounded-2xl border border-border bg-black/5 dark:bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>Add / Exchange Product</span>
              </span>
              <span className="text-[11px] text-gray-400">Search catalog or scan replacement item barcode</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type product name, SKU or barcode to add..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground outline-none focus:border-brand-500"
                />
                {searchingProducts && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-gray-300 font-semibold text-xs flex items-center gap-1.5"
                title="Scan product barcode with camera"
              >
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {/* Search dropdown results */}
            {searchResults.length > 0 && (
              <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleAddProduct(prod)}
                    className="p-2.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">{prod.item_name}</div>
                      <div className="text-[10px] text-gray-400">
                        SKU: {prod.sku || "N/A"} • Stock: {prod.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-foreground">
                        LKR {formatLKR(prod.selling_price)}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-400 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Calculation & Net Difference Box */}
          <div className="p-4 rounded-2xl border border-border bg-black/10 dark:bg-white/[0.03] space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 text-[11px]">Original Total:</span>
                <div className="font-bold text-foreground mt-0.5">LKR {formatLKR(originalTotal)}</div>
              </div>
              <div className="text-right">
                <span className="text-gray-400 text-[11px]">New Total:</span>
                <div className="font-bold text-foreground mt-0.5">LKR {formatLKR(newTotal)}</div>
              </div>
            </div>

            {/* Financial Delta Badge */}
            <div className="pt-2 border-t border-border">
              {diff < 0 ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      Customer Refund Due
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Refund the difference to customer & restored stock is returned to inventory
                    </div>
                  </div>
                  <div className="text-sm font-black text-emerald-400">
                    LKR {formatLKR(Math.abs(diff))}
                  </div>
                </div>
              ) : diff > 0 ? (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                      Additional Payment Due
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Collect additional payment from customer for added / higher-value item
                    </div>
                  </div>
                  <div className="text-sm font-black text-sky-400">
                    + LKR {formatLKR(diff)}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Even Exchange
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Items exchanged with identical total value. No cash refund or extra charge.
                    </div>
                  </div>
                  <div className="text-xs font-bold text-gray-400">
                    LKR 0.00
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reason for Modification */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Reason for Modification / Exchange:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Size exchange, single item returned, quantity corrected"
              className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-black/5 dark:bg-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-300 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 flex items-center gap-1.5 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Bill & Stock...</span>
              </>
            ) : (
              <span>Save & Update Bill</span>
            )}
          </button>
        </div>

        {/* Camera Scanner for replacement barcode scan */}
        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onDetected={handleCameraScanDetected}
          title="Scan Product Barcode to Exchange or Add"
        />
      </div>
    </div>
  );
}
