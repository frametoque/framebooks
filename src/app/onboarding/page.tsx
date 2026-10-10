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
  AlertCircle
} from "lucide-react";
import { MdArrowForward, MdKeyboardArrowLeft, MdCheck } from "react-icons/md";
import { completeOnboarding, validateCouponAction, getOnboardingPlansAction } from "./actions";
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
  const [selectedPlan, setSelectedPlan] = useState("Free");
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

  useEffect(() => {
    getOnboardingPlansAction().then(res => {
      if (res?.success && res.plans && res.plans.length > 0) {
        setAvailablePlans(res.plans);
      }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    async function checkInvite() {
      try {
        const res = await fetch('/api/onboarding/check-invitations');
        const data = await res.json();
        if (data.redirect) {
          router.push(data.redirect);
          return;
        } else if (data.hasInvitation && data.invite) {
          setPendingInvite(data.invite);
          setStep(0); // Step 0: Invitation
        }
      } catch (e) {
        console.error("Invite check failed", e);
      }
      setCheckingInvite(false);
    }
    checkInvite();
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

  async function handleSubmit(e?: React.FormEvent) {
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
      if (result.isComplimentary || selectedPlan === "Free") {
        router.push("/user/dashboard");
      } else {
        router.push("/user/settings/billing");
      }
    } else {
      setErrorMsg(result.error || "Failed to set up your account. Please try again.");
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

  if (step === 3) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] text-[#082830] flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto">
          {/* Header */}
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
              disabled={submitting}
              className="text-gray-600 hover:text-[#082830] transition-colors flex items-center gap-1.5 text-sm font-semibold cursor-pointer px-3.5 py-2 rounded-xl hover:bg-gray-200/60"
            >
              <MdKeyboardArrowLeft className="w-5 h-5" />
              <span>Back to Logo</span>
            </button>
          </div>

          {/* Heading */}
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6FDF0] text-[#007A31] border border-[#00E35B]/20 text-xs font-bold mb-3">
              <span>Step 3 of 3</span>
              <span>•</span>
              <span>Workspace Setup</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#082830] tracking-tight">
              Start free. Upgrade when you grow<span className="text-[#00E35B]">.</span>
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-2.5 leading-relaxed">
              Select the pricing plan for <strong className="text-[#082830]">{businessName || "your business"}</strong>. You can switch plans or cancel anytime.
            </p>
          </div>

          {errorMsg && (
            <div className="max-w-md mx-auto text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl text-sm mb-8 text-center">
              {errorMsg}
            </div>
          )}

          {/* 3 Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-5xl mx-auto mb-10">
            {displayPlans.map((p: any, i: number) => {
              const isSelected = selectedPlan === p.name;
              const priceInfo = getFinalPrice(p.monthlyPrice ?? p.price_monthly ?? 0, isSelected);

              return (
                <div
                  key={p.name || i}
                  onClick={() => setSelectedPlan(p.name)}
                  className={`bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border relative shadow-xs hover:shadow-lg transition-all flex flex-col h-full cursor-pointer ${
                    isSelected
                      ? "border-[#00E35B] ring-2 ring-[#00E35B] shadow-md bg-[#E6FDF0]/10"
                      : p.highlight
                        ? "border-[#00E35B]/50 ring-1 ring-[#00E35B]/20"
                        : "border-[#E5E7EB]"
                  }`}
                >
                  {/* Badge */}
                  {p.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#082830] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">
                      {p.badge}
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xl sm:text-2xl font-black text-[#082830]">{p.name}</h3>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#007A31] bg-[#E6FDF0] px-2.5 py-0.5 rounded-full border border-[#00E35B]/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00C750]" /> Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mb-6 min-h-[32px] sm:min-h-[40px] leading-relaxed">
                    {p.description}
                  </p>

                  {/* Pricing */}
                  <div className="mb-6 pb-5 border-b border-[#E5E7EB]/60">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {priceInfo.isDiscounted && !priceInfo.isFree && (
                        <span className="text-lg line-through text-gray-400 font-medium">
                          LKR {Number(p.monthlyPrice ?? p.price_monthly).toLocaleString()}
                        </span>
                      )}
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        {priceInfo.isFree
                          ? "Free"
                          : `LKR ${Number(priceInfo.finalPrice).toLocaleString()}`}
                      </span>
                      <span className="text-gray-500 font-medium text-xs sm:text-sm">
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

                  {/* Features List */}
                  <ul className="space-y-3 flex-1 mb-6 sm:mb-8">
                    {Array.isArray(p.features) && p.features.map((f: any, j: number) => (
                      <li
                        key={j}
                        className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-700 border-b border-[#E5E7EB]/40 pb-2.5 last:border-0 last:pb-0 gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 bg-[#E6FDF0] text-[#00C750] rounded-full flex items-center justify-center shrink-0">
                            <MdCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </div>
                          <span className="text-gray-600">{f.label}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-right shrink-0">{f.value}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(p.name);
                    }}
                    className={`w-full py-3 sm:py-3.5 rounded-xl font-bold text-center mt-auto transition-all cursor-pointer text-xs sm:text-sm flex items-center justify-center gap-2 ${
                      isSelected
                        ? "bg-[#00E35B] text-[#041418] hover:bg-[#00C750] shadow-md shadow-[#00E35B]/20"
                        : p.highlight
                          ? "bg-[#082830] text-white hover:bg-black"
                          : "bg-white hover:bg-gray-50 border border-[#E5E7EB] text-[#082830]"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#041418]" />
                        <span>Selected Plan</span>
                      </>
                    ) : (
                      <span>Select {p.name}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom Coupon & Submit Section */}
          <div className="max-w-md mx-auto w-full space-y-4">
            {/* Coupon Code Section */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#082830] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#00C750]" />
                  Have a coupon code?
                </span>
                {appliedCoupon && (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-[11px] text-gray-500 hover:text-red-500 font-semibold cursor-pointer"
                  >
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
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
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

            {/* Complete Setup */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="w-full rounded-2xl bg-[#00E35B] hover:bg-[#00C750]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-[#041418] font-black py-4 text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
            >
              {submitting ? (
                <><Loader size="sm" /> Finalizing Setup...</>
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

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2 mt-12 pb-4">
          <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
          <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
          <div className="h-1.5 rounded-full w-8 bg-[#00E35B] transition-all" />
        </div>
      </div>
    );
  }

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
                        placeholder="e.g. Acme Corp"
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
    </div>
  );
}
