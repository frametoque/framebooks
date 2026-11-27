"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  Package, Search, Plus, Filter, AlertTriangle, ArrowUpDown, 
  Printer, Barcode, Camera, Edit2, Check, X, RefreshCw, 
  Store, Plug
} from "lucide-react";
import { MdPointOfSale } from "react-icons/md";
import { 
  loadStockProductsAction, 
  loadStockSummaryAction,
  saveProductAction, 
  adjustStockAction
} from "@/app/(dashboard)/pos/actions/stock";
import { StockItem } from "@/lib/pos/stock-service";
import { BarcodeLabelPrinter } from "./BarcodeLabelPrinter";
import { CameraScannerModal } from "./CameraScannerModal";
import { useHardwareBarcodeScanner } from "./useHardwareBarcodeScanner";
import CategoryPicker from "@/app/(dashboard)/user/components/CategoryPicker";

interface StockManagementModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  canManageStock?: boolean;
  isStandalonePage?: boolean;
  isWooConnected?: boolean;
  onStockChanged?: () => void;
  tenantName?: string;
  businessName?: string;
}

export function StockManagementModal({
  isOpen = true,
  onClose = () => {},
  canManageStock = true,
  isStandalonePage = false,
  isWooConnected = false,
  onStockChanged,
  tenantName,
  businessName,
}: StockManagementModalProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Pagination & Progressive Loading (loads 30 rows at a time)
  const PAGE_SIZE = 30;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalFiltered, setTotalFiltered] = useState<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Edit / Add product modal state
  const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    item_name: "",
    category: "General",
    sku: "",
    barcode: "",
    quantity: 0,
    cost_price: 0,
    selling_price: 0,
    tax_rate: 0,
    unit: "pcs",
    reorder_level: 5,
    notes: "",
  });

  // Adjust stock modal state
  const [adjustingProduct, setAdjustingProduct] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<"received" | "damaged" | "correction" | "count">("received");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Print label modal state
  const [labelProduct, setLabelProduct] = useState<StockItem | null>(null);

  // Camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"search" | "barcode_field">("search");

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await loadStockSummaryAction();
      if (res.success && res.summary?.categories) {
        setCategories(res.summary.categories);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen, loadSummary]);

  const loadInitialProducts = useCallback(async (currSearch: string, currCat: string, currLowStock: boolean) => {
    setLoading(true);
    try {
      const res = await loadStockProductsAction({
        search: currSearch,
        category: currCat === "All" ? undefined : currCat,
        lowStockOnly: currLowStock,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (res.success && res.items) {
        setItems(res.items);
        const count = res.total ?? res.items.length;
        setTotalFiltered(count);
        setHasMore(res.items.length === PAGE_SIZE && res.items.length < count);
      } else if (!res.success && res.error) {
        setStatusMsg({ type: 'error', text: res.error });
      }
    } catch (e: any) {
      console.error("loadProducts error:", e);
      setStatusMsg({ type: 'error', text: e.message || "Failed to load products" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadInitialProducts(debouncedSearch, category, lowStockOnly);
    }
  }, [isOpen, debouncedSearch, category, lowStockOnly, loadInitialProducts]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const currentOffset = items.length;
      const res = await loadStockProductsAction({
        search: debouncedSearch,
        category: category === "All" ? undefined : category,
        lowStockOnly,
        limit: PAGE_SIZE,
        offset: currentOffset,
      });
      if (res.success && res.items) {
        setItems((prev) => {
          const ids = new Set(prev.map(i => i.id));
          const newItems = res.items.filter(i => !ids.has(i.id));
          return [...prev, ...newItems];
        });
        const count = res.total ?? (currentOffset + res.items.length);
        if (res.items.length < PAGE_SIZE || currentOffset + res.items.length >= count) {
          setHasMore(false);
        }
      }
    } catch (e: any) {
      console.error("loadMoreProducts error:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, items.length, debouncedSearch, category, lowStockOnly]);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 250 && hasMore && !loadingMore && !loading) {
      loadMoreProducts();
    }
  };

  const [syncingWoo, setSyncingWoo] = useState(false);
  const [wooSyncProgress, setWooSyncProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  useEffect(() => {
    let unsub = () => {};
    import("@/lib/pos/product-sync-events").then(({ subscribeProductSync }) => {
      unsub = subscribeProductSync((state) => {
        setSyncingWoo(state.isSyncing);
        setWooSyncProgress(state.progress);
      });
    });
    return () => unsub();
  }, []);

  const handleWooSync = async () => {
    const {
      broadcastProductSyncStart,
      broadcastProductSyncProgress,
      broadcastProductSyncComplete,
      broadcastProductSyncError,
    } = await import("@/lib/pos/product-sync-events");

    broadcastProductSyncStart();
    setSyncingWoo(true);
    setStatusMsg(null);
    setWooSyncProgress({ current: 0, total: 0, percent: 0 });
    try {
      const { syncWooProductsBatchAction } = await import("@/app/(dashboard)/user/actions/woocommerce");
      let page = 1;
      let isFinished = false;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      const batchSize = 100;
      while (!isFinished) {
        const res = await syncWooProductsBatchAction(page, batchSize);
        if (!res.success) {
          throw new Error(res.error || "Failed to sync with WooCommerce.");
        }

        totalImported += res.imported;
        totalUpdated += res.updated;
        totalCount = res.totalProducts || totalCount;

        const processed = Math.min(totalCount, page * batchSize);
        const percent = totalCount > 0 ? Math.min(100, Math.round((processed / totalCount) * 100)) : (res.isFinished ? 100 : 50);
        const prog = { current: Math.min(processed, totalCount), total: totalCount, percent };
        setWooSyncProgress(prog);
        broadcastProductSyncProgress(prog);

        if (res.isFinished || page >= res.totalPages || res.batchProcessed === 0) {
          isFinished = true;
        } else {
          page++;
        }
      }

      broadcastProductSyncComplete({ total: totalCount, imported: totalImported, updated: totalUpdated });
      setStatusMsg({
        type: "success",
        text: `Synced ${totalCount} products from WooCommerce (${totalImported} imported, ${totalUpdated} updated).`,
      });
      await Promise.all([loadSummary(), loadInitialProducts(debouncedSearch, category, lowStockOnly)]);
      onStockChanged?.();
    } catch (err: any) {
      const msg = err.message || "Failed to sync.";
      broadcastProductSyncError(msg);
      setStatusMsg({ type: "error", text: msg });
    } finally {
      setSyncingWoo(false);
      setWooSyncProgress(null);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      item_name: "",
      category: "General",
      sku: "",
      barcode: "",
      quantity: 0,
      cost_price: 0,
      selling_price: 0,
      tax_rate: 0,
      unit: "pcs",
      reorder_level: 5,
      notes: "",
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (item: StockItem) => {
    setEditingProduct(item);
    setProductForm({
      item_name: item.item_name,
      category: item.category,
      sku: item.sku,
      barcode: item.barcode || "",
      quantity: item.quantity,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
      tax_rate: item.tax_rate,
      unit: item.unit,
      reorder_level: item.reorder_level,
      notes: item.notes || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await saveProductAction({
        id: editingProduct?.id || null,
        ...productForm,
      });

      if (res.success) {
        setIsProductModalOpen(false);
        setStatusMsg({ type: 'success', text: `Product "${productForm.item_name}" saved successfully.` });
        await Promise.all([loadSummary(), loadInitialProducts(debouncedSearch, category, lowStockOnly)]);
        onStockChanged?.();
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated()).catch(() => {});
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to save product." });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Failed to save product." });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdjust = (item: StockItem) => {
    setAdjustingProduct(item);
    setAdjustQty(0);
    setAdjustReason("received");
    setAdjustNotes("");
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await adjustStockAction({
        inventoryId: adjustingProduct.id,
        changeQty: adjustQty,
        reason: adjustReason,
        notes: adjustNotes,
      });

      if (res.success) {
        setAdjustingProduct(null);
        setStatusMsg({ type: 'success', text: `Stock adjusted for "${adjustingProduct.item_name}".` });
        await Promise.all([loadSummary(), loadInitialProducts(debouncedSearch, category, lowStockOnly)]);
        onStockChanged?.();
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated()).catch(() => {});
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to adjust stock." });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Failed to adjust stock." });
    } finally {
      setSaving(false);
    }
  };

  const handleCameraDetected = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;

    if (cameraTarget === "search") {
      setSearch(clean);
    } else if (cameraTarget === "barcode_field") {
      setProductForm((prev) => ({ ...prev, sku: clean, barcode: clean }));
    }
  }, [cameraTarget]);

  // Hardware barcode scanner support inside StockManagementModal
  useHardwareBarcodeScanner({
    onScan: (scanned) => {
      const clean = scanned.trim();
      if (!clean) return;

      if (!isCameraOpen && !isProductModalOpen && !adjustingProduct) {
        setSearch(clean);
      }
    },
    enabled: isOpen && !isCameraOpen,
  });

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (!isStandalonePage && !isOpen) return null;

  const content = (
    <div
      className={
        isStandalonePage
          ? "bg-card border border-border rounded-3xl w-full shadow-sm overflow-hidden flex flex-col relative min-h-[calc(100vh-140px)]"
          : "bg-card border border-border rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col relative h-[90vh]"
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
        <div>
          <h2 className="text-lg font-bold text-foreground">Stock Management</h2>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          {!isStandalonePage && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Status Toast Alert */}
        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-gray-400 hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Products List View */}
        <div className="flex-1 flex flex-col min-h-0">
            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU, or barcode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-foreground outline-none focus:border-brand-500 transition-colors"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCameraTarget("search");
                    setIsCameraOpen(true);
                  }}
                  className="p-2.5 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-foreground transition-colors"
                  title="Scan barcode with camera"
                >
                  <Barcode className="w-4 h-4 text-brand-500" />
                </button>
              </div>

              {/* Category Pills & Low Stock filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-popover text-foreground">
                      {c === "All" ? "All Categories" : c}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    lowStockOnly
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                      : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Stock Only</span>
                </button>

                {canManageStock && !isWooConnected && (
                  <button
                    onClick={handleOpenAddProduct}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                )}
                {canManageStock && isWooConnected && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleWooSync}
                      disabled={syncingWoo}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                      title="Sync products and stock from WooCommerce"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingWoo ? "animate-spin" : ""}`} />
                      <span>
                        {syncingWoo
                          ? wooSyncProgress && wooSyncProgress.total > 0
                            ? `Syncing (${wooSyncProgress.current}/${wooSyncProgress.total} • ${wooSyncProgress.percent}%)...`
                            : "Syncing..."
                          : "Sync Products"}
                      </span>
                    </button>

                    <div
                      className="hidden sm:flex px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400 text-xs font-semibold items-center gap-1.5"
                      title="Products are managed on WooCommerce"
                    >
                      <Plug className="w-3.5 h-3.5" />
                      <span>WooCommerce Managed</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Progress Bar when syncing */}
            {syncingWoo && wooSyncProgress && (
              <div className="px-6 py-2.5 bg-purple-500/10 border-b border-purple-500/20 flex flex-col gap-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-purple-300 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>
                      {wooSyncProgress.total > 0
                        ? `Importing from WooCommerce: ${wooSyncProgress.current} of ${wooSyncProgress.total} products`
                        : "Contacting WooCommerce..."}
                    </span>
                  </span>
                  <span className="font-bold text-foreground">{wooSyncProgress.percent}%</span>
                </div>
                <div className="w-full bg-purple-950/40 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, wooSyncProgress.percent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="flex-1 overflow-y-auto overflow-x-auto" onScroll={handleTableScroll}>
              {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  Loading stock items...
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <Package className="w-12 h-12 text-gray-400 mb-2 opacity-50" />
                  <h4 className="text-base font-bold text-foreground">No Products Found</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    {search ? `No products match "${search}".` : "Your inventory catalog is currently empty."}
                  </p>
                  {canManageStock && !isWooConnected && (
                    <button
                      onClick={handleOpenAddProduct}
                      className="mt-4 px-4 py-2 bg-brand-500 text-brand-900 font-bold rounded-xl text-xs hover:bg-brand-400"
                    >
                      Create First Product
                    </button>
                  )}
                  {canManageStock && isWooConnected && (
                    <button
                      onClick={handleWooSync}
                      disabled={syncingWoo}
                      className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingWoo ? "animate-spin" : ""}`} />
                      <span>{syncingWoo ? "Syncing..." : "Sync Products from WooCommerce"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-gray-400 uppercase font-semibold">
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-4 whitespace-nowrap z-10">Product Name & Category</th>
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-3 whitespace-nowrap z-10">SKU</th>
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-3 text-right whitespace-nowrap z-10">In Stock</th>
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-3 text-right whitespace-nowrap z-10">Selling Price</th>
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-3 text-right whitespace-nowrap z-10">Cost Price</th>
                      <th className="sticky top-0 bg-card border-b border-border py-3 px-4 text-right whitespace-nowrap z-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground text-sm">{it.item_name}</div>
                          <span className="text-[11px] text-gray-400">{it.category}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-semibold text-brand-600 dark:text-brand-400">{it.sku}</div>
                          {it.barcode && it.barcode !== it.sku && (
                            <div className="text-[11px] text-gray-500">{it.barcode}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 font-bold text-sm">
                            <span>{it.quantity}</span>
                            <span className="text-[10px] text-gray-400 font-normal">{it.unit}</span>
                          </div>
                          {it.is_low_stock && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" /> Low (&le;{it.reorder_level})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-foreground whitespace-nowrap">
                          LKR {formatLKR(it.selling_price)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-400 font-medium whitespace-nowrap">
                          LKR {formatLKR(it.cost_price)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setLabelProduct(it)}
                              className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              title="Print barcode / QR label"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {canManageStock && (
                              <>
                                <button
                                  onClick={() => handleOpenAdjust(it)}
                                  className="px-2.5 py-1.5 rounded-lg border border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-semibold transition-colors flex items-center gap-1"
                                  title="Adjust stock quantity"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                  <span>Adjust</span>
                                </button>
                                {!isWooConnected && (
                                  <button
                                    onClick={() => handleOpenEditProduct(it)}
                                    className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    title="Edit product"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {loadingMore && (
                <div className="py-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2 border-t border-border/40">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-500" />
                  <span>Loading more items...</span>
                </div>
              )}

              {!hasMore && items.length > 0 && (
                <div className="py-2.5 text-center text-[11px] text-gray-500 font-medium border-t border-border/40">
                  Showing all {items.length} {totalFiltered !== null && totalFiltered !== items.length ? `of ${totalFiltered} ` : ""}items
                </div>
              )}
            </div>
          </div>

        {/* Sub-Modal: Add / Edit Product Form */}
        {isProductModalOpen && (
          <div
            className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsProductModalOpen(false)}
          >
            <div
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 relative max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <h3 className="text-base font-bold text-foreground">
                  {editingProduct ? "Edit Stock Product" : "New Stock Product"}
                </h3>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-gray-400 hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productForm.item_name}
                    onChange={(e) => setProductForm({ ...productForm, item_name: e.target.value })}
                    placeholder="e.g. Arabica Coffee Beans 250g"
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Category</label>
                    <CategoryPicker
                      value={productForm.category ? [productForm.category] : []}
                      onChange={(selected) =>
                        setProductForm({ ...productForm, category: selected[0] || "General" })
                      }
                      placeholder="Select or add category..."
                      type="all"
                      categories={categories.filter((c) => c !== "All")}
                      singleSelect={true}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Unit</label>
                    <input
                      type="text"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      placeholder="pcs, kg, box"
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">
                    SKU (Key Product Identifier) <span className="text-[10px] text-gray-500">(Auto if blank)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setProductForm({ ...productForm, sku: val, barcode: val });
                      }}
                      placeholder="Scan barcode/QR or enter SKU (e.g. SKU-00010)"
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-3 pr-8 py-2 text-foreground outline-none focus:border-brand-500 font-sans font-bold text-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTarget("barcode_field");
                        setIsCameraOpen(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 cursor-pointer"
                      title="Scan barcode or QR code"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Selling Price (LKR) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={productForm.selling_price}
                      onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 font-bold text-foreground outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Cost Price (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={productForm.cost_price}
                      onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {!editingProduct && (
                    <div>
                      <label className="block text-gray-400 font-semibold mb-1">Initial Quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={productForm.quantity}
                        onChange={(e) => setProductForm({ ...productForm, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-500 font-medium"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Reorder Alert Level</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.reorder_level}
                      onChange={(e) => setProductForm({ ...productForm, reorder_level: parseFloat(e.target.value) || 5 })}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-xl font-semibold text-gray-400 hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Cancel</span>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>{saving ? "Saving..." : editingProduct ? "Update Product" : "Save Product"}</span>
                    <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-Modal: Quick Stock Adjustment */}
        {adjustingProduct && (
          <div
            className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setAdjustingProduct(null)}
          >
            <div
              className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h3 className="text-base font-bold text-foreground">Adjust Stock Quantity</h3>
                <button
                  onClick={() => setAdjustingProduct(null)}
                  className="text-gray-400 hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-border">
                <div className="font-bold text-sm text-foreground">{adjustingProduct.item_name}</div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>SKU: {adjustingProduct.sku}</span>
                  <span className="font-bold text-foreground">
                    Current: {adjustingProduct.quantity} {adjustingProduct.unit}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Reason for Adjustment</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value as any)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none font-semibold"
                  >
                    <option value="received">Goods Received / Restocked (+)</option>
                    <option value="damaged">Damaged / Expired / Spoiled (-)</option>
                    <option value="correction">Inventory Discrepancy Correction (+/-)</option>
                    <option value="count">Physical Stocktake Count</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">
                    Quantity Change (use minus for reduction)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. +10 or -2"
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2.5 font-bold text-base text-foreground outline-none focus:border-brand-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    New quantity will be:{" "}
                    <strong className="text-foreground font-bold">
                      {adjustingProduct.quantity + adjustQty} {adjustingProduct.unit}
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Notes / Supplier / PO Reference</label>
                  <textarea
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Received shipment from Colombo supplier..."
                    rows={2}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3 py-2 text-foreground outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setAdjustingProduct(null)}
                    className="px-4 py-2 border border-border rounded-xl font-semibold text-gray-400 hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Cancel</span>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                  </button>
                  <button
                    type="submit"
                    disabled={saving || adjustQty === 0}
                    className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <span>{saving ? "Applying..." : "Apply Adjustment"}</span>
                    <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-Modal: Camera Scanner */}
        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onDetected={handleCameraDetected}
          title={
            cameraTarget === "search"
              ? "Scan Barcode to Search"
              : cameraTarget === "barcode_field"
              ? "Scan Barcode for Product"
              : "Scan Item for Stocktake"
          }
        />

        {/* Sub-Modal: Label Printer */}
        <BarcodeLabelPrinter
          product={labelProduct}
          isOpen={Boolean(labelProduct)}
          onClose={() => setLabelProduct(null)}
          businessName={businessName || tenantName}
        />
      </div>
    );

    if (isStandalonePage) {
      return content;
    }

    return (
      <div
        className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        {content}
      </div>
    );
  }
