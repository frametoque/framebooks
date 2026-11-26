"use client";

import React, { useState, useEffect } from "react";
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Store,
  Check,
} from "lucide-react";
import {
  getWooConnectionAction,
  saveWooConnectionAction,
  disconnectWooAction,
  syncWooProductsBatchAction,
  WooConnectionDetails,
} from "../actions/woocommerce";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export default function IntegrationsTab() {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<WooConnectionDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
  } | null>(null);

  const fetchConnection = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getWooConnectionAction();
      if (res.success && res.connection) {
        setConnection(res.connection);
        if (res.connection.storeUrl) {
          setStoreUrl(res.connection.storeUrl);
        }
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load WooCommerce connection.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection(true);
  }, []);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      setErrorMsg("Please fill in Store URL, Consumer Key, and Consumer Secret.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await saveWooConnectionAction({
        store_url: storeUrl.trim(),
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
      });

      if (res.success) {
        setSuccessMsg(`Successfully connected to "${res.storeName || storeUrl}".`);
        setConsumerKey("");
        setConsumerSecret("");
        await fetchConnection(false);
      } else {
        setErrorMsg(res.error || "Failed to save WooCommerce credentials.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm(
      "Are you sure you want to disconnect WooCommerce? Existing imported products and stock history will remain intact.",
      {
        title: "Disconnect WooCommerce?",
        confirmText: "Disconnect",
        cancelText: "Cancel",
        danger: true,
      }
    );

    if (!ok) return;

    setDisconnecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await disconnectWooAction();
      if (res.success) {
        setSuccessMsg("WooCommerce store disconnected.");
        setConsumerKey("");
        setConsumerSecret("");
        await fetchConnection(false);
      } else {
        setErrorMsg(res.error || "Failed to disconnect.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSyncProgress({ processed: 0, total: 0, percent: 0 });
    const {
      broadcastProductSyncStart,
      broadcastProductSyncProgress,
      broadcastProductSyncComplete,
      broadcastProductSyncError,
    } = await import("@/lib/pos/product-sync-events");
    broadcastProductSyncStart();

    try {
      let page = 1;
      let isFinished = false;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      const batchSize = 100;
      while (!isFinished) {
        const res = await syncWooProductsBatchAction(page, batchSize);
        if (!res.success) {
          throw new Error(res.error || "Failed to sync products from WooCommerce.");
        }

        totalImported += res.imported;
        totalUpdated += res.updated;
        totalCount = res.totalProducts || totalCount;

        const processed = Math.min(totalCount, page * batchSize);
        const percent = totalCount > 0 ? Math.min(100, Math.round((processed / totalCount) * 100)) : (res.isFinished ? 100 : 50);

        setSyncProgress({
          processed: Math.min(processed, totalCount),
          total: totalCount,
          percent,
        });
        broadcastProductSyncProgress({ current: Math.min(processed, totalCount), total: totalCount, percent });

        if (res.isFinished || page >= res.totalPages || res.batchProcessed === 0) {
          isFinished = true;
        } else {
          page++;
        }
      }

      broadcastProductSyncComplete({ total: totalCount, imported: totalImported, updated: totalUpdated });
      setSuccessMsg(
        `Sync completed! Total ${totalCount} products processed (${totalImported} newly imported, ${totalUpdated} updated).`
      );
      await fetchConnection(false);
    } catch (err: any) {
      const msg = err.message || "Error syncing products.";
      broadcastProductSyncError(msg);
      setErrorMsg(msg);
    } finally {
      setSyncingAll(false);
      setSyncProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
        <span>Loading WooCommerce integration...</span>
      </div>
    );
  }

  const isConnected = Boolean(connection?.connected);
  const lastSyncLabel = connection?.lastSyncAt
    ? new Date(connection.lastSyncAt).toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-card border border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground">WooCommerce Integration</h2>
          <span
            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
            }`}
          >
            {isConnected ? "Connected" : "Not Connected"}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="flex-1 font-medium">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p className="flex-1 font-medium">{successMsg}</p>
        </div>
      )}

      {/* Connected View */}
      {isConnected ? (
        <div className="space-y-5">
          {/* Store Details Card */}
          <div className="p-6 rounded-3xl bg-card border border-border space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-border gap-3">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Connected Store
                </span>
                <div className="mt-1">
                  <a
                    href={connection?.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-foreground text-sm hover:text-brand-500 flex items-center gap-1.5"
                  >
                    <span>{connection?.storeUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{disconnecting ? "Disconnecting..." : "Disconnect"}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Mapped Products
                </span>
                <p className="text-xl font-bold text-foreground mt-1">
                  {connection?.mappedProductCount || 0}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Stock Sync
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Last Synced
                </span>
                <p className="text-sm font-semibold text-foreground mt-1.5">
                  {lastSyncLabel || "Ready"}
                </p>
              </div>
            </div>
          </div>

          {/* Sync All Products Card */}
          <div className="p-6 rounded-3xl bg-purple-500/5 border border-purple-500/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Import All Products</h3>
                </div>
                <p className="text-xs text-gray-400 max-w-lg">
                  Imports all products, categories, prices, and stock levels from WooCommerce to FrameBooks. Existing products will have their stock updated.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 shadow-md active:scale-95 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
                <span>
                  {syncingAll
                    ? syncProgress && syncProgress.total > 0
                      ? `Syncing (${syncProgress.processed}/${syncProgress.total} • ${syncProgress.percent}%)...`
                      : "Connecting..."
                    : "Import / Sync All Products"}
                </span>
              </button>
            </div>

            {/* Live Progress Bar & Percentage */}
            {syncingAll && syncProgress && (
              <div className="pt-2 border-t border-purple-500/20 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-300 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {syncProgress.total > 0
                        ? `Importing: ${syncProgress.processed} of ${syncProgress.total} products`
                        : "Querying WooCommerce catalog..."}
                    </span>
                  </span>
                  <span className="font-bold text-foreground">
                    {syncProgress.percent}%
                  </span>
                </div>
                <div className="w-full bg-purple-950/40 rounded-full h-2 overflow-hidden border border-purple-500/30">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, syncProgress.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* How Two-Way Sync Works */}
          <div className="p-5 rounded-3xl bg-card border border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              How Stock Sync Operates
            </h4>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span>
                  <strong className="text-foreground">POS Sales:</strong> When you complete a sale in FrameBooks POS, the stock is automatically deducted in WooCommerce in real-time.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span>
                  <strong className="text-foreground">WooCommerce Changes:</strong> When a product is added, updated, or purchased on WooCommerce, FrameBooks stock and catalog update automatically.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Connect Store Form */
        <form onSubmit={handleSaveConnection} className="p-6 rounded-3xl bg-card border border-border space-y-5">
          <div>
            <h3 className="text-sm font-bold text-foreground">Connect WooCommerce Store</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Store URL
              </label>
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://yourstore.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-foreground text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Consumer Key
              </label>
              <input
                type="text"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="ck_..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Consumer Secret
              </label>
              <input
                type="password"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="cs_..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-foreground text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-border text-xs text-gray-400">
            <p>
              In WordPress admin, go to <strong className="text-gray-300">WooCommerce → Settings → Advanced → REST API</strong>, click <strong className="text-gray-300">Add Key</strong>, set Permissions to <strong className="text-gray-300">Read/Write</strong>, and paste your keys above.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
            >
              <Plug className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
              <span>{saving ? "Connecting Store..." : "Connect WooCommerce"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
