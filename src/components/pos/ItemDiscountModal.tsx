"use client";

import React, { useState, useEffect } from "react";
import { Percent, DollarSign, X, Check, Tag, ShieldCheck } from "lucide-react";
import { CartItem } from "@/app/(dashboard)/pos/actions/sales";

interface ItemDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CartItem | null;
  onApplyDiscount: (itemId: number, discount: number, discountType: 'percent' | 'fixed', reason?: string) => void;
  isCashier?: boolean;
}

export function ItemDiscountModal({
  isOpen,
  onClose,
  item,
  onApplyDiscount,
  isCashier = false,
}: ItemDiscountModalProps) {
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountVal, setDiscountVal] = useState<string>("0");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (item && isOpen) {
      setDiscountType(item.discountType || 'percent');
      setDiscountVal(item.discount ? item.discount.toString() : "0");
      setReason(item.discountReason || "");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, isOpen, onClose]);

  if (!isOpen || !item) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(discountVal) || 0;
    onApplyDiscount(item.id, val, discountType, reason.trim() || undefined);
    onClose();
  };

  const handleRemove = () => {
    onApplyDiscount(item.id, 0, 'percent', undefined);
    onClose();
  };

  const lineSubtotal = item.price * item.quantity;
  const numVal = parseFloat(discountVal) || 0;
  const computedDiscount = discountType === 'percent'
    ? (lineSubtotal * numVal) / 100
    : Math.min(lineSubtotal, numVal * item.quantity);
  const netLineTotal = Math.max(0, lineSubtotal - computedDiscount);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div>
            <h3 className="text-base font-bold text-foreground">Item Special Discount</h3>
            <p className="text-[11px] text-gray-400 truncate max-w-xs">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-6 space-y-4">
          {/* Cashier manager approval requirement notice */}
          {isCashier && (
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Manager access code authorization required for cashiers</span>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="p-3 bg-black/5 dark:bg-white/5 border border-border rounded-2xl flex items-center justify-between text-xs">
            <div>
              <div className="text-gray-400">Unit Price: LKR {item.price.toLocaleString()} × {item.quantity}</div>
              <div className="text-sm font-bold text-foreground">Line Subtotal: LKR {lineSubtotal.toLocaleString()}</div>
            </div>
            {numVal > 0 && (
              <div className="text-right">
                <div className="text-emerald-500 font-bold">-LKR {computedDiscount.toLocaleString()}</div>
                <div className="text-xs font-black text-brand-500">Net: LKR {netLineTotal.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Discount Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Discount Type
            </label>
            <div className="grid grid-cols-2 gap-2 bg-black/5 dark:bg-white/5 p-1 border border-border rounded-xl">
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  discountType === 'percent'
                    ? "bg-brand-500 text-brand-950 shadow-xs"
                    : "text-gray-400 hover:text-foreground"
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentage (%)</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  discountType === 'fixed'
                    ? "bg-brand-500 text-brand-950 shadow-xs"
                    : "text-gray-400 hover:text-foreground"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Fixed Amount (LKR)</span>
              </button>
            </div>
          </div>

          {/* Value Input and Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Discount Amount ({discountType === 'percent' ? '%' : 'LKR per unit'})
            </label>
            <input
              type="number"
              min="0"
              max={discountType === 'percent' ? 100 : item.price}
              step="any"
              value={discountVal}
              onChange={(e) => setDiscountVal(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-brand-500"
              autoFocus
            />

            {discountType === 'percent' && (
              <div className="flex gap-1.5 mt-2">
                {[5, 10, 15, 20, 25, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountVal(pct.toString())}
                    className="flex-1 py-1 rounded-lg bg-black/10 dark:bg-white/10 text-[11px] font-bold text-gray-300 hover:bg-brand-500 hover:text-brand-950 transition-colors cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason / Offer Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Offer Reason / Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. VIP Customer, Promotion, Damage Discount"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2.5">
            {item.discount ? (
              <button
                type="button"
                onClick={handleRemove}
                className="py-2.5 px-3 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Remove Discount
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 border border-border text-gray-400 hover:text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Cancel</span>
                <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
              </button>
              <button
                type="submit"
                className="py-2.5 px-5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isCashier ? "Authorize with Manager Code" : "Apply Discount"}</span>
                <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
