"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { searchPosClientsAction, savePosClientAction, findPosClientByPhoneAction, PosClient } from "@/app/(dashboard)/pos/actions/clients";

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomerName: string;
  currentCustomerPhone?: string;
  onSelectCustomer: (customer: { name: string; phone?: string; id?: string }) => void;
  overlayMode?: "fixed" | "section";
}

export function CustomerSelectModal({
  isOpen,
  onClose,
  currentCustomerName,
  currentCustomerPhone = "",
  onSelectCustomer,
  overlayMode = "section",
}: CustomerSelectModalProps) {
  const [name, setName] = useState(currentCustomerName === "Walk-in Customer" ? "" : currentCustomerName);
  const [phone, setPhone] = useState(currentCustomerPhone || "");
  const [searchResults, setSearchResults] = useState<PosClient[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneStatusMsg, setPhoneStatusMsg] = useState<{ text: string; type: "info" | "success" | "warning" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentCustomerName === "Walk-in Customer" ? "" : currentCustomerName);
      setPhone(currentCustomerPhone || "");
      setErrorMsg(null);
      setPhoneStatusMsg(null);
      setSearchResults([]);
      // 1st focus to phone number field as requested
      setTimeout(() => {
        phoneInputRef.current?.focus();
        phoneInputRef.current?.select();
      }, 60);
    }
  }, [isOpen, currentCustomerName, currentCustomerPhone]);

  // Live search when typing name or phone
  const handleQueryChange = (val: string, field: 'name' | 'phone') => {
    if (field === 'phone') {
      setPhone(val);
      setPhoneStatusMsg(null);
    } else {
      setName(val);
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const query = val.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await searchPosClientsAction(query);
        if (res.success) {
          setSearchResults(res.clients);
        }
      } catch (err) {
        console.error("search error:", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 200);
  };

  // Lookup phone on Enter or blur: if exists retrieve name & start checkout; if not focus name field
  const handlePhoneLookupAndProceed = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      // No phone provided, advance focus to name field
      nameInputRef.current?.focus();
      return;
    }

    setIsCheckingPhone(true);
    setPhoneStatusMsg(null);
    setErrorMsg(null);

    try {
      const res = await findPosClientByPhoneAction(cleanPhone);
      if (res.success && res.client) {
        // Customer exists! Retrieve name and start checkout immediately
        setName(res.client.name);
        setPhoneStatusMsg({ text: `Existing client: ${res.client.name}`, type: "success" });
        onSelectCustomer({
          name: res.client.name,
          phone: res.client.phone || cleanPhone,
          id: res.client.id,
        });
        onClose();
      } else {
        // Number does not exist -> Put focus to name field
        setPhoneStatusMsg({ text: "New customer number. Enter name below.", type: "info" });
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 50);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to search phone number.");
      nameInputRef.current?.focus();
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePhoneLookupAndProceed();
    }
  };

  const handlePickClient = (client: PosClient) => {
    setName(client.name);
    setPhone(client.phone || "");
    setSearchResults([]);
    onSelectCustomer({
      name: client.name,
      phone: client.phone || undefined,
      id: client.id,
    });
    onClose();
  };

  const handleConfirmCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName && !cleanPhone) {
      handleWalkIn();
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await savePosClientAction({
        name: cleanName || `Customer ${cleanPhone}`,
        phone: cleanPhone || undefined,
      });

      if (res.success && res.client) {
        onSelectCustomer({
          name: res.client.name,
          phone: res.client.phone || undefined,
          id: res.client.id,
        });
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to save client.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleWalkIn = () => {
    onSelectCustomer({
      name: "Walk-in Customer",
      phone: undefined,
      id: "walk-in",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        overlayMode === "section"
          ? "absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          : "fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      }
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative max-h-[92%] my-auto ring-1 ring-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div>
            <h3 className="text-base font-bold text-foreground">Customer / Client Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleConfirmCustomer} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. Phone / Mobile Number (First Focus) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Phone / Mobile Number
              </label>
              {phoneStatusMsg && (
                <span className={`text-[11px] font-semibold ${phoneStatusMsg.type === 'success' ? 'text-emerald-500' : 'text-brand-500'}`}>
                  {phoneStatusMsg.text}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                ref={phoneInputRef}
                type="tel"
                value={phone}
                onChange={(e) => handleQueryChange(e.target.value, 'phone')}
                onKeyDown={handlePhoneKeyDown}
                className="w-full px-4 pr-10 py-3 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:border-brand-500 transition-colors"
              />
              {isCheckingPhone && (
                <Loader2 className="absolute right-3.5 w-4 h-4 text-brand-500 animate-spin" />
              )}
            </div>
          </div>

          {/* 2. Customer Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Customer Full Name
            </label>
            <div className="relative flex items-center">
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => handleQueryChange(e.target.value, 'name')}
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          {/* Real-time Match Suggestions */}
          {searchResults.length > 0 && (
            <div className="border border-border/80 bg-black/5 dark:bg-white/5 rounded-2xl p-2.5 max-h-40 overflow-y-auto space-y-1">
              <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                <span>Existing Client Records Found</span>
              </div>
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handlePickClient(c)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-brand-500/10 hover:text-brand-500 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div>
                    <span className="font-bold text-foreground group-hover:text-brand-500">{c.name}</span>
                    {c.company && <span className="text-[11px] text-gray-400 ml-1.5">({c.company})</span>}
                  </div>
                  {c.phone && <span className="text-[11px] text-gray-400">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleWalkIn}
              className="py-3 px-4 border border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Walk-in Customer</span>
              <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-brand-950 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{saving ? "Saving to Clients..." : "Start Sale with Customer"}</span>
              <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
