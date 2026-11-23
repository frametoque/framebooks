"use client";
import { Loader } from "@/components/ui/Loader";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Building2,
  UploadCloud,
  CheckCircle2,
  Tag,
  AlertCircle,
  Clock,
  CreditCard,
  Building,
  Copy,
  Check,
  RefreshCw,
  FileText,
  X,
  Upload,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { MdArrowForward, MdKeyboardArrowLeft, MdCheck } from "react-icons/md";
import {
  completeOnboarding,
  validateCouponAction,
  getOnboardingPlansAction,
  getOnboardingStatusAction,
  initiateOnboardingCheckoutAction,
  completeOnboardingSandboxAction,
  getPaymentGatewayStatusAction,
  switchToFreePlanAction
} from "./actions";
import { plans as staticPlans } from "@/data/landing/content";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from 'next-auth/react';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user;
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("Pro");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<{ id: number; tenantName: string } | null>(null);
  const [responding, setResponding] = useState(false);

  // Dynamic plans & coupon state
  const [availablePlans, setAvailablePlans] = useState<any[]>(staticPlans);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Billing & Payment state
  const [activeTenantId, setActiveTenantId] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);

  // Renewal Notice Modal before redirecting to Payments.lk checkout
  const [renewalNoticeModalOpen, setRenewalNoticeModalOpen] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [showAllMobileFeatures, setShowAllMobileFeatures] = useState(false);

  useEffect(() => {
    getOnboardingPlansAction().then(res => {
      if (res?.success && res.plans && res.plans.length > 0) {
        setAvailablePlans(res.plans);
      }
    }).catch(() => { });

    getPaymentGatewayStatusAction().then(res => {
      if (res?.success && res.status) {
        setGatewayStatus(res.status);
      }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    async function checkInitialStatus() {
      try {
        // 1. Check existing tenant status
        const statusRes = await getOnboardingStatusAction();
        if (statusRes?.success && statusRes.hasTenant) {
          if (statusRes.isApproved) {
            router.push("/user/dashboard");
            return;
          }
          if (statusRes.needsPayment) {
            setBusinessName(statusRes.tenantName || "");
            setSelectedPlan(statusRes.plan || "Pro");
            if (statusRes.tenantId) setActiveTenantId(statusRes.tenantId);
            setStep(4); // Direct checkout step
            setCheckingInvite(false);
            return;
          }
        }

        // 2. Check for invitations
        const isCreateMode = typeof window !== 'undefined' &&
          (new URLSearchParams(window.location.search).get('create') === 'true' ||
            new URLSearchParams(window.location.search).get('mode') === 'create');

        const res = await fetch('/api/onboarding/check-invitations');
        const data = await res.json();
        if (data.redirect && !data.isPendingPayment) {
          router.push(data.redirect);
          return;
        } else if (data.hasInvitation && data.invite) {
          if (!isCreateMode) {
            setPendingInvite(data.invite);
            setStep(0); // Step 0: Invitation
          }
        }
      } catch (e) {
        console.error("Initial onboarding check failed", e);
      }
      setCheckingInvite(false);
    }
    checkInitialStatus();
  }, [router]);

  const handleRespondInvite = async (action: 'accept' | 'decline') => {
    if (!pendingInvite) return;
    setResponding(true);
    setErrorMsg("");
    try {
      const res = await fetch('/api/onboarding/respond-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: pendingInvite.id, action })
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'accept' && data.redirect) {
          await update();
          router.push(data.redirect);
        } else if (action === 'decline') {
          setPendingInvite(null);
          setStep(1); // Proceed to normal onboarding
        }
      } else {
        setErrorMsg("Failed to process invitation.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("An error occurred.");
    } finally {
      setResponding(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !businessName.trim()) return;
    setStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (step === 4) {
      setStep(3);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg("Logo must be under 2MB");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setErrorMsg("");
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const res = await validateCouponAction(couponInput, selectedPlan);
      if (res.success && res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponError("");
      } else {
        setCouponError(res.message || "Invalid or expired coupon code");
      }
    } catch {
      setCouponError("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Step 3 Completion: Handles Free vs Paid Plan
  async function handleSubmitPlan(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!businessName.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("businessName", businessName);
    if (logoFile) {
      formData.append("logo", logoFile);
    }
    formData.append("plan", selectedPlan);

    const codeToApply = appliedCoupon?.code || couponInput.trim();
    if (codeToApply) {
      formData.append("couponCode", codeToApply);
    }

    const result = await completeOnboarding(formData);
    if (result.success) {
      await update();
      if (result.tenantId) {
        setActiveTenantId(result.tenantId);
      }

      if (result.isComplimentary || selectedPlan === "Free") {
        router.push("/user/dashboard");
      } else {
        // Move to Onboarding Step 4: Billing Section (Do not redirect to /user/settings/billing!)
        setStep(4);
        setSubmitting(false);
      }
    } else {
      setErrorMsg(result.error || "Failed to set up your account. Please try again.");
      setSubmitting(false);
    }
  }

  // Step 4 Completion: Online Payment Gateway Checkout
  async function handleGatewayCheckout() {
    setProcessingPayment(true);
    setErrorMsg("");

    try {
      const res = await initiateOnboardingCheckoutAction({
        tenantId: activeTenantId || undefined,
        planName: selectedPlan,
        billingCycle,
        couponCode: appliedCoupon?.code,
      });

      if (!res.success || !("provider" in res)) {
        setErrorMsg((res as any).error || "Failed to initiate online checkout.");
        return;
      }

      if (res.checkoutUrl) {
        if (res.checkoutUrl.includes("/billing/success")) {
          window.location.href = res.checkoutUrl;
          return;
        }
        setPendingCheckoutUrl(res.checkoutUrl);
        setRenewalNoticeModalOpen(true);
      } else if (res.formData && res.provider === "payhere") {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = res.checkoutUrl || "https://sandbox.payhere.lk/pay/checkout";
        Object.entries(res.formData).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = String(v);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      }
    } catch (err: any) {
      console.error("Gateway checkout error:", err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setProcessingPayment(false);
    }
  }

  // Step 4 Sandbox fallback when keys not yet placed in .env
  async function handleSandboxCheckout() {
    setProcessingPayment(true);
    setErrorMsg("");

    try {
      if (!activeTenantId) {
        setErrorMsg("Workspace ID not found. Please refresh the page.");
        return;
      }
      const currentPlanObj = displayPlans.find(
        (p: any) => p.name.toLowerCase() === selectedPlan.toLowerCase()
      );
      const baseMonthly = currentPlanObj?.monthlyPrice ?? currentPlanObj?.price_monthly ?? 0;
      const baseYearly = currentPlanObj?.yearlyPrice ?? currentPlanObj?.price_yearly ?? (baseMonthly * 10);
      const basePrice = billingCycle === "monthly" ? baseMonthly : baseYearly;
      const priceInfo = getFinalPrice(basePrice, true);

      const res = await completeOnboardingSandboxAction({
        tenantId: activeTenantId,
        planName: selectedPlan,
        billingCycle,
        amount: priceInfo.finalPrice,
      });

      if (res.success) {
        await update();
        router.push("/user/dashboard");
      } else {
        setErrorMsg(res.error || "Failed to complete test payment.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete test payment.");
    } finally {
      setProcessingPayment(false);
    }
  }

  // Switch to Free Plan fallback
  async function handleSwitchToFree() {
    if (!confirm("Are you sure you want to cancel and continue with the Free plan instead?")) return;
    setSubmitting(true);
    try {
      const res = await switchToFreePlanAction();
      if (res.success) {
        await update();
        router.push("/user/dashboard");
      } else {
        setErrorMsg(res.error || "Failed to switch plan.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to switch plan.");
    } finally {
      setSubmitting(false);
    }
  }

  const getFinalPrice = (monthlyPrice: number, isPlanSelected: boolean) => {
    if (monthlyPrice === 0) return { finalPrice: 0, isFree: true, isDiscounted: false, text: "" };
    if (!isPlanSelected || !appliedCoupon) return { finalPrice: monthlyPrice, isFree: false, isDiscounted: false, text: "" };

    if (appliedCoupon.isComplimentary) {
      return { finalPrice: 0, isFree: true, isDiscounted: true, text: "Complimentary (100% OFF)" };
    }
    if (appliedCoupon.type === "percent") {
      const discounted = Math.max(0, monthlyPrice * (1 - appliedCoupon.value / 100));
      return { finalPrice: discounted, isFree: discounted === 0, isDiscounted: true, text: `${appliedCoupon.value}% OFF` };
    }
    if (appliedCoupon.type === "fixed") {
      const discounted = Math.max(0, monthlyPrice - appliedCoupon.value);
      return { finalPrice: discounted, isFree: discounted === 0, isDiscounted: true, text: `LKR ${Number(appliedCoupon.value).toLocaleString()} OFF` };
    }
    return { finalPrice: monthlyPrice, isFree: false, isDiscounted: false, text: "" };
  };

  const inputCls =
    "w-full bg-white border border-[#E5E7EB] hover:border-gray-300 " +
    "focus:border-[#00E35B]/50 focus:outline-none focus:ring-2 focus:ring-[#00E35B]/20 " +
    "rounded-2xl px-5 py-3.5 text-sm text-[#082830] placeholder-gray-400 transition-all shadow-sm";

  const slideVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const displayPlans = availablePlans.length > 0
    ? availablePlans
    : staticPlans;

  // Selected plan calculation for Step 4
  const currentPlanObj = displayPlans.find(
    (p: any) => p.name.toLowerCase() === selectedPlan.toLowerCase()
  );
  const baseMonthly = currentPlanObj?.monthlyPrice ?? currentPlanObj?.price_monthly ?? 0;
  const baseYearly = currentPlanObj?.yearlyPrice ?? currentPlanObj?.price_yearly ?? (baseMonthly * 10);
  const basePrice = billingCycle === "monthly" ? baseMonthly : baseYearly;
  const activePriceInfo = getFinalPrice(basePrice, true);

  if (checkingInvite) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }



  // ─────────────────────────────────────────────────────────────
  // STEP 4: Payment Gateway Checkout & Activation
  // ─────────────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] text-[#082830] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto">
          {/* Top Header */}
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <Image
              src="/logos/ft/name-logo.png"
              alt="FrameBooks"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
            <button
              type="button"
              onClick={handlePrev}
              disabled={processingPayment}
              className="text-gray-600 hover:text-[#082830] transition-colors flex items-center gap-1.5 text-sm font-semibold cursor-pointer px-3.5 py-2 rounded-xl hover:bg-gray-200/60"
            >
              <MdKeyboardArrowLeft className="w-5 h-5" />
              <span>Back to Plans</span>
            </button>
          </div>

          {/* Heading */}
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6FDF0] text-[#007A31] border border-[#00E35B]/20 text-xs font-bold mb-3">
              <span>Step 4 of 4</span>
              <span>•</span>
              <span>Checkout & Activation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#082830] tracking-tight">
              Activate your {selectedPlan} subscription<span className="text-[#00E35B]">.</span>
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-2 leading-relaxed">
              Complete your payment via secure online checkout to activate your workspace instantly.
            </p>
          </div>

          {errorMsg && (
            <div className="max-w-md mx-auto text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {errorMsg}
            </div>
          )}

          {/* Checkout Card */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 sm:p-8 shadow-xs space-y-6 mb-8">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#082830]">Online Checkout</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Instant activation with credit card, debit card, or payment gateway.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E6FDF0] text-[#007A31] border border-[#00E35B]/20 text-xs font-bold shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#00C750]" />
                <span>256-bit Encrypted</span>
              </div>
            </div>

            {/* Plan & Cycle Summary Box */}
            <div className="p-5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-gray-500 font-medium">Selected Plan:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-[#082830]">{selectedPlan}</span>
                    {activePriceInfo.text && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6FDF0] text-[#007A31] font-bold">
                        {activePriceInfo.text}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                      billingCycle === "monthly"
                        ? "bg-[#082830] text-white border-[#082830]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                      billingCycle === "yearly"
                        ? "bg-[#082830] text-white border-[#082830]"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    Yearly (Save 17% · 2 Mo Free)
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Total Amount</span>
                <div className="flex items-baseline gap-2">
                  {activePriceInfo.isDiscounted && !activePriceInfo.isFree && (
                    <span className="text-sm line-through text-gray-400">
                      LKR {Number(basePrice).toLocaleString()}
                    </span>
                  )}
                  <span className="text-2xl sm:text-3xl font-black text-[#082830]">
                    LKR {Number(activePriceInfo.finalPrice).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Gateway Checkout Actions */}
            <div className="space-y-3 pt-2">
              {gatewayStatus?.cardPaymentsDisabled && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Card payments are disabled on live.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGatewayCheckout}
                disabled={processingPayment || Boolean(gatewayStatus?.cardPaymentsDisabled)}
                className={`w-full py-4 font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] text-sm ${
                  gatewayStatus?.cardPaymentsDisabled
                    ? "opacity-50 cursor-not-allowed bg-gray-300 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    : "bg-[#00E35B] hover:bg-[#00C750] text-[#041418] cursor-pointer"
                }`}
                title={gatewayStatus?.cardPaymentsDisabled ? "Card payments are disabled on live" : undefined}
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Secure Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {!gatewayStatus?.isConfigured && (
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSandboxCheckout}
                    disabled={processingPayment}
                    className="w-full py-3 bg-[#082830] hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Complete Test Checkout (Sandbox Mode)</span>
                  </button>
                  <p className="text-[11px] text-gray-500 text-center">
                    Note: Payments.lk keys pending in <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env.local</code>. Use sandbox button above to complete instant test onboarding.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-[#E5E7EB] text-center">
                <button
                  type="button"
                  onClick={handleSwitchToFree}
                  disabled={submitting || processingPayment}
                  className="text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer underline underline-offset-4"
                >
                  Start with Free Plan instead (Upgrade later)
                </button>
              </div>
            </div>
          </div>

          {/* Progress Indicators (4 clean steps) */}
          <div className="flex justify-center gap-2 mt-8 pb-4">
            <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
            <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
            <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
            <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Pricing Plans & Coupon
  // ─────────────────────────────────────────────────────────────
  if (step === 3) {
    const isPaid = selectedPlan !== "Free" && (!appliedCoupon || !appliedCoupon.isComplimentary);
    const selectedPlanObj = displayPlans.find((p: any) => p.name === selectedPlan);
    const selectedPriceInfo = getFinalPrice(selectedPlanObj?.monthlyPrice ?? selectedPlanObj?.price_monthly ?? 0, true);

    return (
      <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#F9FAFB] text-[#082830] flex flex-col">

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-20 bg-[#F9FAFB]/95 backdrop-blur-sm border-b border-[#E5E7EB]/60 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Image
            src="/logos/ft/name-logo.png"
            alt="FrameBooks"
            width={130}
            height={28}
            className="h-7 w-auto"
          />
          <button
            type="button"
            onClick={handlePrev}
            disabled={submitting}
            className="text-gray-600 hover:text-[#082830] transition-colors flex items-center gap-1.5 text-sm font-semibold cursor-pointer px-3 py-1.5 rounded-xl hover:bg-gray-200/60"
          >
            <MdKeyboardArrowLeft className="w-5 h-5" />
            <span>Back to Logo</span>
          </button>
        </div>

        {/* ── CONTENT (mobile: scrollable · desktop: fixed height flex column) ── */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden pb-36 md:pb-0 px-4 sm:px-6 lg:px-8 pt-5 md:flex md:flex-col md:min-h-0">
          <div className="max-w-6xl w-full mx-auto md:flex md:flex-col md:flex-1 md:min-h-0">

            {/* Step badge + heading */}
            <div className="text-center max-w-2xl mx-auto mb-5 md:mb-3 md:shrink-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6FDF0] text-[#007A31] border border-[#00E35B]/20 text-xs font-bold mb-2">
                <span>Step 3 of 4</span>
                <span>•</span>
                <span>Workspace Setup</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-3xl font-black text-[#082830] tracking-tight">
                Start free. Upgrade when you grow<span className="text-[#00E35B]">.</span>
              </h1>
              <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
                Select the pricing plan for <strong className="text-[#082830]">{businessName || "your business"}</strong>. Switch or cancel anytime.
              </p>
            </div>

            {errorMsg && (
              <div className="max-w-md mx-auto text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
                {errorMsg}
              </div>
            )}

            {/* ════════════════════════════════════════════
                MOBILE: Compact tap-to-select plan cards
                (hidden on md+)
                ════════════════════════════════════════════ */}
            <div className="md:hidden space-y-3 mb-6">
              {/* Instruction hint */}
              <p className="text-center text-xs text-gray-400 font-medium mb-1">
                Tap a plan to select it
              </p>

              {displayPlans.map((p: any, i: number) => {
                const isSelected = selectedPlan === p.name;
                const priceInfo = getFinalPrice(p.monthlyPrice ?? p.price_monthly ?? 0, isSelected);
                const isExpanded = isSelected && showAllMobileFeatures;

                return (
                  <div
                    key={p.name || i}
                    onClick={() => {
                      setSelectedPlan(p.name);
                      setShowAllMobileFeatures(false);
                    }}
                    className={`relative rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#00E35B] ring-2 ring-[#00E35B] bg-[#E6FDF0]/20 shadow-md"
                        : p.highlight
                        ? "border-[#00E35B]/40 bg-white shadow-xs"
                        : "border-[#E5E7EB] bg-white shadow-xs"
                    }`}
                  >
                    {/* Badge */}
                    {p.badge && (
                      <div className="absolute -top-2.5 left-4 bg-[#082830] text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                        {p.badge}
                      </div>
                    )}

                    {/* Card header row */}
                    <div className="flex items-center justify-between p-4 gap-3">
                      {/* Left: radio + name + description */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? "border-[#00E35B] bg-[#00E35B]" : "border-gray-300 bg-white"
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-[#082830]">{p.name}</span>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-[#007A31] bg-[#E6FDF0] px-2 py-0.5 rounded-full border border-[#00E35B]/30">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: price */}
                      <div className="text-right shrink-0">
                        <div className="text-xl font-black text-[#082830] leading-none">
                          {priceInfo.isFree ? "Free" : `LKR ${Number(priceInfo.finalPrice).toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {priceInfo.isFree ? "forever" : "/mo"}
                        </div>
                      </div>
                    </div>

                    {/* Expandable features (only on selected card) */}
                    {isSelected && (
                      <div className="px-4 pb-4">
                        <div className={`space-y-0 overflow-hidden transition-all ${isExpanded ? "" : ""}`}>
                          {/* Always show first 4 features */}
                          {Array.isArray(p.features) && p.features.slice(0, isExpanded ? p.features.length : 4).map((f: any, j: number) => (
                            <div
                              key={j}
                              className="flex items-center justify-between text-xs text-gray-700 border-b border-[#E5E7EB]/50 py-2 last:border-0 gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-[#E6FDF0] text-[#00C750] rounded-full flex items-center justify-center shrink-0">
                                  <MdCheck className="w-2.5 h-2.5" />
                                </div>
                                <span className="text-gray-600">{f.label}</span>
                              </div>
                              <span className="font-bold text-gray-900 shrink-0">{f.value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Show more / less toggle */}
                        {Array.isArray(p.features) && p.features.length > 4 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllMobileFeatures(!showAllMobileFeatures);
                            }}
                            className="mt-2 text-[11px] text-[#007A31] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllMobileFeatures ? "rotate-180" : ""}`} />
                            {showAllMobileFeatures
                              ? "Show less"
                              : `+${p.features.length - 4} more features`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ════════════════════════════════════════════
                DESKTOP: Full 3-column plan grid
                (hidden on <md)
                ════════════════════════════════════════════ */}
            <div className="hidden md:grid md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] gap-4 lg:gap-5 items-stretch max-w-5xl mx-auto mb-3 md:flex-1 md:min-h-0 md:overflow-visible pt-4">
              {displayPlans.map((p: any, i: number) => {
                const isSelected = selectedPlan === p.name;
                const priceInfo = getFinalPrice(p.monthlyPrice ?? p.price_monthly ?? 0, isSelected);

                return (
                  <div
                    key={p.name || i}
                    onClick={() => setSelectedPlan(p.name)}
                    className={`bg-white rounded-3xl p-5 border relative shadow-xs hover:shadow-lg transition-all flex flex-col h-full min-h-0 cursor-pointer ${
                      isSelected
                        ? "border-[#00E35B] ring-2 ring-[#00E35B] shadow-md bg-[#E6FDF0]/10"
                        : p.highlight
                        ? "border-[#00E35B]/50 ring-1 ring-[#00E35B]/20"
                        : "border-[#E5E7EB]"
                    }`}
                  >
                    {p.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#082830] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">
                        {p.badge}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-2xl font-black text-[#082830]">{p.name}</h3>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#007A31] bg-[#E6FDF0] px-2.5 py-0.5 rounded-full border border-[#00E35B]/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00C750]" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed shrink-0 hidden">{p.description}</p>

                    <div className="mb-3 pb-3 border-b border-[#E5E7EB]/60 shrink-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {priceInfo.isDiscounted && !priceInfo.isFree && (
                          <span className="text-lg line-through text-gray-400 font-medium">
                            LKR {Number(p.monthlyPrice ?? p.price_monthly).toLocaleString()}
                          </span>
                        )}
                        <span className="text-3xl font-black text-gray-900 tracking-tight">
                          {priceInfo.isFree ? "Free" : `LKR ${Number(priceInfo.finalPrice).toLocaleString()}`}
                        </span>
                        <span className="text-gray-500 font-medium text-sm">
                          {priceInfo.isFree ? "forever" : "/mo"}
                        </span>
                      </div>
                      {priceInfo.isDiscounted && priceInfo.text && (
                        <p className="text-xs text-[#007A31] font-bold mt-1.5 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#00C750]" />
                          <span>{priceInfo.text}</span>
                        </p>
                      )}
                    </div>

                    {/* Feature list with scroll-fade hint */}
                    <div className="flex-1 min-h-0 relative">
                      <ul className="space-y-0 h-full overflow-y-auto mb-3 pr-0.5 scrollbar-thin">
                        {Array.isArray(p.features) && p.features.map((f: any, j: number) => (
                          <li
                            key={j}
                            className="flex items-center justify-between text-xs font-medium text-gray-700 border-b border-[#E5E7EB]/40 py-2 last:border-0 gap-2"
                          >
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 bg-[#E6FDF0] text-[#00C750] rounded-full flex items-center justify-center shrink-0">
                              <MdCheck className="w-3 h-3" />
                            </div>
                            <span className="text-gray-600">{f.label}</span>
                          </div>
                          <span className="font-bold text-gray-900 text-right shrink-0">{f.value}</span>
                        </li>
                      ))}
                      </ul>
                      {/* Fade gradient — signals more features below */}
                      <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t ${isSelected ? "from-[#f0fdf6]" : "from-white"} to-transparent rounded-b-xl`} />
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedPlan(p.name); }}
                      className={`w-full py-3.5 rounded-xl font-bold text-center mt-auto transition-all cursor-pointer text-sm flex items-center justify-center gap-2 ${
                        isSelected
                          ? "bg-[#00E35B] text-[#041418] hover:bg-[#00C750] shadow-md shadow-[#00E35B]/20"
                          : p.highlight
                          ? "bg-[#082830] text-white hover:bg-black"
                          : "bg-white hover:bg-gray-50 border border-[#E5E7EB] text-[#082830]"
                      }`}
                    >
                      {isSelected ? (
                        <><CheckCircle2 className="w-4 h-4 text-[#041418]" /><span>Selected Plan</span></>
                      ) : (
                        <span>Select {p.name}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Coupon section — inline on desktop, hidden on mobile (in sticky CTA) ── */}
            <div className="hidden md:block max-w-md mx-auto w-full space-y-2 mb-1 md:shrink-0">
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#082830] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#00C750]" />
                    Have a coupon code?
                  </span>
                  {appliedCoupon && (
                    <button type="button" onClick={handleRemoveCoupon} className="text-[11px] text-gray-500 hover:text-red-500 font-semibold cursor-pointer">
                      Remove
                    </button>
                  )}
                </div>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      placeholder="ENTER CODE"
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon(); } }}
                      className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#00E35B] focus:bg-white rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#082830] uppercase outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="px-4 py-2 bg-[#082830] hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {validatingCoupon && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Apply</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#E6FDF0] border border-[#00E35B]/30 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00C750] shrink-0" />
                      <span className="font-mono font-bold text-[#082830]">{appliedCoupon.code}</span>
                      <span className="text-[#007A31] font-semibold">({appliedCoupon.discountText})</span>
                    </div>
                  </div>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{couponError}</span>
                  </p>
                )}
              </div>

              {/* Desktop CTA */}
              <button
                type="button"
                onClick={() => handleSubmitPlan()}
                disabled={submitting}
                className="w-full rounded-2xl bg-[#00E35B] hover:bg-[#00C750] disabled:opacity-50 disabled:cursor-not-allowed text-[#041418] font-black py-3 text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
              >
                {submitting ? (
                  <><Loader size="sm" /> Finalizing Setup...</>
                ) : isPaid ? (
                  <><span>Continue to Billing for {selectedPlan}</span> <ArrowRight className="h-4 w-4" /></>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Complete Setup with {selectedPlan}</>
                )}
              </button>
              <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500 pt-1 font-medium text-center">
                <span>✓ No hidden charges</span>
                <span>•</span>
                <span>Switch or cancel anytime</span>
              </div>
            </div>

          </div>
        </div>

        {/* ════════════════════════════════════════════
            MOBILE STICKY BOTTOM CTA BAR
            (hidden on md+)
            ════════════════════════════════════════════ */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] px-4 pt-3 pb-5 shadow-2xl">

          {/* Coupon row */}
          <div className="mb-3">
            {!appliedCoupon && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  placeholder="Have a coupon code?"
                  onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon(); } }}
                  className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#00E35B] focus:bg-white rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-[#082830] uppercase outline-none transition-colors placeholder:normal-case placeholder:font-sans placeholder:font-semibold placeholder:text-gray-400 placeholder:not-italic"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="px-4 py-2 bg-[#082830] hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {validatingCoupon ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Apply</span>}
                </button>
              </div>
            )}

            {couponError && (
              <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{couponError}</span>
              </p>
            )}

            {appliedCoupon && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#E6FDF0] border border-[#00E35B]/30 text-xs mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#00C750] shrink-0" />
                  <span className="font-mono font-bold text-[#082830]">{appliedCoupon.code}</span>
                  <span className="text-[#007A31] font-semibold">({appliedCoupon.discountText})</span>
                </div>
                <button type="button" onClick={handleRemoveCoupon} className="text-[11px] text-gray-500 hover:text-red-500 font-semibold cursor-pointer">
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Selected plan summary + CTA */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-500 font-medium">Selected plan</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-[#082830]">{selectedPlan}</span>
                <span className="text-xs text-gray-500">
                  — {selectedPriceInfo.isFree ? "Free forever" : `LKR ${Number(selectedPriceInfo.finalPrice).toLocaleString()}/mo`}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubmitPlan()}
              disabled={submitting}
              className="shrink-0 rounded-2xl bg-[#00E35B] hover:bg-[#00C750] disabled:opacity-50 disabled:cursor-not-allowed text-[#041418] font-black px-5 py-3.5 text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              {submitting ? (
                <Loader size="sm" />
              ) : isPaid ? (
                <><span>Continue</span><ArrowRight className="h-4 w-4" /></>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /><span>Complete Setup</span></>
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-gray-400 font-medium mt-2">
            ✓ No hidden charges · Switch or cancel anytime
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEPS 0, 1, 2: Standard Left/Right Panel Onboarding
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-[#082830] overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="relative flex flex-col justify-center w-full lg:w-1/2 px-8 sm:px-16 py-16">
        <div className="relative z-10 max-w-sm w-full mx-auto">

          <div className="mb-8 flex justify-between items-center">
            <Image
              src="/logos/ft/name-logo.png"
              alt="FrameBooks"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
            {step > 1 && !submitting && (
              <button onClick={handlePrev} className="text-gray-500 hover:text-[#082830] transition-colors flex items-center gap-1 text-sm font-medium cursor-pointer">
                <MdKeyboardArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {errorMsg}
            </div>
          )}

          <div className="relative min-h-[480px]">
            <AnimatePresence mode="wait">
              {step === 0 && pendingInvite && (
                <motion.div
                  key="step0"
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    <span className="text-[#082830]">
                      You're Invited!
                    </span>
                  </h1>
                  <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                    You have been invited to join the team for <strong className="text-[#082830]">{pendingInvite.tenantName}</strong>.
                    Would you like to accept this invitation or decline and create your own business profile?
                  </p>

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => handleRespondInvite('accept')}
                      disabled={responding}
                      className="w-full rounded-2xl bg-[#00E35B] hover:bg-[#00C750]
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-[#041418] font-bold py-3.5 text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {responding ? <Loader size="sm" /> : "Accept Invitation"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRespondInvite('decline')}
                      disabled={responding}
                      className="w-full rounded-2xl bg-white border border-[#E5E7EB] hover:bg-gray-50
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-[#082830] font-bold py-3.5 text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Decline & Create My Own
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    <span className="text-[#082830]">
                      Welcome, {(user as any)?.firstName || user?.name?.split(' ')[0] || "there"}!
                    </span>
                  </h1>
                  <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                    Let's start by naming your business workspace. You can change this later.
                  </p>

                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
                        placeholder="My Company (Pvt) Ltd."
                        className={inputCls + " pl-11"}
                      />
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!businessName.trim()}
                      className="w-full mt-2 rounded-2xl bg-[#00E35B] hover:bg-[#00C750]
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-[#041418] font-bold py-3.5 text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Continue <MdArrowForward className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    <span className="text-[#082830]">
                      Add your logo
                    </span>
                  </h1>
                  <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                    Upload your business logo. This will be used on your invoices and across the platform. (Optional)
                  </p>

                  <div className="space-y-6">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-[#E5E7EB] hover:border-[#00C750]/50 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-white shadow-sm group"
                    >
                      {logoPreview ? (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                          <Image src={logoPreview} alt="Logo Preview" className="max-h-full max-w-full object-contain rounded-xl" width={800} height={800} unoptimized={true} />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                            <span className="text-sm font-medium text-white">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-gray-500 group-hover:text-brand-400 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
                            <UploadCloud className="w-6 h-6" />
                          </div>
                          <span className="text-sm font-medium">Click to upload logo</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoChange}
                        accept="image/png, image/jpeg, image/svg+xml"
                        className="hidden"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full rounded-2xl bg-[#00E35B] hover:bg-[#00C750]
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-[#041418] font-bold py-3.5 text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Continue <MdArrowForward className="h-4 w-4" />
                    </button>

                    {!logoPreview && !submitting && (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="w-full text-center text-xs text-gray-600 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        Skip for now
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-2 mt-8">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? "w-8 bg-[#00E35B]" : "w-4 bg-[#F9FAFB] border border-[#E5E7EB]"}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? "w-8 bg-[#00E35B]" : "w-4 bg-[#F9FAFB] border border-[#E5E7EB]"}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? "w-8 bg-[#00E35B]" : "w-4 bg-[#F9FAFB] border border-[#E5E7EB]"}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 4 ? "w-8 bg-[#00E35B]" : "w-4 bg-[#F9FAFB] border border-[#E5E7EB]"}`} />
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-white border-l border-[#E5E7EB] items-center justify-center">
        <div className="max-w-md text-center p-12">
          <div className="w-16 h-16 bg-[#E6FDF0] text-[#00C750] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-3xl font-black text-[#082830] mb-4">Set up your business<span className="text-[#00E35B]">.</span></h2>
          <p className="text-gray-500 leading-relaxed">It only takes a minute to get your account ready to manage invoices, expenses, and quotations.</p>
        </div>
      </div>

      {/* Automatic Renewal Checkout Guidance Modal */}
      {renewalNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 text-foreground">
          <div className="bg-white dark:bg-zinc-900 border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Automatic Renewal Notice</h3>
              <button
                type="button"
                onClick={() => {
                  setRenewalNoticeModalOpen(false);
                  setPendingCheckoutUrl(null);
                }}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction description */}
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                If you want <strong>automatic renewal</strong>, please make sure to <strong>tick the highlighted checkbox</strong> on the upcoming checkout page:
              </p>

              {/* Checkout Preview with Highlighted Box */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex items-center justify-center p-2.5">
                <img
                  src="/images/payments-checkout-guide.png"
                  alt="Payments.lk checkout preview with keep card on file highlighted"
                  className="w-full max-h-60 sm:max-h-72 object-contain rounded-xl select-none shadow-xs pointer-events-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <p className="leading-relaxed">
                  <strong>Otherwise:</strong> Your card will not be saved, and you will need to pay manually at the end of each billing cycle to prevent your workspace from reverting to the Free plan.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRenewalNoticeModalOpen(false);
                  setPendingCheckoutUrl(null);
                }}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 font-bold text-xs text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingCheckoutUrl) {
                    window.location.href = pendingCheckoutUrl;
                  }
                }}
                className="py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
