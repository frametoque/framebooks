"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Check,
  Loader2,
  MailCheck,
  X,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TenantLogo from "@/components/TenantLogo";
import {
  switchActiveTenant,
  respondToTeamInvitation,
  UserBusinessItem,
  PendingInviteItem,
} from "@/app/(dashboard)/user/actions/tenants";
import { invalidateClientTenantInfo } from "@/lib/tenant/clientTenantInfo";
import { resolvePaletteId, DEFAULT_ACCENT_HEX } from "@/lib/theme/accent";

interface PosBusinessSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: UserBusinessItem[];
  pendingInvites: PendingInviteItem[];
  onRefresh?: () => Promise<void> | void;
  isModal?: boolean;
}

export function PosBusinessSwitcher({
  isOpen,
  onClose,
  businesses,
  pendingInvites,
  onRefresh,
  isModal = false,
}: PosBusinessSwitcherProps) {
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<{ id: number; action: "accept" | "decline" } | null>(null);
  const [generalMessage, setGeneralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside (for popover mode)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (isModal) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, isModal]);

  const handleSwitchTenant = async (targetId: number) => {
    if (switchingId || respondingId) return;
    setSwitchingId(targetId);
    setGeneralMessage(null);

    try {
      const targetBiz = businesses.find((b) => b.id === targetId);
      const clean = resolvePaletteId(targetBiz?.accent_color) || DEFAULT_ACCENT_HEX;

      document.cookie = `fb_accent_color=${encodeURIComponent(clean)}; path=/; max-age=31536000; SameSite=Lax`;
      try {
        localStorage.setItem("framebooks_accent_color", clean);
        if (targetBiz?.name) {
          localStorage.setItem("framebooks_business_name", targetBiz.name.trim());
        }
      } catch {}

      const res = await switchActiveTenant(targetId);
      if (res.success) {
        invalidateClientTenantInfo();
        const finalColor = (res as any).accentColor || clean;
        document.cookie = `fb_accent_color=${encodeURIComponent(finalColor)}; path=/; max-age=31536000; SameSite=Lax`;
        try {
          localStorage.setItem("framebooks_accent_color", finalColor);
        } catch {}

        const redirectTarget = (res as any).redirectTo || ((res as any).isCashierOnly ? "/pos" : "/dashboard");
        window.location.href = redirectTarget;
      } else {
        setGeneralMessage({ type: "error", text: res.error || "Failed to switch business profile" });
        setSwitchingId(null);
      }
    } catch (err: any) {
      setGeneralMessage({ type: "error", text: err?.message || "Failed to switch business profile" });
      setSwitchingId(null);
    }
  };

  const handleRespondInvite = async (invitationId: number, action: "accept" | "decline") => {
    if (respondingId || switchingId) return;
    setRespondingId({ id: invitationId, action });
    setGeneralMessage(null);

    try {
      const res = await respondToTeamInvitation(invitationId, action);
      if (res.success) {
        if (action === "accept") {
          window.location.reload();
        } else {
          setGeneralMessage({ type: "success", text: "Invitation declined successfully" });
          setRespondingId(null);
          if (onRefresh) {
            await onRefresh();
          }
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

  const content = (
    <div
      ref={containerRef}
      className={`bg-[#0E131F] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col ${
        isModal
          ? "w-full max-w-md max-h-[85vh] relative z-50 animate-in fade-in zoom-in-95 duration-200"
          : "w-[calc(100vw-2rem)] max-w-sm sm:w-84 max-h-[80vh]"
      }`}
    >
      {/* Alert Banner */}
      {generalMessage && (
        <div
          className={`px-3.5 py-2.5 text-xs flex items-center gap-2 border-b shrink-0 ${
            generalMessage.type === "success"
              ? "bg-brand-500/10 text-brand-500 border-brand-500/20"
              : "bg-red-500/10 text-red-500 border-red-500/20"
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 font-medium">{generalMessage.text}</span>
          <button
            type="button"
            onClick={() => setGeneralMessage(null)}
            className="hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable Body */}
      <div className="overflow-y-auto divide-y divide-white/5">
        {/* Pending Invitations Section */}
        {pendingInvites.length > 0 && (
          <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
              <MailCheck className="w-4 h-4" />
              <span>Pending Invitations ({pendingInvites.length})</span>
            </div>
            <div className="space-y-2">
              {pendingInvites.map((invite) => {
                const isThisResponding = respondingId?.id === invite.id;
                return (
                  <div
                    key={invite.id}
                    className="p-2.5 rounded-xl bg-background border border-amber-500/20 flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TenantLogo
                        logoUrl={invite.logoUrl}
                        name={invite.tenantName}
                        size={32}
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                        fallbackClassName="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {invite.tenantName}
                        </p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          Invited Role: <span className="font-semibold text-foreground">{invite.role}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <button
                        type="button"
                        disabled={Boolean(respondingId || switchingId)}
                        onClick={() => handleRespondInvite(invite.id, "accept")}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-brand-950 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isThisResponding && respondingId?.action === "accept" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(respondingId || switchingId)}
                        onClick={() => handleRespondInvite(invite.id, "decline")}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border border-border/60 transition-colors disabled:opacity-50 cursor-pointer"
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
        <div className="p-2 space-y-1">
          {businesses.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
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
                      : "hover:bg-black/5 dark:hover:bg-white/5 border border-transparent text-foreground/85 hover:text-foreground cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TenantLogo
                      logoUrl={biz.logo_url}
                      name={biz.name}
                      size={34}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                      fallbackClassName="w-8 h-8 rounded-lg bg-black/10 dark:bg-white/10 border border-border flex items-center justify-center font-bold text-xs text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                          {biz.name}
                        </span>
                        {biz.isOwner ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Owner
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-black/10 dark:bg-white/10 text-muted-foreground border border-border/40 capitalize">
                            {biz.role}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {biz.plan} Plan
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    {isSwitching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    ) : isCurrent ? (
                      <div className="flex items-center gap-1 text-brand-500">
                        <span className="text-[11px] font-bold">Active</span>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground group-hover/item:text-brand-500 transition-colors">
                        <span className="text-[11px] font-medium hidden sm:inline">Switch</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -6 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute right-0 top-full mt-2 z-[9990]"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
