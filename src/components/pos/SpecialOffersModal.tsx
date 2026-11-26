"use client";

import React, { useState, useEffect } from "react";
import { Tag, Plus, Check, Trash2, X, AlertCircle, ShoppingBag, Layers, Percent, DollarSign, ToggleLeft, ToggleRight, Edit2, ShieldCheck } from "lucide-react";
import { PosPromotion, loadPosPromotionsAction, savePosPromotionAction, togglePosPromotionAction, deletePosPromotionAction } from "@/app/(dashboard)/pos/actions/promotions";
import { StockItem } from "@/lib/pos/stock-service";
import { CartItem } from "@/app/(dashboard)/pos/actions/sales";

interface SpecialOffersModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: StockItem[];
  cart: CartItem[];
  appliedPromotionIds: number[];
  onToggleApplyPromotion: (promo: PosPromotion) => void;
  canManageOffers?: boolean;
}

export function SpecialOffersModal({
  isOpen,
  onClose,
  products,
  cart,
  appliedPromotionIds,
  onToggleApplyPromotion,
  canManageOffers = true,
}: SpecialOffersModalProps) {
  const [promotions, setPromotions] = useState<PosPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [editingOffer, setEditingOffer] = useState<PosPromotion | null>(null);

  // New Promotion Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<'brand' | 'bundle' | 'item' | 'cart'>('brand');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [brand, setBrand] = useState("");
  const [triggerItemId, setTriggerItemId] = useState<string>("");
  const [targetItemId, setTargetItemId] = useState<string>("");
  const [minCartTotal, setMinCartTotal] = useState<string>("0");
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPromos();
      setErrorMsg(null);
    }
  }, [isOpen]);

  const loadPromos = async () => {
    setLoading(true);
    try {
      const res = await loadPosPromotionsAction();
      if (res.success) {
        setPromotions(res.promotions);
      }
    } catch (err) {
      console.error("loadPromos error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (promo: PosPromotion) => {
    try {
      await togglePosPromotionAction(promo.id, !promo.active);
      await loadPromos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (promo: PosPromotion) => {
    setEditingOffer(promo);
    setName(promo.name);
    setType(promo.type);
    setDiscountType(promo.discount_type);
    setDiscountValue(String(promo.discount_value));
    setBrand(promo.brand || "");
    setTriggerItemId(promo.trigger_item_id ? String(promo.trigger_item_id) : "");
    setTargetItemId(promo.target_item_id ? String(promo.target_item_id) : "");
    setMinCartTotal(String(promo.min_cart_total || 0));
    setRequiresManagerApproval(Boolean(promo.requires_manager_approval));
    setErrorMsg(null);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingOffer(null);
    setName("");
    setBrand("");
    setTriggerItemId("");
    setTargetItemId("");
    setDiscountValue("10");
    setMinCartTotal("0");
    setRequiresManagerApproval(false);
    setErrorMsg(null);
    setActiveTab('list');
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this promotional offer?")) return;
    try {
      await deletePosPromotionAction(id);
      await loadPromos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) {
      setErrorMsg("Please enter a valid discount value greater than 0.");
      return;
    }

    if (type === 'brand' && !brand.trim()) {
      setErrorMsg("Please specify the brand or category for this offer.");
      return;
    }

    if (type === 'bundle' && (!triggerItemId || !targetItemId)) {
      setErrorMsg("Please select both items for the cross-item bundle offer.");
      return;
    }

    if (type === 'item' && !targetItemId) {
      setErrorMsg("Please select the target item for the special offer.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await savePosPromotionAction({
        id: editingOffer ? editingOffer.id : null,
        name: name.trim() || `${val}${discountType === 'percent' ? '%' : ' LKR'} off ${type.toUpperCase()}`,
        type,
        discount_type: discountType,
        discount_value: val,
        brand: brand.trim() || null,
        trigger_item_id: triggerItemId ? Number(triggerItemId) : null,
        target_item_id: targetItemId ? Number(targetItemId) : null,
        min_cart_total: parseFloat(minCartTotal) || 0,
        requires_manager_approval: requiresManagerApproval,
        active: editingOffer ? editingOffer.active : true,
      });

      if (res.success) {
        // Reset form
        handleCancelEdit();
        await loadPromos();
      } else {
        setErrorMsg(res.error || "Failed to save promotion.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save promotion.");
    } finally {
      setSaving(false);
    }
  };

  // Check if a promotion is qualified by the current cart
  const checkQualification = (promo: PosPromotion): boolean => {
    if (!promo.active || cart.length === 0) return false;

    if (promo.type === 'brand' && promo.brand) {
      const bLower = promo.brand.toLowerCase();
      return cart.some(
        (it) =>
          (it.brand && it.brand.toLowerCase() === bLower) ||
          (it.category && it.category.toLowerCase() === bLower)
      );
    }

    if (promo.type === 'bundle' && promo.trigger_item_id && promo.target_item_id) {
      const hasTrigger = cart.some((it) => it.id === promo.trigger_item_id);
      const hasTarget = cart.some((it) => it.id === promo.target_item_id);
      return hasTrigger && hasTarget;
    }

    if (promo.type === 'item' && promo.target_item_id) {
      return cart.some((it) => it.id === promo.target_item_id);
    }

    if (promo.type === 'cart') {
      const subtotal = cart.reduce((acc, it) => acc + it.price * it.quantity, 0);
      return subtotal >= (promo.min_cart_total || 0);
    }

    return false;
  };

  // Extract unique brands/categories from loaded products for easy selection
  const availableBrands = Array.from(
    new Set(
      products
        .flatMap((p) => [p.brand, p.category])
        .filter((b): b is string => Boolean(b && b.trim()))
    )
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div>
            <h3 className="text-base font-bold text-foreground">Special Offers & Promotions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border px-6 pt-3 gap-4">
          <button
            type="button"
            onClick={() => {
              if (editingOffer) handleCancelEdit();
              else setActiveTab('list');
            }}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === 'list'
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-400 hover:text-foreground"
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Active Offers ({promotions.length})</span>
          </button>
          {canManageOffers && (
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
                activeTab === 'create'
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-gray-400 hover:text-foreground"
              }`}
            >
              {editingOffer ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingOffer ? "Edit Offer" : "Create Special Offer"}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-10 text-xs text-gray-400">Loading promotional offers...</div>
              ) : promotions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 space-y-3">
                  <Tag className="w-12 h-12 mx-auto opacity-30 text-brand-500" />
                  <p className="text-sm font-bold text-foreground">No promotional offers created yet.</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    {canManageOffers
                      ? "Create special brand offers, cross-item bundles (e.g. buy item A get discount on item B), or custom percentage discounts."
                      : "There are currently no active promotional offers configured."}
                  </p>
                  {canManageOffers && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 bg-brand-500 text-brand-950 rounded-xl font-bold text-xs hover:bg-brand-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Your First Offer</span>
                    </button>
                  )}
                </div>
              ) : (
                promotions.map((promo) => {
                  const qualified = checkQualification(promo);
                  const isApplied = appliedPromotionIds.includes(promo.id);

                  return (
                    <div
                      key={promo.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        isApplied
                          ? "bg-brand-500/10 border-brand-500/50 shadow-sm"
                          : qualified
                          ? "bg-emerald-500/5 border-emerald-500/40"
                          : "bg-black/5 dark:bg-white/5 border-border"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-bold text-sm text-foreground">{promo.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-black/10 dark:bg-white/10 text-gray-300">
                            {promo.type}
                          </span>
                          {qualified && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Cart Qualifies
                            </span>
                          )}
                          {isApplied && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-500 text-brand-950">
                              Applied to Cart
                            </span>
                          )}
                          {promo.requires_manager_approval && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Manager Approval</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400">
                          {promo.type === 'brand' && `Get ${promo.discount_value}${promo.discount_type === 'percent' ? '%' : ' LKR'} off on all ${promo.brand} products.`}
                          {promo.type === 'bundle' && `Buy "${promo.trigger_item_name || 'Item A'}" with "${promo.target_item_name || 'Item B'}" and get ${promo.discount_value}${promo.discount_type === 'percent' ? '%' : ' LKR'} off.`}
                          {promo.type === 'item' && `Special ${promo.discount_value}${promo.discount_type === 'percent' ? '%' : ' LKR'} off on "${promo.target_item_name || 'Product'}".`}
                          {promo.type === 'cart' && `Spend over LKR ${promo.min_cart_total} to get ${promo.discount_value}${promo.discount_type === 'percent' ? '%' : ' LKR'} off.`}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {qualified && (
                          <button
                            type="button"
                            onClick={() => onToggleApplyPromotion(promo)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isApplied
                                ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                                : "bg-brand-500 text-brand-950 hover:bg-brand-400 shadow-sm"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isApplied ? "Remove Offer" : "Apply to Cart"}</span>
                          </button>
                        )}

                        {canManageOffers && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(promo)}
                              className="p-1.5 text-gray-400 hover:text-brand-400 rounded-xl transition-colors cursor-pointer"
                              title="Edit offer details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(promo)}
                              className={`p-1.5 rounded-xl transition-colors ${
                                promo.active ? "text-emerald-400 hover:text-emerald-300" : "text-gray-500 hover:text-gray-400"
                              }`}
                              title={promo.active ? "Active offer (Click to pause)" : "Paused offer (Click to activate)"}
                            >
                              {promo.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(promo.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                              title="Delete offer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <form onSubmit={handleCreatePromotion} className="space-y-4">
              {editingOffer && (
                <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-brand-500" />
                    <span className="text-xs font-bold text-foreground">
                      Editing Offer: <span className="text-brand-500">{editingOffer.name}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-gray-400 hover:text-foreground underline cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* Offer Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Offer Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              {/* Offer Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Promotion Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'brand', label: 'Brand Offer', icon: Tag, desc: '% or fee off brand' },
                    { id: 'bundle', label: 'Cross-Item Bundle', icon: Layers, desc: 'Buy A get off B' },
                    { id: 'item', label: 'Product Special', icon: ShoppingBag, desc: 'Discount single item' },
                    { id: 'cart', label: 'Spend Threshold', icon: DollarSign, desc: 'Spend min total' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id as any)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand-500/10 border-brand-500 text-brand-500 shadow-xs"
                            : "bg-black/5 dark:bg-white/5 border-border text-gray-400 hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <div className="font-bold text-xs text-foreground">{t.label}</div>
                        <div className="text-[10px] text-gray-400">{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount Value and Discount Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-black/5 dark:bg-white/5 p-1 border border-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        discountType === 'percent'
                          ? "bg-brand-500 text-brand-950 shadow-xs"
                          : "text-gray-400 hover:text-foreground"
                      }`}
                    >
                      % Percentage Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        discountType === 'fixed'
                          ? "bg-brand-500 text-brand-950 shadow-xs"
                          : "text-gray-400 hover:text-foreground"
                      }`}
                    >
                      LKR Flat Fee Off
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Discount Amount ({discountType === 'percent' ? '%' : 'LKR'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Conditional Inputs Based on Type */}
              {type === 'brand' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Target Brand / Category
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                    />
                    {availableBrands.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">Quick pick:</span>
                        {availableBrands.slice(0, 6).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBrand(b)}
                            className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 text-[10px] font-semibold text-gray-300 hover:bg-brand-500 hover:text-brand-950 transition-colors cursor-pointer"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {type === 'bundle' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      1. When Customer Buys Item:
                    </label>
                    <select
                      value={triggerItemId}
                      onChange={(e) => setTriggerItemId(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                      required
                    >
                      <option value="">Select qualifying item...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.item_name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      2. Give Discount on Item:
                    </label>
                    <select
                      value={targetItemId}
                      onChange={(e) => setTargetItemId(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                      required
                    >
                      <option value="">Select discounted item...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.item_name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {type === 'item' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Target Product for Discount
                  </label>
                  <select
                    value={targetItemId}
                    onChange={(e) => setTargetItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.item_name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {type === 'cart' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Minimum Cart Subtotal (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={minCartTotal}
                    onChange={(e) => setMinCartTotal(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {/* Manager Authorization Toggle */}
              <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" />
                    <span>Require Manager Approval at Register</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRequiresManagerApproval(!requiresManagerApproval)}
                  className={`p-1 rounded-xl transition-colors shrink-0 cursor-pointer ${
                    requiresManagerApproval ? "text-brand-500" : "text-gray-500"
                  }`}
                  title={requiresManagerApproval ? "Manager authorization required" : "No manager authorization required"}
                >
                  {requiresManagerApproval ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 border border-border text-gray-400 hover:text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Cancel</span>
                  <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-brand-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {saving
                      ? (editingOffer ? "Saving Changes..." : "Saving Offer...")
                      : (editingOffer ? "Save Changes" : "Create & Activate Offer")}
                  </span>
                  <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
