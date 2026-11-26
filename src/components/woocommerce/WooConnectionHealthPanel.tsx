"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Radio,
} from "lucide-react";
import {
  checkWooConnectionHealthAction,
  reRegisterWebhooksAction,
  WooHealthReport,
} from "@/app/(dashboard)/user/actions/woocommerce";

interface WooConnectionHealthPanelProps {
  initialReport?: WooHealthReport | null;
  onRefreshParent?: () => void;
}

export default function WooConnectionHealthPanel({
  initialReport,
  onRefreshParent,
}: WooConnectionHealthPanelProps) {
  const [report, setReport] = useState<WooHealthReport | null>(initialReport || null);
  const [checking, setChecking] = useState(false);
  const [reRegistering, setReRegistering] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setChecking(true);
    setFeedbackMsg(null);
    try {
      const res = await checkWooConnectionHealthAction();
      setReport(res);
    } catch (err: any) {
      setReport((prev) => ({
        success: false,
        connected: Boolean(prev?.connected),
        keysValid: false,
        restReachable: false,
        webhooksCount: prev?.webhooksCount || 0,
        webhooksTotal: 3,
        activeWebhooks: prev?.activeWebhooks || [],
        lastSyncAt: prev?.lastSyncAt || null,
        error: err.message,
      }));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!initialReport) {
      runHealthCheck();
    }
  }, []);

  const handleReRegisterWebhooks = async () => {
    setReRegistering(true);
    setFeedbackMsg(null);
    try {
      const res = await reRegisterWebhooksAction();
      if (res.success) {
        setFeedbackMsg("Webhooks re-registered.");
        await runHealthCheck();
      } else {
        setFeedbackMsg(res.error || "Failed to re-register webhooks.");
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || "Failed to register webhooks.");
    } finally {
      setReRegistering(false);
    }
  };

  if (!report && checking) {
    return (
      <div className="p-5 rounded-3xl bg-card border border-border text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
        <span>Checking connection...</span>
      </div>
    );
  }

  if (!report?.connected) {
    return null;
  }

  const allHealthy = report.keysValid && report.restReachable && report.webhooksCount >= 3;

  return (
    <div className="p-5 rounded-3xl bg-card border border-border space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              allHealthy ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500"
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Connection Health</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  allHealthy
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                }`}
              >
                {allHealthy ? "Healthy" : "Attention"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={runHealthCheck}
          disabled={checking}
          className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin text-brand-500" : ""}`} />
          <span>{checking ? "Checking..." : "Check now"}</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-2.5 text-xs rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
          {feedbackMsg}
        </div>
      )}

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Keys Valid */}
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">REST Keys</span>
          <div className="flex items-center gap-1.5 font-bold">
            {report.keysValid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Valid</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-500">Invalid</span>
              </>
            )}
          </div>
        </div>

        {/* REST API Reachable */}
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">API Endpoint</span>
          <div className="flex items-center gap-1.5 font-bold">
            {report.restReachable ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-foreground">
                  Reachable {report.latencyMs ? `(${report.latencyMs}ms)` : ""}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-500">Unreachable</span>
              </>
            )}
          </div>
        </div>

        {/* Webhooks Active */}
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Webhooks</span>
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5">
              <Radio className={`w-3.5 h-3.5 ${report.webhooksCount >= 3 ? "text-emerald-400" : "text-amber-500 animate-pulse"}`} />
              <span className="text-foreground">
                {report.webhooksCount} / {report.webhooksTotal}
              </span>
            </div>
            {report.webhooksCount < 3 && (
              <button
                type="button"
                onClick={handleReRegisterWebhooks}
                disabled={reRegistering}
                className="text-[10px] text-brand-500 hover:underline cursor-pointer"
              >
                {reRegistering ? "Fixing..." : "Repair"}
              </button>
            )}
          </div>
        </div>

        {/* Last Reconciled */}
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Last Reconciled</span>
          <div className="flex items-center gap-1.5 font-semibold text-gray-300 truncate">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">
              {report.lastSyncAt ? new Date(report.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
