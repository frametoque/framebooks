"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  Maximize2,
  Minimize2,
  Clock,
  Calendar,
  ArrowRight,
  CreditCard,
  Banknote,
  Receipt,
  QrCode,
  Tag,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PosClientDisplayState,
  PosClientDisplayCustomer,
  PosDisplayMessage,
  POS_CLIENT_CHANNEL_NAME,
  getPosClientChannelName,
  PosClientDisplaySlide,
  DEFAULT_CUSTOMER_DISPLAY_SLIDES,
} from "@/lib/pos/client-display";
import { generateQrCodeSvg } from "@/lib/pos/barcode-generator";
import { generateTenantThemeCss, DEFAULT_ACCENT_HEX, resolvePaletteId } from "@/lib/theme/accent";

interface PosClientDisplayProps {
  initialTenantName?: string;
  initialTenantLogoUrl?: string | null;
  initialTenantId?: number;
  initialCounterId?: number;
  initialAccentColor?: string | null;
  initialIsShiftOpen?: boolean;
  initialCounterName?: string;
  initialCashierName?: string;
  initialSlides?: PosClientDisplaySlide[];
  initialToken?: string;
}

export function PosClientDisplay({
  initialTenantName = "Framebooks POS",
  initialTenantLogoUrl = null,
  initialTenantId = 1,
  initialCounterId = 1,
  initialAccentColor = null,
  initialIsShiftOpen = false,
  initialCounterName = "Counter 1",
  initialCashierName = "Cashier",
  initialSlides = DEFAULT_CUSTOMER_DISPLAY_SLIDES,
  initialToken,
}: PosClientDisplayProps) {
  // Display State
  const [displayState, setDisplayState] = useState<PosClientDisplayState>({
    tenantId: initialTenantId,
    tenantName: initialTenantName,
    tenantLogoUrl: initialTenantLogoUrl,
    accentColor: initialAccentColor,
    counterId: initialCounterId || 1,
    counterName: initialCounterName,
    cashierName: initialCashierName,
    isShiftOpen: initialIsShiftOpen,
    customer: { name: "Walk-in Customer", phone: "" },
    cart: [],
    summary: {
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      totalDue: 0,
      itemCount: 0,
    },
    payment: {
      isOpen: false,
      method: "Cash",
      tendered: 0,
      changeDue: 0,
      isCompleted: false,
    },
    timestamp: Date.now(),
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);


  // Idle Ads & Promo Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Live Date & Time State
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDateTime(new Date());
    const clockTimer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const formattedTime = currentDateTime
    ? currentDateTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "";

  const formattedDate = currentDateTime
    ? currentDateTime.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // Active Promo Slides
  const effectiveSlides = (displayState.slides && displayState.slides.length > 0)
    ? displayState.slides
    : (initialSlides && initialSlides.length > 0 ? initialSlides : []);
  const activeSlides = effectiveSlides.filter((s) => s.active !== false);
  const imageSlides = activeSlides.filter((s) => Boolean(s.imageUrl));
  const slidesToUse = imageSlides.length > 0 ? imageSlides : activeSlides;

  // Auto-advance slides every 5s when counter is idle or shift is closed (smooth auto sliding)
  useEffect(() => {
    if ((displayState.isShiftOpen && displayState.cart.length > 0) || displayState.payment.isCompleted || slidesToUse.length <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slidesToUse.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [displayState.isShiftOpen, displayState.cart.length, displayState.payment.isCompleted, slidesToUse.length]);

  const channelRef = useRef<BroadcastChannel | null>(null);

  // 1. Setup BroadcastChannel and Listeners for 0ms dual-monitor / secondary window sync
  useEffect(() => {
    const channels: BroadcastChannel[] = [];
    const activeCounterId = displayState.counterId || 1;
    const channelNames = [
      getPosClientChannelName(displayState.tenantId, activeCounterId),
      POS_CLIENT_CHANNEL_NAME,
    ];
    if (activeCounterId !== 1) {
      channelNames.push(getPosClientChannelName(displayState.tenantId, 1));
    }

    try {
      channelNames.forEach((chName) => {
        try {
          const bc = new BroadcastChannel(chName);
          bc.onmessage = (event) => {
            const msg = event.data as PosDisplayMessage;
            if (msg?.type === "POS_STATE_UPDATE" && msg.payload) {
              setDisplayState(msg.payload);
              setIsConnected(true);
            }
          };
          // Request immediate state sync from active POS terminal
          bc.postMessage({ type: "CLIENT_REQUEST_STATE" });
          channels.push(bc);
        } catch {}
      });
    } catch (e) {
      console.warn("BroadcastChannel not supported in this environment:", e);
    }

    // Fallback: localStorage storage events for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (channelNames.includes(e.key || "") && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.type === "POS_STATE_UPDATE" && parsed.payload) {
            setDisplayState(parsed.payload);
            setIsConnected(true);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    // Initial check from localStorage in case terminal already broadcasted
    try {
      for (const chName of channelNames) {
        const stored = localStorage.getItem(chName);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.payload) {
            setDisplayState(parsed.payload);
            setIsConnected(true);
            break;
          }
        }
      }
    } catch {}

    // Polling fallback every 3s via API for tablets running on different machines/Wi-Fi
    const interval = setInterval(async () => {
      try {
        const tokenQuery = initialToken ? `&token=${encodeURIComponent(initialToken)}` : "";
        const res = await fetch(`/api/pos/client-display?tenantId=${displayState.tenantId}&counterId=${displayState.counterId || 1}${tokenQuery}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            setDisplayState(data.state);
            setIsConnected(true);
          }
        }
      } catch {}
    }, 3000);

    return () => {
      channels.forEach((bc) => {
        try {
          bc.close();
        } catch {}
      });
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [displayState.tenantId, displayState.counterId, initialToken]);

  const FULLSCREEN_PREF_KEY = "pos_client_fullscreen_pref";

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        try {
          localStorage.setItem(FULLSCREEN_PREF_KEY, "true");
        } catch {}
      }
    } catch {
      // Ignored if browser requires user gesture
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored
    } finally {
      setIsFullscreen(false);
      try {
        localStorage.setItem(FULLSCREEN_PREF_KEY, "false");
      } catch {}
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      requestFullscreen();
    } else {
      exitFullscreen();
    }
  };

  // Keep isFullscreen in sync with native browser fullscreen state & handle F11 / shortcut
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    // Auto-restore fullscreen on refresh, blur, print dialog or user interactions
    const handleAutoResumeFullscreen = () => {
      try {
        const pref = localStorage.getItem(FULLSCREEN_PREF_KEY);
        if (pref === "true" && !document.fullscreenElement) {
          requestFullscreen();
        }
      } catch {}
    };

    // Try immediate recovery on mount (e.g. on page refresh or PWA / Kiosk mode)
    handleAutoResumeFullscreen();

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleAutoResumeFullscreen, { capture: true });
    window.addEventListener("touchend", handleAutoResumeFullscreen, { capture: true });
    window.addEventListener("focus", handleAutoResumeFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleAutoResumeFullscreen, { capture: true });
      window.removeEventListener("touchend", handleAutoResumeFullscreen, { capture: true });
      window.removeEventListener("focus", handleAutoResumeFullscreen);
    };
  }, []);

  const formatLKR = (amount: number) => {
    return `LKR ${Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isCartEmpty = displayState.cart.length === 0;
  const isCustomerAssigned =
    displayState.customer &&
    displayState.customer.name &&
    displayState.customer.name !== "Walk-in Customer";

  // Dynamic tenant accent theme CSS
  const activeAccent = displayState.accentColor || initialAccentColor || DEFAULT_ACCENT_HEX;
  const resolvedAccentHex = resolvePaletteId(activeAccent) || DEFAULT_ACCENT_HEX;
  const dynamicThemeCss = generateTenantThemeCss(resolvedAccentHex);

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-screen bg-[#0B0F17] text-white overflow-hidden">
      {dynamicThemeCss && <style dangerouslySetInnerHTML={{ __html: dynamicThemeCss }} />}
      <style dangerouslySetInnerHTML={{ __html: `nextjs-portal { display: none !important; }` }} />
      {/* ── Top Header Bar ── */}
      <header
        onDoubleClick={toggleFullscreen}
        className="h-16 px-6 bg-[#0E131F] border-b border-white/10 flex items-center justify-between shrink-0 select-none cursor-default"
        title="Double click to toggle fullscreen (or press F11)"
      >
        <div className="flex items-center gap-3.5">
          {displayState.tenantLogoUrl ? (
            <img
              src={displayState.tenantLogoUrl}
              alt="Logo"
              className="w-9 h-9 rounded-xl object-contain bg-white/5 p-1 border border-white/10"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-sm">
              {displayState.tenantName
                ? displayState.tenantName
                    .split(/\s+/)
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "FB"}
            </div>
          )}
          <div>
            <h1 className="text-base font-black tracking-tight text-white uppercase truncate max-w-xs sm:max-w-md">
              {displayState.tenantName}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <span>{displayState.counterName || "Counter 1"}</span>
              <span>•</span>
              {displayState.isShiftOpen ? (
                <span>Cashier: {displayState.cashierName || "Active"}</span>
              ) : (
                <span className="text-amber-400 font-bold uppercase tracking-wider">Counter Closed</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen (F11)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Main View Area ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* LEFT PANE: Scanned Items Cart Table or Welcome Splash */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden bg-[#0B0F17]">
          {/* Header - only shown during active checkout when items are scanned */}
          {displayState.isShiftOpen && !isCartEmpty && !displayState.payment.isCompleted && (
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0E131F]/50">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-brand-500" />
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase">
                  Current Bill
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-white/80">
                {displayState.summary.itemCount} {displayState.summary.itemCount === 1 ? "Item" : "Items"}
              </span>
            </div>
          )}

          {/* Items List or Thank You Screen or Ad Slider */}
          <div className={`flex-1 overflow-y-auto ${(!displayState.isShiftOpen || (isCartEmpty && !displayState.payment.isCompleted)) ? "p-0" : "p-4 sm:p-6 space-y-3"}`}>
            {displayState.payment.isCompleted ? (
              /* Dedicated Thank You Screen */
              <div className="h-full min-h-[460px] flex flex-col items-center justify-center text-center p-4 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Thank You Title & Business branding */}
                <div className="space-y-2 max-w-md">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Thank You for Your Purchase!
                  </h2>
                </div>

                {/* Receipt Breakdown Card */}
                <div className="w-full max-w-md bg-[#0E131F] border border-white/10 rounded-3xl p-5 sm:p-6 text-left space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                        Receipt Number
                      </span>
                      <span className="text-sm sm:text-base font-black text-white">
                        {displayState.payment.orderNumber || "Completed"}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-white/80 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-brand-500" />
                      <span>{displayState.payment.method || "Cash"}</span>
                    </span>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-white/70">
                      <span>Total Amount Paid</span>
                      <span className="text-base font-black text-white">
                        {formatLKR(displayState.payment.totalPaid || displayState.summary.totalDue)}
                      </span>
                    </div>

                    {/* Given Cash */}
                    {(displayState.payment.tendered > 0 || displayState.payment.method === "Cash") && (
                      <div className="flex justify-between text-white/70">
                        <span>Given Cash</span>
                        <span className="font-bold text-white">
                          {formatLKR(displayState.payment.tendered || (displayState.payment.totalPaid || displayState.summary.totalDue))}
                        </span>
                      </div>
                    )}

                    {/* Balance */}
                    {(displayState.payment.tendered > 0 || displayState.payment.method === "Cash") && (
                      <div className="pt-1 flex items-center justify-between text-brand-500">
                        <span className="text-xs font-black uppercase tracking-wider block">
                          Balance
                        </span>
                        <span className="text-xl sm:text-2xl font-black">
                          {formatLKR(displayState.payment.changeDue)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Framebooks Product Branding */}
                  <div className="pt-2 flex items-center gap-1.5 text-[11px] text-white/40 select-none">
                    <span>Powered by <strong className="text-white/70 font-bold">Framebooks POS</strong></span>
                  </div>
                </div>
              </div>
            ) : (!displayState.isShiftOpen || isCartEmpty) ? (
              /* Full Auto-sliding Ad Images Carousel */
              <div className="relative w-full h-full min-h-[420px] flex items-center justify-center overflow-hidden bg-[#070A10] select-none">
                {imageSlides.length > 0 ? (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="sync">
                      {(() => {
                        const activeSlide = imageSlides[currentSlideIndex % imageSlides.length];
                        return (
                          <motion.div
                            key={activeSlide?.id || (currentSlideIndex % imageSlides.length)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: "easeInOut" }}
                            className="absolute inset-0 w-full h-full flex items-center justify-center p-3 sm:p-5"
                          >
                            {/* Ambient blurred backdrop for aesthetic fit of any aspect ratio */}
                            <div
                              className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-25 scale-110 pointer-events-none"
                              style={{ backgroundImage: `url(${activeSlide?.imageUrl})` }}
                            />

                            {/* Sharp Foreground Ad Image */}
                            <img
                              src={activeSlide?.imageUrl!}
                              alt={activeSlide?.title || "Advertisement"}
                              className="relative z-10 max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            />
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* Clean Placeholder when no ad images are uploaded yet */
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/40 space-y-4 animate-in fade-in">
                    {!displayState.isShiftOpen ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/5">
                          <Clock className="w-8 h-8" />
                        </div>
                        <div className="max-w-sm">
                          <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                            This counter is currently closed, Sorry for the incovenience
                          </h3>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                        <div className="max-w-sm">
                          <h3 className="text-lg font-bold text-white/80">Welcome to {displayState.tenantName}</h3>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              displayState.cart.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 transition-all hover:border-brand-500/30"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-500 font-bold text-sm flex items-center justify-center shrink-0">
                      {item.quantity}×
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm sm:text-base text-white truncate">{item.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        {item.brand && <span>{item.brand}</span>}
                        {item.brand && item.sku && <span>•</span>}
                        {item.sku && <span>{item.sku}</span>}
                        <span>•</span>
                        <span>{formatLKR(item.price)} each</span>
                      </div>
                      {item.discount > 0 && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 mt-0.5">
                          <Tag className="w-3 h-3" />
                          <span>Savings: −{formatLKR(item.discount)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base sm:text-lg font-black text-white">
                      {formatLKR(item.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Status In Progress Banner */}
          {displayState.payment.isOpen && !displayState.payment.isCompleted && (
            <div className="p-4 bg-blue-500/10 border-t border-blue-500/20 text-blue-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                <CreditCard className="w-4 h-4 animate-pulse" />
                <span>Processing Payment via {displayState.payment.method}...</span>
              </div>
              {displayState.payment.tendered > 0 && (
                <span className="text-xs font-bold">
                  Given: {formatLKR(displayState.payment.tendered)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANE: Customer Check-in / Identity & Financial Breakdown OR Closed Counter Notice */}
        <div className="w-full lg:w-[460px] xl:w-[500px] flex flex-col bg-[#0E131F] overflow-y-auto shrink-0 p-5 sm:p-6 space-y-6">
          {!displayState.isShiftOpen ? (
            /* Counter Closed Notice Card in Sidebar */
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-8 flex flex-col items-center text-center space-y-5 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Counter Closed
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  This counter is currently closed, Sorry for the incovenience
                </p>
              </div>
              <div className="pt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-white/40 select-none">
                <span>Powered by <strong className="text-white/70 font-bold">Framebooks POS</strong></span>
              </div>
            </div>
          ) : (
            /* Financial Breakdown & Grand Total Due */
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-4">
              {/* Customer Details / Walk-in Customer Header */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">
                  Bill To
                </span>
                <div className="mt-0.5">
                  <div className="text-sm sm:text-base font-bold text-white truncate">
                    {isCustomerAssigned ? displayState.customer.name : "Walk-in Customer"}
                  </div>
                  {isCustomerAssigned && displayState.customer?.phone && (
                    <div className="text-xs text-white/50 font-medium mt-0.5">
                      {displayState.customer.phone}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Payment Summary
              </h3>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-white/70">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">
                    {formatLKR(displayState.summary.subtotal)}
                  </span>
                </div>

                {displayState.summary.discountTotal > 0 && (
                  <div className="flex justify-between text-brand-500">
                    <span>Total Discount & Offers</span>
                    <span className="font-bold">
                      −{formatLKR(displayState.summary.discountTotal)}
                    </span>
                  </div>
                )}

                {displayState.summary.taxTotal > 0 && (
                  <div className="flex justify-between text-white/70">
                    <span>Tax</span>
                    <span className="font-semibold text-white">
                      +{formatLKR(displayState.summary.taxTotal)}
                    </span>
                  </div>
                )}
              </div>

              {/* Giant High-Visibility Total Due Display */}
              <div className="pt-2 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {displayState.payment.isCompleted ? "Total Amount Paid" : "Total Amount Due"}
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {formatLKR(displayState.payment.isCompleted ? (displayState.payment.totalPaid || displayState.summary.totalDue) : displayState.summary.totalDue)}
                </div>
              </div>

              {/* Given Cash & Balance / Change Section */}
              {((displayState.payment.isCompleted && (displayState.payment.method === "Cash" || displayState.payment.tendered > 0)) ||
                (displayState.payment.isOpen && displayState.payment.method === "Cash" && displayState.payment.tendered > 0 && displayState.summary.totalDue > 0)) && (
                <div className="pt-2 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                      Given Cash
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white">
                      {formatLKR(displayState.payment.tendered || (displayState.payment.isCompleted ? (displayState.payment.totalPaid || displayState.summary.totalDue) : 0))}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-brand-500 block">
                      Balance
                    </span>
                    <span className="text-2xl font-black text-brand-500">
                      {formatLKR(displayState.payment.changeDue)}
                    </span>
                  </div>
                </div>
              )}

              {/* Framebooks Product Branding Footer */}
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 select-none">
                <span>Powered by <strong className="text-white/70 font-bold">Framebooks POS</strong></span>
              </div>
            </div>
          )}

          {/* Live Date & Time at bottom of right sidebar */}
          {currentDateTime && (() => {
            const parts = formattedTime.split(" ");
            const timeOnly = parts[0] || formattedTime;
            const meridiem = parts[1] || "";
            return (
              <div className="mt-auto pt-6 pb-2 border-t border-white/5 flex flex-col items-center justify-center text-center select-none space-y-2">
                <div className="flex items-baseline justify-center gap-2.5 text-white">
                  <div className="flex items-center text-3xl sm:text-4xl font-black">
                    {timeOnly.split("").map((ch, idx) => {
                      if (ch === ":") {
                        return (
                          <span
                            key={idx}
                            className="inline-block w-[0.32em] text-center text-white select-none"
                          >
                            :
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          className="inline-block w-[0.65em] text-center tabular-nums"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {ch}
                        </span>
                      );
                    })}
                  </div>
                  {meridiem && (
                    <span className="text-lg sm:text-xl font-bold tracking-wider text-white/70 inline-block text-left">
                      {meridiem}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-medium tracking-wide text-white/50">
                  {formattedDate}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Floating Restore Fullscreen Button (shown when not in fullscreen) */}
      {!isFullscreen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            requestFullscreen();
          }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#0E131F]/95 hover:bg-[#182033] border border-brand-500/40 text-brand-400 hover:text-brand-300 shadow-2xl backdrop-blur-md transition-all cursor-pointer text-xs font-bold animate-in fade-in"
          title="Restore Fullscreen (or press F11)"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Enter Fullscreen</span>
        </button>
      )}
    </div>
  );
}
