"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Check,
  Tag,
  Store,
  Layers,
  HelpCircle,
  Sliders,
  Filter,
} from "lucide-react";
import {
  getSkuCatalogComparisonAction,
  applySkuMappingsBatchAction,
} from "@/app/(dashboard)/user/actions/woocommerce-mapping";
import {
  SkuComparisonRow,
  SkuMatchCategory,
  SkuWinner,
  SkuSyncAction,
} from "@/lib/woocommerce/mapping-service";

interface WooSkuReviewWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMappingApplied?: () => void;
}

export default function WooSkuReviewWizardModal({
  isOpen,
  onClose,
  onMappingApplied,
}: WooSkuReviewWizardModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    linkedCount: number;
    importedCount: number;
    pushedCount: number;
    skippedCount: number;
  } | null>(null);

  const [rows, setRows] = useState<SkuComparisonRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    matched: 0,
    wooOnly: 0,
    framebooksOnly: 0,
    missingSku: 0,
    duplicateSku: 0,
    currentlyMapped: 0,
  });

  // Filters & State
  const [activeCategory, setActiveCategory] = useState<"all" | SkuMatchCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [defaultWinner, setDefaultWinner] = useState<SkuWinner>("framebooks");

  const loadComparison = async (winner: SkuWinner = defaultWinner) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessResult(null);
    try {
      const res = await getSkuCatalogComparisonAction(winner);
      if (res.success && res.result) {
        setRows(res.result.rows);
        setSummary(res.result.summary);
      } else {
        setErrorMsg(res.error || "Failed to compare catalog SKUs.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error loading catalog comparison.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComparison();
    }
  }, [isOpen]);

  const handleGlobalWinnerChange = (winner: SkuWinner) => {
    setDefaultWinner(winner);
    setRows((prev) =>
      prev.map((r) => (r.category === "matched" ? { ...r, winner } : r))
    );
  };

  const handleRowActionChange = (rowId: string, action: SkuSyncAction) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, selectedAction: action } : r))
    );
  };

  const handleRowWinnerChange = (rowId: string, winner: SkuWinner) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, winner } : r))
    );
  };

  const handleBulkSetAction = (category: SkuMatchCategory, action: SkuSyncAction) => {
    setRows((prev) =>
      prev.map((r) => (r.category === category ? { ...r, selectedAction: action } : r))
    );
  };

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesCategory =
        activeCategory === "all" || r.category === activeCategory;
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        (r.name || "").toLowerCase().includes(term) ||
        (r.sku || "").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [rows, activeCategory, searchTerm]);

  // Action count summary
  const actionCounts = useMemo(() => {
    let toLink = 0;
    let toImport = 0;
    let toPush = 0;
    let toSkip = 0;
    for (const r of rows) {
      if (r.selectedAction === "link") toLink++;
      else if (r.selectedAction === "import") toImport++;
      else if (r.selectedAction === "push_to_woo") toPush++;
      else toSkip++;
    }
    return { toLink, toImport, toPush, toSkip };
  }, [rows]);

  const handleApplyMappings = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = rows.map((r) => ({
        rowId: r.rowId,
        sku: r.sku,
        action: r.selectedAction,
        winner: r.winner,
        framebooksItemId: r.framebooksItemId,
        wooProductId: r.wooProductId,
        wooVariationId: r.wooVariationId,
        wooProductName: r.wooProductName,
        wooPrice: r.wooPrice,
        wooStock: r.wooStock,
      }));

      const res = await applySkuMappingsBatchAction(payload, defaultWinner);
      if (res.success) {
        setSuccessResult({
          linkedCount: res.linkedCount,
          importedCount: res.importedCount,
          pushedCount: res.pushedCount,
          skippedCount: res.skippedCount,
        });
        if (onMappingApplied) onMappingApplied();
      } else {
        setErrorMsg(res.error || "Failed to apply SKU mappings.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Encountered an error applying SKU mappings.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  WooCommerce SKU Review
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-gray-300">
                  {summary.total} items
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Match products and resolve SKU conflicts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Policy & Search Bar */}
        <div className="p-4 border-b border-border bg-black/5 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Winner Policy Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
              Initial stock winner:
            </span>
            <div className="flex items-center bg-black/10 dark:bg-white/10 p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => handleGlobalWinnerChange("framebooks")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  defaultWinner === "framebooks"
                    ? "bg-brand-500 text-brand-950 shadow-xs"
                    : "text-gray-400 hover:text-foreground"
                }`}
                title="Framebooks POS inventory count overwrites WooCommerce"
              >
                Framebooks
              </button>
              <button
                type="button"
                onClick={() => handleGlobalWinnerChange("woo")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  defaultWinner === "woo"
                    ? "bg-brand-500 text-brand-950 shadow-xs"
                    : "text-gray-400 hover:text-foreground"
                }`}
                title="WooCommerce online store quantity updates Framebooks inventory"
              >
                WooCommerce
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SKU or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-border px-4 pt-2 gap-2 overflow-x-auto shrink-0 bg-card">
          {[
            { id: "all", label: "All Items", count: summary.total },
            { id: "matched", label: "Matched", count: summary.matched },
            { id: "woo_only", label: "WooCommerce Only", count: summary.wooOnly },
            { id: "framebooks_only", label: "Framebooks Only", count: summary.framebooksOnly },
            { id: "missing_sku", label: "Missing SKU", count: summary.missingSku },
            { id: "duplicate_sku", label: "Duplicate SKU", count: summary.duplicateSku },
          ].map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={`pb-2.5 px-3 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-400 hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-brand-500/20 text-brand-500"
                      : "bg-black/10 dark:bg-white/10 text-gray-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successResult && (
            <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>SKU Mapping Successfully Applied!</span>
              </div>
              <p>
                Linked: <strong>{successResult.linkedCount}</strong> • Imported:{" "}
                <strong>{successResult.importedCount}</strong> • Pushed:{" "}
                <strong>{successResult.pushedCount}</strong> • Skipped:{" "}
                <strong>{successResult.skippedCount}</strong>
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              <span>Fetching and comparing catalog SKUs...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-20 text-center text-xs text-gray-400">
              No products found matching the selected filter.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-border">
                <div className="col-span-4">Product Name & Title</div>
                <div className="col-span-2">SKU Code</div>
                <div className="col-span-3 text-center">Stock (FB vs Woo)</div>
                <div className="col-span-3 text-right">Action & Winner</div>
              </div>

              {/* Table Rows */}
              {filteredRows.map((r) => {
                const stockDiff =
                  r.framebooksStock !== undefined &&
                  r.wooStock !== undefined &&
                  r.framebooksStock !== r.wooStock;

                return (
                  <div
                    key={r.rowId}
                    className="p-3 rounded-2xl border border-border bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-3 text-xs"
                  >
                    {/* 1. Name & Badges */}
                    <div className="sm:col-span-4 min-w-0">
                      <div className="font-bold text-foreground truncate">{r.name}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            r.category === "matched"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : r.category === "woo_only"
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : r.category === "framebooks_only"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                          }`}
                        >
                          {r.category.replace("_", " ")}
                        </span>
                        {r.isVariable && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-gray-400 font-bold uppercase">
                            Variation
                          </span>
                        )}
                        {r.isCurrentlyMapped && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500 text-brand-950 font-bold uppercase">
                            Already Mapped
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. SKU Code */}
                    <div className="sm:col-span-2 font-mono text-xs text-gray-300 font-semibold truncate">
                      {r.sku}
                    </div>

                    {/* 3. Stock Comparison */}
                    <div className="sm:col-span-3 flex items-center justify-between sm:justify-center gap-3">
                      <div className="text-center">
                        <span className="text-[9px] text-gray-400 block uppercase">POS</span>
                        <span className="font-bold text-foreground">
                          {r.framebooksStock !== undefined ? r.framebooksStock : "—"}
                        </span>
                      </div>
                      <span className="text-gray-500">vs</span>
                      <div className="text-center">
                        <span className="text-[9px] text-gray-400 block uppercase">Woo</span>
                        <span
                          className={`font-bold ${
                            stockDiff ? "text-amber-500" : "text-foreground"
                          }`}
                        >
                          {r.wooStock !== undefined ? r.wooStock : "—"}
                        </span>
                      </div>
                    </div>

                    {/* 4. Action Selector & Winner Toggle */}
                    <div className="sm:col-span-3 flex items-center justify-end gap-2 flex-wrap">
                      <select
                        value={r.selectedAction}
                        onChange={(e) =>
                          handleRowActionChange(r.rowId, e.target.value as SkuSyncAction)
                        }
                        className="px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:border-brand-500 cursor-pointer"
                      >
                        {r.category === "matched" && (
                          <>
                            <option value="link">Link & Sync</option>
                            <option value="skip">Skip</option>
                          </>
                        )}
                        {r.category === "woo_only" && (
                          <>
                            <option value="import">Import to Framebooks</option>
                            <option value="skip">Skip</option>
                          </>
                        )}
                        {r.category === "framebooks_only" && (
                          <>
                            <option value="push_to_woo">Push to WooCommerce</option>
                            <option value="skip">Skip</option>
                          </>
                        )}
                        {(r.category === "missing_sku" || r.category === "duplicate_sku") && (
                          <>
                            <option value="skip">Skip (Fix SKU First)</option>
                          </>
                        )}
                      </select>

                      {r.selectedAction === "link" && stockDiff && (
                        <select
                          value={r.winner}
                          onChange={(e) =>
                            handleRowWinnerChange(r.rowId, e.target.value as SkuWinner)
                          }
                          className="px-2 py-1.5 bg-black/10 dark:bg-white/10 border border-border rounded-xl text-[11px] font-semibold text-gray-300 focus:outline-none focus:border-brand-500 cursor-pointer"
                          title="Choose which side's stock quantity wins for the initial sync"
                        >
                          <option value="framebooks">POS Wins ({r.framebooksStock})</option>
                          <option value="woo">Woo Wins ({r.wooStock})</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="p-4 border-t border-border bg-black/5 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-400">
            <span>Summary: </span>
            <strong className="text-foreground">{actionCounts.toLink}</strong> to link •{" "}
            <strong className="text-foreground">{actionCounts.toImport}</strong> to import •{" "}
            <strong className="text-foreground">{actionCounts.toPush}</strong> to push •{" "}
            <span className="text-gray-500">{actionCounts.toSkip} skipped</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-gray-400 hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyMappings}
              disabled={saving || rows.length === 0}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-md active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Applying..." : "Apply mappings"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
