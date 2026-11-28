"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  Package, Search, AlertTriangle, ArrowUpDown, 
  Printer, Barcode, Camera, Edit2, Check, X, RefreshCw, 
  Store, CheckCircle2, ArrowRight, ShieldAlert,
  ChevronDown
} from "lucide-react";
import { MdPointOfSale } from "react-icons/md";
import { getTenantInfo } from "../actions/tenants";
import { 
  loadStockProductsAction, 
  loadStockSummaryAction,
  saveProductAction, 
  adjustStockAction
} from "@/app/(dashboard)/pos/actions/stock";
import { StockItem } from "@/lib/pos/stock-service";
import AnimatedNumber from "../components/AnimatedNumber";
import CategoryPicker from "../components/CategoryPicker";
import { BarcodeLabelPrinter } from "@/components/pos/BarcodeLabelPrinter";
import { CameraScannerModal } from "@/components/pos/CameraScannerModal";
import { useHardwareBarcodeScanner } from "@/components/pos/useHardwareBarcodeScanner";

export default function StockPage() {
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // Live WooCommerce Product Sync state
  const [syncState, setSyncState] = useState<{
    isSyncing: boolean;
    progress: { current: number; total: number; percent: number } | null;
  }>({ isSyncing: false, progress: null });

  // Summary statistics state (loaded once from database aggregate query)
  const [summary, setSummary] = useState<{
    totalProducts: number;
    totalStockUnits: number;
    lowStockCount: number;
    totalStockValue: number;
    categories: string[];
  }>({
    totalProducts: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    totalStockValue: 0,
    categories: ["All"],
  });

  // Products list & pagination state (loads 30 rows at a time)
  const PAGE_SIZE = 30;
  const [items, setItems] = useState<StockItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalFiltered, setTotalFiltered] = useState<number | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Debounce search input for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Sentinel ref for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Add / Edit Product modal
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

  // Adjust stock modal
  const [adjustingProduct, setAdjustingProduct] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<"received" | "damaged" | "correction" | "count">("received");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Barcode label printer modal
  const [labelProduct, setLabelProduct] = useState<StockItem | null>(null);

  // Camera scanner modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"search" | "barcode_field">("search");

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
    details?: Array<{
      name: string;
      sku: string;
      currentStock?: number;
      changes: Array<{
        field: "SKU" | "Stock" | "Price" | "Name" | "Category";
        from: string | number;
        to: string | number;
      }>;
    }>;
  } | null>(null);
  const [showStatusDetails, setShowStatusDetails] = useState(false);

  // 1. Initial tenant check and load summary stats
  const loadSummary = useCallback(async () => {
    try {
      const res = await loadStockSummaryAction();
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    } catch (e) {
      console.error("Failed to load stock summary:", e);
    }
  }, []);

  useEffect(() => {
    async function checkTenant() {
      try {
        const info = await getTenantInfo();
        setTenantInfo(info);
        if (info?.has_pos_addon) {
          loadSummary();
        }
      } catch (err) {
        console.error("Failed to load tenant info for stock page:", err);
      } finally {
        setLoading(false);
      }
    }
    checkTenant();
  }, [loadSummary]);

  // 2. Load first 30 products on filter/search change
  const loadInitialProducts = useCallback(
    async (currSearch: string, currCategory: string, currLowStock: boolean, silent = false) => {
      if (!silent) {
        setProductsLoading(true);
      }
      try {
        const res = await loadStockProductsAction({
          search: currSearch,
          category: currCategory === "All" ? undefined : currCategory,
          lowStockOnly: currLowStock,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (res.success && res.items) {
          setItems(res.items);
          const totalCount = res.total ?? res.items.length;
          setTotalFiltered(totalCount);
          setHasMore(res.items.length === PAGE_SIZE && res.items.length < totalCount);
        } else if (!res.success && res.error) {
          setStatusMsg({ type: "error", text: res.error });
        }
      } catch (e: any) {
        console.error("Failed to load stock products:", e);
        setStatusMsg({ type: "error", text: e.message || "Failed to load stock products" });
      } finally {
        if (!silent) {
          setProductsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (tenantInfo?.has_pos_addon) {
      loadInitialProducts(debouncedSearch, selectedCategory, lowStockOnly);
    }
  }, [tenantInfo, debouncedSearch, selectedCategory, lowStockOnly, loadInitialProducts]);

  // 3. Load more products on scroll (next 30 rows)
  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || productsLoading || !hasMore) return;
    setLoadingMore(true);
    try {
      const currentOffset = items.length;
      const res = await loadStockProductsAction({
        search: debouncedSearch,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        lowStockOnly,
        limit: PAGE_SIZE,
        offset: currentOffset,
      });
      if (res.success && res.items) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newOnes = res.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newOnes];
        });
        const totalCount = res.total ?? (currentOffset + res.items.length);
        if (res.items.length < PAGE_SIZE || currentOffset + res.items.length >= totalCount) {
          setHasMore(false);
        }
      }
    } catch (e: any) {
      console.error("Failed to load more stock products:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, productsLoading, hasMore, items.length, debouncedSearch, selectedCategory, lowStockOnly]);

  // 4. Infinite scroll intersection observer
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !productsLoading) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1, rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, productsLoading, loadMoreProducts]);

  // Hardware barcode scanner listener
  useHardwareBarcodeScanner({
    onScan: (code) => {
      const clean = code.trim();
      if (!clean) return;

      if (!isCameraOpen && !isProductModalOpen && !adjustingProduct) {
        setSearch(clean);
      }
    },
    enabled: !isCameraOpen,
  });

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

  const refreshAll = useCallback(async (silent = false) => {
    await Promise.all([
      loadSummary(),
      loadInitialProducts(debouncedSearch, selectedCategory, lowStockOnly, silent),
    ]);
  }, [loadSummary, loadInitialProducts, debouncedSearch, selectedCategory, lowStockOnly]);

  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  useEffect(() => {
    const handleOpenNew = () => {
      handleOpenAddProduct();
    };
    const handleStockRefresh = (e: any) => {
      refreshAllRef.current(true);
      const detail = e.detail;
      if (detail?.total !== undefined) {
        setStatusMsg({
          type: "success",
          text: `Synced ${detail.total} products from WooCommerce (${detail.imported || 0} imported, ${detail.updated || 0} updated).`,
          details: detail.updatedDetails,
        });
      }
    };

    let cleanupSync = () => {};
    let cleanupStock = () => {};
    let isMounted = true;
    let prevSyncing = false;

    import("@/lib/pos/product-sync-events").then(({ subscribeProductSync, subscribeStockUpdated, checkAndSyncRecentProducts }) => {
      if (!isMounted) return;

      cleanupSync = subscribeProductSync((state) => {
        setSyncState({ isSyncing: state.isSyncing, progress: state.progress });
        if (prevSyncing && !state.isSyncing && state.lastResult) {
          refreshAllRef.current(true);
          setStatusMsg({
            type: "success",
            text: `Synced ${state.lastResult.total} products from WooCommerce (${state.lastResult.imported || 0} imported, ${state.lastResult.updated || 0} updated).`,
            details: state.lastResult.updatedDetails,
          });
        }
        prevSyncing = state.isSyncing;
      });

      // Silent real-time cross-tab sync without flashing spinners
      cleanupStock = subscribeStockUpdated((detail?: any) => {
        refreshAllRef.current(true);
        if (detail?.items && detail.items.length > 0) {
          const actionLabel = detail.source === 'pos_checkout' 
            ? `POS Sale #${detail.orderNumber || ''}` 
            : detail.source === 'pos_refund'
            ? `POS Refund #${detail.orderNumber || ''}`
            : detail.source === 'pos_void'
            ? `POS Void #${detail.orderNumber || ''}`
            : 'Stock Adjustment';

          setStatusMsg({
            type: "success",
            text: `Stock updated for ${detail.items.length} product${detail.items.length > 1 ? "s" : ""} (${actionLabel.trim()}).`,
            details: detail.items.map((it: any) => ({
              name: it.name,
              sku: it.sku,
              currentStock: it.newQuantity,
              changes: [
                {
                  field: "Stock" as const,
                  from: `${it.previousQty ?? 0} pcs`,
                  to: `${it.newQuantity ?? 0} pcs`,
                },
              ],
            })),
          });
        }
      });

      // Auto-check on initial stock page load only
      checkAndSyncRecentProducts();
    });

    window.addEventListener("stock:open-new", handleOpenNew);
    window.addEventListener("stock:refresh", handleStockRefresh);
    return () => {
      isMounted = false;
      cleanupSync();
      cleanupStock();
      window.removeEventListener("stock:open-new", handleOpenNew);
      window.removeEventListener("stock:refresh", handleStockRefresh);
    };
  }, []);

  const handleOpenEditProduct = (item: StockItem) => {
    setEditingProduct(item);
    setProductForm({
      item_name: item.item_name,
      category: item.category || "General",
      sku: item.sku,
      barcode: item.barcode || "",
      quantity: item.quantity,
      cost_price: item.cost_price || 0,
      selling_price: item.selling_price || 0,
      tax_rate: item.tax_rate || 0,
      unit: item.unit || "pcs",
      reorder_level: item.reorder_level ?? 5,
      notes: item.notes || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.item_name.trim()) {
      setStatusMsg({ type: "error", text: "Product name is required." });
      return;
    }
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await saveProductAction({
        id: editingProduct?.id,
        ...productForm,
      });

      if (res.success) {
        setIsProductModalOpen(false);
        setStatusMsg({
          type: "success",
          text: editingProduct ? "Product updated successfully." : "Product added to stock catalog.",
        });
        await refreshAll();
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated()).catch(() => {});
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to save product." });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message || "Failed to save product." });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdjust = (item: StockItem) => {
    setAdjustingProduct(item);
    setAdjustQty(1);
    setAdjustReason("received");
    setAdjustNotes("");
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (adjustQty === 0) {
      setStatusMsg({ type: "error", text: "Adjustment quantity cannot be 0." });
      return;
    }

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
        setStatusMsg({ type: "success", text: "Stock inventory adjusted successfully." });
        await refreshAll();
        import("@/lib/pos/product-sync-events").then(m => m.broadcastStockUpdated()).catch(() => {});
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to adjust stock." });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message || "Failed to adjust stock." });
    } finally {
      setSaving(false);
    }
  };

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const decodeHtmlEntities = (str: string) => {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#038;/g, "&")
      .replace(/&nbsp;/g, " ");
  };

  // Categories derivation from server summary (always keep "All" at 1st position)
  const categories = useMemo(() => {
    const seen = new Set<string>();
    seen.add("all");
    const unique: string[] = [];
    for (const raw of summary.categories || []) {
      const decoded = decodeHtmlEntities(raw).trim();
      const lower = decoded.toLowerCase();
      if (decoded && lower !== "all" && !seen.has(lower)) {
        seen.add(lower);
        unique.push(decoded);
      }
    }
    return ["All", ...unique];
  }, [summary.categories]);

  // Aggregate stats from server summary (instant metrics across all items)
  const totalProducts = summary.totalProducts;
  const totalStockUnits = summary.totalStockUnits;
  const lowStockCount = summary.lowStockCount;
  const totalStockValue = summary.totalStockValue;

  // Loading spinner
  if (loading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <span className="text-xs text-gray-400 font-medium">Loading stock management...</span>
      </div>
    );
  }

  // POS Add-on Gate
  const hasPos = Boolean(tenantInfo?.has_pos_addon && tenantInfo?.can_use_pos !== false);
  if (!hasPos) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="bg-card border border-border rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Unlock Standalone Stock Management
            </h1>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Stock management, bulk stocktaking, barcode label printing, and live inventory auditing are part of the Framebooks POS & Retail engine.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/settings/billing#pos-addon"
              className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Enable POS & Stock Add-on</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 border border-border hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-foreground font-semibold rounded-xl text-sm transition-all text-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Cashier Restriction
  if (tenantInfo?.is_cashier_only || tenantInfo?.role === "cashier") {
    return (
      <div className="w-full max-w-lg mx-auto py-16 px-4">
        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Cashier accounts are restricted from standalone stock management. Please access the register terminal.
          </p>
          <div className="pt-2">
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs transition-all shadow-md"
            >
              <MdPointOfSale className="w-4 h-4" />
              <span>Go to POS Register</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative pb-10">
      {/* Toast Feedback */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{statusMsg.text}</span>
              {statusMsg.details && statusMsg.details.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowStatusDetails((prev) => !prev)}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold cursor-pointer text-[11px] transition-colors inline-flex items-center gap-1"
                >
                  <span>{showStatusDetails ? "Hide details" : `View ${statusMsg.details.length} updated product${statusMsg.details.length > 1 ? "s" : ""}`}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showStatusDetails ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setStatusMsg(null);
                setShowStatusDetails(false);
              }}
              className="cursor-pointer text-emerald-400 hover:text-emerald-300 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Detailed Previous -> Now Comparison List */}
          {showStatusDetails && statusMsg.details && statusMsg.details.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2 text-foreground font-normal">
              {statusMsg.details.map((prod, idx) => (
                <div key={idx} className="bg-black/20 dark:bg-black/40 rounded-xl p-3 border border-emerald-500/15">
                  <div className="font-bold text-xs text-foreground flex items-center justify-between gap-2">
                    <span>{decodeHtmlEntities(prod.name)}</span>
                    <div className="flex items-center gap-2">
                      {prod.currentStock !== undefined && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {prod.currentStock} in stock
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-sans tracking-wide bg-black/10 dark:bg-white/5 px-2 py-0.5 rounded">
                        {prod.sku}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {prod.changes.map((ch, chIdx) => (
                      <div key={chIdx} className="text-xs flex items-center gap-2 flex-wrap">
                        {ch.field === "Stock" ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] tracking-wide">
                            Stock Change
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-400">{ch.field}:</span>
                        )}
                        <span className="line-through text-red-400 font-sans">{String(ch.from)}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0 inline" />
                        <span className="font-bold text-emerald-400 font-sans">{String(ch.to)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live WooCommerce Product Syncing Indicator Banner */}
      {syncState.isSyncing && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">Syncing Products from WooCommerce...</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                  In Progress
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {syncState.progress && syncState.progress.total > 0
                  ? `Processed ${syncState.progress.current} of ${syncState.progress.total} products (${syncState.progress.percent}%)`
                  : "Fetching product batches and updating catalog prices..."}
              </p>
            </div>
          </div>
          {syncState.progress && syncState.progress.total > 0 && (
            <div className="w-full sm:w-48 bg-purple-950/40 rounded-full h-2.5 overflow-hidden border border-purple-500/20 shrink-0">
              <div
                className="bg-purple-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${syncState.progress.percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 1. Top ERP Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Products */}
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-foreground flex shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Stock Catalog Items</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              <AnimatedNumber value={totalProducts} />
            </p>
          </div>
        </div>

        {/* Available Stock Units */}
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-emerald-100/70 text-emerald-700 dark:bg-green-500/10 dark:text-green-400 flex shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Available Units</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-green-400">
              <AnimatedNumber value={totalStockUnits} />
            </p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className={`p-3.5 rounded-2xl ${lowStockCount > 0 ? "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-gray-400"} flex shrink-0`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Low Stock Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              <AnimatedNumber value={lowStockCount} />
            </p>
          </div>
        </div>

        {/* Total Stock Retail Value */}
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-blue-100/70 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 flex shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Stock Retail Value</p>
            <p className="text-2xl font-bold mt-1 text-foreground privacy-blur-target" data-stat-value>
              <AnimatedNumber value={formatLKR(totalStockValue)} /> <span className="text-xs font-semibold text-gray-500">LKR</span>
            </p>
          </div>
        </div>
      </div>


      {/* 3. Category Filter Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none w-full scroll-smooth">
        {categories.map((cat, idx) => (
          <button
            key={`stock-cat-${cat}-${idx}`}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
              selectedCategory.toLowerCase() === cat.toLowerCase()
                ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search stock by product name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-gray-400 focus:outline-none focus:border-brand-500 transition-colors shadow-2xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCameraTarget("search");
              setIsCameraOpen(true);
            }}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-foreground transition-colors cursor-pointer"
            title="Scan barcode with camera"
          >
            <Barcode className="w-4 h-4 text-brand-500" />
          </button>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              lowStockOnly
                ? "bg-amber-500/15 border-amber-500/30 text-amber-500 font-bold"
                : "bg-card border-border text-gray-400 hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Only</span>
          </button>
        </div>
      </div>

      {/* 5. Main Content Area */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
          {productsLoading ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
              <span className="text-xs">Loading product catalog...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-3">
              <Package className="w-12 h-12 mx-auto text-gray-400/40" />
              <p className="text-sm font-semibold text-foreground">No stock products found</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {search || selectedCategory !== "All" || lowStockOnly
                  ? "No items match your active search or filters. Try resetting the filters."
                  : "Your stock catalog is empty. Click '+ Add Product' to start tracking your retail items."}
              </p>
              {(search || selectedCategory !== "All" || lowStockOnly) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                    setLowStockOnly(false);
                  }}
                  className="mt-2 text-xs font-semibold text-brand-500 hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02] text-gray-600 dark:text-gray-400">
                    <th className="text-left py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">Product & Category</th>
                    <th className="text-left py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">SKU</th>
                    <th className="text-left py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">In Stock</th>
                    <th className="text-left py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">Selling Price</th>
                    <th className="text-left py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">Cost Price</th>
                    <th className="text-right py-4 px-6 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => {
                    const isLow = item.quantity <= (item.reorder_level ?? 5);
                    const isOut = item.quantity <= 0;

                    return (
                      <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-card transition-colors">
                        {/* Product Name & Category */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-sm text-foreground">{decodeHtmlEntities(item.item_name)}</div>
                          <div className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/5 dark:bg-white/5 border border-border/80 text-gray-400 mt-1">
                            {decodeHtmlEntities(item.category || "General")}
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-sans font-bold text-brand-600 dark:text-brand-400 text-xs tracking-wide">
                              {item.sku}
                            </span>
                            {item.woo_sync_status === "error" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
                                Sync Error
                              </span>
                            )}
                          </div>
                          {item.barcode && item.barcode !== item.sku && (
                            <div className="font-sans text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Barcode className="w-3.5 h-3.5 text-gray-400" />
                              <span>{item.barcode}</span>
                            </div>
                          )}
                        </td>

                        {/* In Stock Quantity & Status Badge */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-bold text-sm text-foreground whitespace-nowrap shrink-0">
                              {item.quantity} <span className="text-xs font-normal text-gray-500">{item.unit || "pcs"}</span>
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${
                                isOut
                                  ? "bg-red-500/15 text-red-500 border border-red-500/30"
                                  : isLow
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                              }`}
                            >
                              {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                            </span>
                          </div>
                        </td>

                        {/* Selling Price */}
                        <td className="py-4 px-6 font-bold text-sm text-foreground whitespace-nowrap">
                          LKR {formatLKR(item.selling_price)}
                        </td>

                        {/* Cost Price */}
                        <td className="py-4 px-6 text-gray-400 font-medium whitespace-nowrap">
                          {item.cost_price ? `LKR ${formatLKR(item.cost_price)}` : "—"}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Label */}
                            <button
                              onClick={() => setLabelProduct(item)}
                              className="p-2 text-gray-400 hover:text-foreground rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Print Barcode / QR Shelf Label"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Adjust Stock */}
                            <button
                              onClick={() => handleOpenAdjust(item)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Receive stock, damage or adjust count"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5 text-brand-500" />
                              <span className="hidden sm:inline">Adjust</span>
                            </button>

                            {/* Edit Product - only available when not managed by WooCommerce */}
                            {!tenantInfo?.has_woocommerce && (
                              <button
                                onClick={() => handleOpenEditProduct(item)}
                                className="p-2 text-gray-400 hover:text-foreground rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                title="Edit product details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Infinite Scroll Loader & Sentinel */}
              {loadingMore && (
                <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2 border-t border-border/40">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-500" />
                  <span>Loading more products...</span>
                </div>
              )}

              {/* Observer Sentinel Element */}
              <div ref={observerTarget} className="h-6 w-full pointer-events-none" />

              {!hasMore && items.length > 0 && (
                <div className="py-3 text-center text-[11px] text-gray-500 font-medium border-t border-border/40">
                  Showing all {items.length} {totalFiltered !== null && totalFiltered !== items.length ? `of ${totalFiltered} ` : ""}products
                </div>
              )}
            </div>
          )}
        </div>

      {/* 6. MODALS */}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsProductModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
              <h3 className="text-base font-bold text-foreground">
                {editingProduct ? "Edit Stock Product" : "Add Stock Product to Catalog"}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto flex-1 flex flex-col justify-between text-xs space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={productForm.item_name}
                      onChange={(e) => setProductForm({ ...productForm, item_name: e.target.value })}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 font-semibold text-foreground outline-none focus:border-brand-500"
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
                        placeholder="Select category..."
                        type="all"
                        categories={categories.filter((c) => c !== "All")}
                        singleSelect={true}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 font-semibold mb-1">Unit of Measure</label>
                      <input
                        type="text"
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">
                      SKU (Key Product Identifier)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={productForm.sku}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setProductForm({ ...productForm, sku: val, barcode: val });
                        }}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-3.5 pr-10 py-2 font-sans font-bold text-brand-500 outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCameraTarget("barcode_field");
                          setIsCameraOpen(true);
                        }}
                        className="absolute right-2.5 text-gray-400 hover:text-brand-500 cursor-pointer"
                        title="Scan barcode or QR code"
                      >
                        <Barcode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-400 font-semibold mb-1">Selling Price (LKR) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={productForm.selling_price}
                        onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 font-bold text-foreground outline-none focus:border-brand-500"
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
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 font-semibold mb-1">Reorder Alert Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={productForm.reorder_level}
                        onChange={(e) => setProductForm({ ...productForm, reorder_level: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  {!editingProduct && (
                    <div>
                      <label className="block text-gray-400 font-semibold mb-1">Opening Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={productForm.quantity}
                        onChange={(e) => setProductForm({ ...productForm, quantity: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-border shrink-0">
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

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div
          className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setAdjustingProduct(null)}
        >
          <div
            className="bg-card border border-border rounded-3xl w-full max-w-3xl lg:max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
              <h3 className="text-base font-bold text-foreground">Adjust Stock Inventory</h3>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-6 overflow-y-auto flex-1 flex flex-col justify-between text-xs space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Product Info, Qty & Notes */}
                <div className="space-y-4">
                  <div className="p-4 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                    <div className="font-bold text-foreground text-sm">{adjustingProduct.item_name}</div>
                    <div className="font-sans text-xs font-semibold text-brand-500 mt-1">{adjustingProduct.sku}</div>
                    <div className="text-gray-400 text-xs mt-2">Current Stock: <span className="font-bold text-foreground">{adjustingProduct.quantity} {adjustingProduct.unit || 'pcs'}</span></div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">
                      Quantity Change (+ to add, - to deduct)
                    </label>
                    <input
                      type="number"
                      required
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 font-bold text-foreground text-sm outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Resulting balance: <span className="font-bold text-foreground">{adjustingProduct.quantity + adjustQty}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-semibold mb-1">Notes / Remarks</label>
                    <input
                      type="text"
                      value={adjustNotes}
                      onChange={(e) => setAdjustNotes(e.target.value)}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Right Column: Reason */}
                <div>
                  <label className="block text-gray-400 font-semibold mb-2">Reason for Adjustment</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: "received", label: "+ Stock Received", type: "pos" },
                      { id: "damaged", label: "- Damaged / Scrap", type: "neg" },
                      { id: "correction", label: "Count Correction", type: "neutral" },
                      { id: "count", label: "Stocktake Count", type: "neutral" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setAdjustReason(r.id as any);
                          if (r.id === "damaged" && adjustQty > 0) setAdjustQty(-adjustQty);
                          if (r.id === "received" && adjustQty < 0) setAdjustQty(-adjustQty);
                        }}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                          adjustReason === r.id
                            ? "bg-brand-500/15 border-brand-500 text-brand-500"
                            : "border-border text-gray-400 hover:text-foreground"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-border shrink-0">
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
                  className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{saving ? "Saving..." : "Apply Adjustment"}</span>
                  <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Label Printer Modal */}
      {labelProduct && (
        <BarcodeLabelPrinter
          isOpen={Boolean(labelProduct)}
          onClose={() => setLabelProduct(null)}
          product={labelProduct}
          businessName={tenantInfo?.name}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={(code) => {
          if (cameraTarget === "search") {
            setSearch(code);
            setIsCameraOpen(false);
          } else if (cameraTarget === "barcode_field") {
            setProductForm((prev) => ({ ...prev, sku: code, barcode: code }));
            setIsCameraOpen(false);
          }
        }}
        title="Scan Product Barcode"
      />
    </div>
  );
}
