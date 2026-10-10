"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Building2, 
  Check, 
  ChevronDown, 
  Plus, 
  Crown, 
  ShieldCheck, 
  UserCheck, 
  Eye, 
  Loader2, 
  Settings, 
  MailCheck, 
  X, 
  AlertCircle,
  Briefcase
} from "lucide-react";
import TenantLogo from "@/components/TenantLogo";
import { 
  getUserBusinesses, 
  switchActiveTenant, 
  respondToTeamInvitation, 
  createOwnedBusinessProfile 
} from "@/app/(dashboard)/user/actions/tenants";

interface TenantInfoProps {
  name?: string | null;
  logo_url?: string | null;
  userRole?: string | null;
  plan?: string | null;
}

interface UserBusiness {
  id: number;
  name: string;
  logo_url?: string | null;
  plan: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
}

interface PendingInvite {
  id: number;
  tenantId: number;
  tenantName: string;
  logoUrl?: string | null;
  role: string;
  createdAt: string | null;
}

export default function BusinessSwitcher({ tenantInfo }: { tenantInfo: TenantInfoProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [businesses, setBusinesses] = useState<UserBusiness[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [hasOwnedBusiness, setHasOwnedBusiness] = useState<boolean>(true);
  
  // Actions loading states
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<{ id: number; action: "accept" | "decline" } | null>(null);
  
  // Create profile modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizCurrency, setNewBizCurrency] = useState("LKR");
  const [createLoading, setCreateLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generalMessage, setGeneralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch businesses & pending invites
  const loadBusinesses = async () => {
    try {
      setLoadingData(true);
      const res = await getUserBusinesses();
      setBusinesses(res.businesses);
      setPendingInvites(res.pendingInvites);
      setHasOwnedBusiness(res.hasOwnedBusiness);
    } catch (err) {
      console.error("Error loading businesses:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  // Refresh data whenever dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadBusinesses();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateModal(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setShowCreateModal(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSwitchTenant = async (targetId: number) => {
    if (switchingId || respondingId || createLoading) return;
    setSwitchingId(targetId);
    setGeneralMessage(null);
    try {
      const res = await switchActiveTenant(targetId);
      if (res.success) {
        window.location.reload();
      } else {
        setGeneralMessage({ type: "error", text: res.error || "Failed to switch workspace" });
        setSwitchingId(null);
      }
    } catch (err: any) {
      setGeneralMessage({ type: "error", text: err?.message || "Failed to switch workspace" });
      setSwitchingId(null);
    }
  };

  const handleRespondInvite = async (invitationId: number, action: "accept" | "decline") => {
    if (respondingId || switchingId || createLoading) return;
    setRespondingId({ id: invitationId, action });
    setGeneralMessage(null);
    try {
      const res = await respondToTeamInvitation(invitationId, action);
      if (res.success) {
        if (action === "accept") {
          window.location.reload();
        } else {
          setPendingInvites((prev) => prev.filter((i) => i.id !== invitationId));
          setGeneralMessage({ type: "success", text: "Invitation declined successfully" });
          setRespondingId(null);
        }
      } else {
        setGeneralMessage({ type: "error", text: res.error || "Failed to respond to invitation" });
        setRespondingId(null);
      }
    } catch (err: any) {
      setGeneralMessage({ type: "error", text: err?.message || "Failed to respond to invitation" });
      setRespondingId(null);
    }
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) {
      setFormError("Business name is required");
      return;
    }
    setFormError(null);
    setCreateLoading(true);
    try {
      const res = await createOwnedBusinessProfile(newBizName, newBizCurrency);
      if (res.success) {
        window.location.reload();
      } else {
        setFormError(res.error || "Failed to create business profile");
        setCreateLoading(false);
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to create business profile");
      setCreateLoading(false);
    }
  };

  // Plan ring styling
  const plan = (tenantInfo.plan || "").toLowerCase();
  const isProPlus = plan.includes("plus");
  const isPro = !isProPlus && plan.includes("pro");

  let containerClass = "rounded-full flex-shrink-0 transition-transform group-hover:scale-105";
  if (isProPlus) {
    containerClass += " ring-2 ring-offset-2 ring-offset-background ring-brand-500 shadow-[0_0_15px_rgba(159,232,112,0.4)]";
  } else if (isPro) {
    containerClass += " ring-2 ring-offset-2 ring-offset-background ring-brand-500";
  }

  const roleText = tenantInfo.userRole
    ? tenantInfo.userRole.charAt(0).toUpperCase() + tenantInfo.userRole.slice(1).toLowerCase()
    : "Member";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setShowCreateModal(false);
          setGeneralMessage(null);
        }}
        className="flex items-center gap-3 pl-4 ml-2 border-l border-border hover:opacity-90 transition-all text-left group focus:outline-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col items-end hidden sm:flex">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground tracking-tight group-hover:text-brand-500 transition-colors max-w-[150px] truncate">
              {tenantInfo.name || "My Business"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180 text-brand-500" : ""
              }`}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              You're {roleText}
            </span>
            {pendingInvites.length > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-black animate-pulse">
                {pendingInvites.length} invite{pendingInvites.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Avatar with optional pending badge */}
        <div className="relative">
          <div className={containerClass}>
            <TenantLogo
              logoUrl={tenantInfo.logo_url}
              name={tenantInfo.name}
              size={36}
              className="w-9 h-9 rounded-full object-cover"
            />
          </div>
          {pendingInvites.length > 0 && (
            <span className="sm:hidden absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-background animate-pulse" />
          )}
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 rounded-2xl bg-card border border-border/80 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-border/60 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </span>
            </div>
            <Link
              href="/user/settings/business"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-0.5 px-2 rounded-lg hover:bg-muted"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>

          {/* General Message Alert */}
          {generalMessage && (
            <div
              className={`p-3 text-xs flex items-center gap-2 border-b ${
                generalMessage.type === "success"
                  ? "bg-brand-500/10 text-brand-500 border-brand-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{generalMessage.text}</span>
              <button
                type="button"
                onClick={() => setGeneralMessage(null)}
                className="hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending Invitations Section */}
          {pendingInvites.length > 0 && (
            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <MailCheck className="w-4 h-4" />
                  <span>Pending Invitations ({pendingInvites.length})</span>
                </div>
              </div>
              <div className="space-y-2">
                {pendingInvites.map((invite) => {
                  const isThisResponding = respondingId?.id === invite.id;
                  return (
                    <div
                      key={invite.id}
                      className="p-2.5 rounded-xl bg-background/80 border border-amber-500/20 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TenantLogo
                            logoUrl={invite.logoUrl}
                            name={invite.tenantName}
                            size={28}
                            className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                            fallbackClassName="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {invite.tenantName}
                            </p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              Role: <span className="font-medium text-foreground">{invite.role}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <button
                          type="button"
                          disabled={Boolean(respondingId || switchingId)}
                          onClick={() => handleRespondInvite(invite.id, "accept")}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-brand-950 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isThisResponding && respondingId?.action === "accept" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(respondingId || switchingId)}
                          onClick={() => handleRespondInvite(invite.id, "decline")}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border border-border/60 transition-colors disabled:opacity-50"
                        >
                          {isThisResponding && respondingId?.action === "decline" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business Profiles List */}
          <div className="p-2 max-h-72 overflow-y-auto space-y-1">
            {loadingData && businesses.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                <span className="text-xs">Loading businesses...</span>
              </div>
            ) : businesses.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No businesses found.
              </div>
            ) : (
              businesses.map((biz) => {
                const isCurrent = biz.isActive;
                const isSwitching = switchingId === biz.id;

                return (
                  <button
                    key={biz.id}
                    type="button"
                    disabled={isCurrent || Boolean(switchingId)}
                    onClick={() => handleSwitchTenant(biz.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 group/item ${
                      isCurrent
                        ? "bg-brand-500/10 border border-brand-500/30 text-foreground cursor-default"
                        : "hover:bg-muted/70 text-foreground/80 hover:text-foreground cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TenantLogo
                        logoUrl={biz.logo_url}
                        name={biz.name}
                        size={32}
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                        fallbackClassName="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs text-muted-foreground"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                            {biz.name}
                          </span>
                          {biz.isOwner ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Crown className="w-2.5 h-2.5" />
                              Owner
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/40 capitalize">
                              {biz.role}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {biz.plan} Plan
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {isSwitching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                      ) : isCurrent ? (
                        <div className="flex items-center gap-1 text-brand-500">
                          <span className="text-[11px] font-semibold hidden sm:inline">Active</span>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity font-medium">
                          Switch
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Create Business Profile Section */}
          <div className="p-3 border-t border-border/60 bg-muted/20">
            {!hasOwnedBusiness ? (
              <div>
                {!showCreateModal ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-brand-500/40 hover:border-brand-500 hover:bg-brand-500/10 text-brand-500 text-xs font-semibold transition-all group/btn"
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                    <span>Create Your Business Profile</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateBusiness} className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Create Owned Business
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          setFormError(null);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {formError && (
                      <p className="text-[11px] text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        {formError}
                      </p>
                    )}

                    <div>
                      <input
                        type="text"
                        placeholder="Business Name (e.g. Acme Corp)"
                        value={newBizName}
                        onChange={(e) => setNewBizName(e.target.value)}
                        required
                        disabled={createLoading}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border focus:border-brand-500 focus:outline-none text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={newBizCurrency}
                        onChange={(e) => setNewBizCurrency(e.target.value)}
                        disabled={createLoading}
                        className="px-2 py-1.5 text-xs rounded-xl bg-background border border-border focus:border-brand-500 focus:outline-none text-foreground"
                      >
                        <option value="LKR">LKR (Rs)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="AUD">AUD ($)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="AED">AED</option>
                      </select>

                      <button
                        type="submit"
                        disabled={createLoading || !newBizName.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-brand-950 transition-colors disabled:opacity-50"
                      >
                        {createLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <span>Create Profile</span>
                        )}
                      </button>
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      * Each personal account can create 1 owned business profile.
                    </p>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground py-1 px-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                  <span>1 of 1 owned profiles created</span>
                </span>
                <span className="text-[10px] text-muted-foreground/80">Account limit reached</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
