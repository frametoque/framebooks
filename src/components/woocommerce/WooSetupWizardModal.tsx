"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plug,
  RefreshCw,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { WOO_GUIDE_CONTENT } from "@/lib/woocommerce/guide-content";
import { testWooConnectionAction, WooConnectionDetails } from "@/app/(dashboard)/user/actions/woocommerce";

interface WooSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection?: WooConnectionDetails | null;
  onOpenSkuWizard?: () => void;
  onConnectionSuccess?: () => void;
}

export default function WooSetupWizardModal({
  isOpen,
  onClose,
  connection,
  onOpenSkuWizard,
  onConnectionSuccess,
}: WooSetupWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showMoreHelp, setShowMoreHelp] = useState(false);
  const [showManualWebhooks, setShowManualWebhooks] = useState(false);

  // Step 4 Quick Test state
  const [testStoreUrl, setTestStoreUrl] = useState(connection?.storeUrl || "");
  const [testConsumerKey, setTestConsumerKey] = useState("");
  const [testConsumerSecret, setTestConsumerSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    storeName?: string;
    manageStockEnabled?: boolean;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const steps = WOO_GUIDE_CONTENT.steps;
  const isConnected = connection?.connected;

  const handleCopy = (text: string, id: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRunQuickTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testWooConnectionAction({
        store_url: testStoreUrl,
        consumer_key: testConsumerKey,
        consumer_secret: testConsumerSecret,
      });
      setTestResult(res);
      if (res.success && onConnectionSuccess) {
        onConnectionSuccess();
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const isStepVerified = (stepNum: number) => {
    if (stepNum === 1 || stepNum === 2) return isConnected;
    if (stepNum === 3 || stepNum === 4) return isConnected || Boolean(testResult?.success);
    if (stepNum === 5) return isConnected && (connection?.registeredWebhooks?.length || 0) >= 3;
    if (stepNum === 6) return (connection?.mappedProductCount || 0) > 0;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Plug className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">WooCommerce Setup</h2>
              <p className="text-xs text-gray-400">Connect inventory and orders</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-6 border-b border-border bg-black/5 dark:bg-white/5 shrink-0 text-center">
          {steps.map((st) => {
            const verified = isStepVerified(st.step);
            const isCurrent = currentStep === st.step;
            return (
              <button
                key={st.step}
                type="button"
                onClick={() => {
                  setCurrentStep(st.step);
                  setShowMoreHelp(false);
                }}
                className={`py-2.5 px-1 transition-all cursor-pointer border-b-2 flex flex-col items-center gap-0.5 ${
                  isCurrent
                    ? "border-brand-500 bg-brand-500/10 text-brand-500 font-bold"
                    : verified
                    ? "border-emerald-500/60 text-emerald-400"
                    : "border-transparent text-gray-400 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  {verified ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[10px]">
                      {st.step}
                    </span>
                  )}
                  <span className="hidden md:inline truncate">{st.title.split(" ")[0]}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {steps.map((st) => {
            if (st.step !== currentStep) return null;
            const verified = isStepVerified(st.step);
            const instructionsList = st.instructions || [st.fullInstruction];

            return (
              <div key={st.step} className="space-y-4 animate-in fade-in duration-150">
                {/* Step Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500 uppercase tracking-wider">
                        Step {st.step} of 6
                      </span>
                      {verified && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{st.title}</h3>
                    <p className="text-xs text-gray-400">{st.shortDesc}</p>
                  </div>

                  {st.wpPath && (
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">WordPress</span>
                      <span className="text-xs font-semibold text-foreground bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-lg">
                        {st.wpPath}
                      </span>
                    </div>
                  )}
                </div>

                {/* Numbered Instruction Checklist */}
                <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border space-y-2">
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-200 font-medium">
                    {instructionsList.map((inst, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <span className="text-foreground">{inst}</span>
                      </li>
                    ))}
                  </ol>

                  {/* Collapsed More Help Section */}
                  {st.moreHelp && (
                    <div className="pt-2 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => setShowMoreHelp((prev) => !prev)}
                        className="text-[11px] text-gray-400 hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3 text-brand-500" />
                        <span>{showMoreHelp ? "Hide help" : "More help"}</span>
                        {showMoreHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {showMoreHelp && (
                        <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed bg-black/10 dark:bg-white/10 p-2.5 rounded-xl">
                          {st.moreHelp}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 4: Quick Connection Verification */}
                {st.step === 4 && (
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    <span className="text-xs font-bold text-foreground block">Verify credentials</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="url"
                        placeholder="https://yourstore.com"
                        value={testStoreUrl}
                        onChange={(e) => setTestStoreUrl(e.target.value)}
                        className="px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-brand-500"
                      />
                      <input
                        type="text"
                        placeholder="ck_..."
                        value={testConsumerKey}
                        onChange={(e) => setTestConsumerKey(e.target.value)}
                        className="px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-brand-500"
                      />
                      <input
                        type="password"
                        placeholder="cs_..."
                        value={testConsumerSecret}
                        onChange={(e) => setTestConsumerSecret(e.target.value)}
                        className="px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleRunQuickTest}
                        disabled={testing}
                        className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                        <span>{testing ? "Testing..." : "Test"}</span>
                      </button>

                      {testResult && (
                        <span
                          className={`text-xs font-semibold ${
                            testResult.success ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {testResult.success ? `Connected (${testResult.storeName})` : testResult.error}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 5: Webhooks */}
                {st.step === 5 && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Webhooks</span>
                        <span className="text-[11px] text-gray-400">
                          {connection?.registeredWebhooks?.length || 0} / 3 Active
                        </span>
                      </div>
                      <div className="space-y-1">
                        {["order.created", "order.updated", "product.updated"].map((topic) => {
                          const isReg = connection?.registeredWebhooks?.some(
                            (w) => w.topic === topic && w.status === "active"
                          );
                          return (
                            <div
                              key={topic}
                              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-between text-xs"
                            >
                              <span className="font-mono text-gray-300">{topic}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isReg
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-500"
                                }`}
                              >
                                {isReg ? "Active" : "Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Collapsed Manual Setup */}
                    <div className="rounded-2xl border border-border bg-black/5 dark:bg-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowManualWebhooks((prev) => !prev)}
                        className="w-full p-3 text-left flex items-center justify-between text-xs font-semibold text-gray-300 hover:bg-black/10 transition-colors"
                      >
                        <span>Manual webhook setup</span>
                        {showManualWebhooks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showManualWebhooks && (
                        <div className="p-3 pt-0 space-y-2 text-xs border-t border-border/50">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">
                              Delivery URL
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                readOnly
                                value={connection?.webhookDeliveryUrl || ""}
                                className="w-full px-2.5 py-1 bg-card border border-border rounded-xl text-xs font-mono text-gray-300 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleCopy(connection?.webhookDeliveryUrl || "", "deliveryUrl")}
                                className="p-1.5 rounded-xl bg-card border border-border hover:bg-black/10 text-gray-300 shrink-0"
                              >
                                {copiedField === "deliveryUrl" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">
                              Secret
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                readOnly
                                value={connection?.webhookSecret || "Stored encrypted"}
                                className="w-full px-2.5 py-1 bg-card border border-border rounded-xl text-xs font-mono text-gray-300 outline-none"
                              />
                              {connection?.webhookSecret && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(connection?.webhookSecret || "", "webhookSecret")}
                                  className="p-1.5 rounded-xl bg-card border border-border hover:bg-black/10 text-gray-300 shrink-0"
                                >
                                  {copiedField === "webhookSecret" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 6: SKU Review launch */}
                {st.step === 6 && onOpenSkuWizard && (
                  <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-foreground">Catalog Review</h4>
                      <p className="text-[11px] text-gray-400">Match SKUs and resolve conflicts</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSkuWizard();
                      }}
                      className="px-3.5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Review SKUs</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 px-5 border-t border-border bg-black/5 dark:bg-white/5 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setCurrentStep((prev) => Math.max(1, prev - 1));
              setShowMoreHelp(false);
            }}
            disabled={currentStep === 1}
            className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-gray-400 hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <span className="text-xs text-gray-500">
            {currentStep} / {steps.length}
          </span>

          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={() => {
                setCurrentStep((prev) => Math.min(steps.length, prev + 1));
                setShowMoreHelp(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs cursor-pointer flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
