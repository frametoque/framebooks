"use client";
import { Loader } from "@/components/ui/Loader";


import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Building2, UploadCloud, CheckCircle2 } from "lucide-react";
import { MdArrowForward, MdKeyboardArrowLeft } from "react-icons/md";
import { completeOnboarding } from "./actions";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from 'next-auth/react';

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

    const result = await completeOnboarding(formData);
    if (result.success) {
      await user?.reload();
      if (selectedPlan !== "Free") {
        router.push("/user/settings?tab=billing");
      } else {
        router.push("/user/dashboard");
      }
    } else {
      setErrorMsg(result.error || "Failed to set up your account. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full bg-slate-900 border border-slate-800 hover:border-slate-700 " +
    "focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 " +
    "rounded-2xl px-5 py-3.5 text-sm text-slate-200 placeholder-slate-500 transition-all";

  const slideVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  if (checkingInvite) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
        <Loader size="lg" />
        <p className="text-gray-400">Checking invitations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex text-foreground overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="relative flex flex-col justify-center w-full lg:w-1/2 px-8 sm:px-16 py-16">
        <div className="relative z-10 max-w-sm w-full mx-auto">
          
          <div className="mb-12 flex justify-between items-center">
            <Image
              src="/logos/ft/name-logo.png"
              alt="FrameBooks"
              width={160}
              height={32}
              className="h-8 w-auto opacity-90"
            />
            {step > 1 && !submitting && (
              <button onClick={handlePrev} className="text-slate-400 hover:text-foreground transition-colors flex items-center gap-1 text-sm font-medium">
                <MdKeyboardArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6 text-center">
              {errorMsg}
            </div>
          )}

          <div className="relative min-h-[300px]">
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
                    <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                      You're Invited!
                    </span>
                  </h1>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    You have been invited to join the team for <strong className="text-foreground">{pendingInvite.tenantName}</strong>. 
                    Would you like to accept this invitation or decline and create your own business profile?
                  </p>

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => handleRespondInvite('accept')}
                      disabled={responding}
                      className="w-full rounded-2xl bg-brand-500 hover:bg-brand-400
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-foreground font-medium py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {responding ? <Loader size="sm" /> : "Accept Invitation"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleRespondInvite('decline')}
                      disabled={responding}
                      className="w-full rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-slate-300 font-medium py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
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
                    <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                      Welcome, {user?.firstName || "there"}!
                    </span>
                  </h1>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">
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
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!businessName.trim()}
                      className="w-full mt-2 rounded-2xl bg-brand-500 hover:bg-brand-400
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-foreground font-medium py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
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
                    <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                      Add your logo
                    </span>
                  </h1>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    Upload your business logo. This will be used on your invoices and across the platform. (Optional)
                  </p>

                  <div className="space-y-6">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-slate-700 hover:border-brand-500/50 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/50 group"
                    >
                      {logoPreview ? (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                          <img src={logoPreview} alt="Logo Preview" className="max-h-full max-w-full object-contain rounded-xl" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                            <span className="text-sm font-medium text-foreground">Change Logo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-brand-400 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
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
                      className="w-full rounded-2xl bg-brand-500 hover:bg-brand-400
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-foreground font-medium py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      Continue <MdArrowForward className="h-4 w-4" />
                    </button>
                    
                    {!logoPreview && !submitting && (
                      <button 
                        type="button" 
                        onClick={handleNext}
                        className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Skip for now
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  variants={slideVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                      Choose a Plan
                    </span>
                  </h1>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    Select a pricing plan that fits your business needs.
                  </p>

                  <div className="space-y-4 mb-8">
                    {["Free", "Pro", "Enterprise"].map((planName) => (
                      <button
                        key={planName}
                        onClick={() => setSelectedPlan(planName)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedPlan === planName 
                          ? "bg-white/10 border-brand-500 ring-1 ring-brand-500" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-semibold ${selectedPlan === planName ? "text-brand-400" : "text-foreground"}`}>
                            {planName}
                          </span>
                          {selectedPlan === planName && <CheckCircle2 className="w-5 h-5 text-foreground" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={submitting}
                      className="w-full rounded-2xl bg-brand-500 hover:bg-brand-400
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-foreground font-medium py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <><Loader size="sm" /> Finalizing...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Complete Setup</>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Progress Indicators */}
          <div className="flex justify-center gap-2 mt-8 absolute bottom-0 left-0 right-0">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? "w-8 bg-brand-500" : "w-4 bg-slate-800"}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? "w-8 bg-brand-500" : "w-4 bg-slate-800"}`} />
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? "w-8 bg-brand-500" : "w-4 bg-slate-800"}`} />
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL (Image) ── */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <Image
          src="/login-cover.jpg"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-slate-950/40" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 to-transparent" />
      </div>
    </div>
  );
}
