import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Check,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  Lock
} from "lucide-react";
import {
  DEFAULT_ACCENT_HEX,
  ACCENT_PRESETS,
  generateAccentPalette,
  generateTenantThemeCss
} from "@/lib/theme/accent";
import { updateTenantAccent } from "../actions/tenants";

interface AppearanceTabProps {
  initialAccent?: string | null;
  canManage?: boolean;
  isProPlus?: boolean;
  onAccentSaved?: (newHex: string | null) => void;
}

export default function AppearanceTab({ initialAccent, canManage = true, isProPlus = false, onAccentSaved }: AppearanceTabProps) {
  const router = useRouter();
  const savedHexRef = useRef<string>(initialAccent || DEFAULT_ACCENT_HEX);

  const [selectedHex, setSelectedHex] = useState<string>(initialAccent || DEFAULT_ACCENT_HEX);
  const [customInput, setCustomInput] = useState<string>(initialAccent || DEFAULT_ACCENT_HEX);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state if initialAccent changes
  useEffect(() => {
    const val = initialAccent || DEFAULT_ACCENT_HEX;
    savedHexRef.current = val;
    setSelectedHex(val);
    setCustomInput(val);
  }, [initialAccent]);

  // Compute live palette
  const palette = useMemo(() => {
    return generateAccentPalette(selectedHex);
  }, [selectedHex]);

  // Apply live style tag preview at the bottom of body so user sees instant changes as they pick colours
  useEffect(() => {
    // Disable any static layout style tags so the live preview has 100% control
    const clientTag = document.getElementById("tenant-accent-theme-client") as HTMLStyleElement | null;
    const ssrTag = document.getElementById("tenant-accent-theme-ssr") as HTMLStyleElement | null;
    if (clientTag) clientTag.disabled = true;
    if (ssrTag) ssrTag.disabled = true;

    let previewTag = document.getElementById("tenant-accent-theme-live-preview") as HTMLStyleElement | null;
    if (!previewTag) {
      previewTag = document.createElement("style");
      previewTag.id = "tenant-accent-theme-live-preview";
      document.body.appendChild(previewTag);
    } else {
      document.body.appendChild(previewTag);
    }
    previewTag.innerHTML = generateTenantThemeCss(selectedHex);
    window.dispatchEvent(new CustomEvent("accent:change", { detail: selectedHex }));
  }, [selectedHex]);

  // Clean up on component unmount only: restore to the saved color (never null or stale)
  useEffect(() => {
    return () => {
      const tag = document.getElementById("tenant-accent-theme-live-preview");
      if (tag) tag.remove();

      const finalSavedColor = savedHexRef.current || DEFAULT_ACCENT_HEX;
      const savedCss = generateTenantThemeCss(finalSavedColor);

      const clientTag = document.getElementById("tenant-accent-theme-client") as HTMLStyleElement | null;
      const ssrTag = document.getElementById("tenant-accent-theme-ssr") as HTMLStyleElement | null;
      if (clientTag) {
        clientTag.innerHTML = savedCss;
        clientTag.disabled = false;
      }
      if (ssrTag) {
        ssrTag.innerHTML = savedCss;
        ssrTag.disabled = false;
      }

      window.dispatchEvent(new CustomEvent("accent:change", { detail: finalSavedColor }));
    };
  }, []);

  const handleSelectPreset = (hex: string) => {
    if (!canManage) return;
    setSelectedHex(hex);
    setCustomInput(hex);
    setToastMsg(null);
  };

  const handleCustomInputChange = (val: string) => {
    if (!canManage) return;
    setCustomInput(val);
    let clean = val.trim();
    if (!clean.startsWith("#")) clean = `#${clean}`;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      setSelectedHex(clean.toUpperCase());
    }
  };

  const handleResetDefault = () => {
    if (!canManage) return;
    if (!isProPlus) {
      window.dispatchEvent(
        new CustomEvent("upgrade-modal:open", {
          detail: "Custom workspace accent colors are available on Pro and Pro Plus plans. Upgrade to Pro to save and apply custom branding.",
        })
      );
      return;
    }
    setSelectedHex(DEFAULT_ACCENT_HEX);
    setCustomInput(DEFAULT_ACCENT_HEX);
    setToastMsg(null);
  };

  const handleSave = async () => {
    if (!canManage) return;
    if (!isProPlus) {
      window.dispatchEvent(
        new CustomEvent("upgrade-modal:open", {
          detail: "Custom workspace accent colors are available on Pro and Pro Plus plans. Upgrade to Pro to save and apply custom branding across your workspace.",
        })
      );
      return;
    }
    setSaving(true);
    setToastMsg(null);
    try {
      const isDefault = selectedHex.toUpperCase() === DEFAULT_ACCENT_HEX.toUpperCase();
      const payload = isDefault ? null : selectedHex.toUpperCase();
      const res = await updateTenantAccent(payload);
      if (res.success) {
        const finalColor = payload || DEFAULT_ACCENT_HEX;
        savedHexRef.current = finalColor;
        onAccentSaved?.(payload);

        // Update persistent layout theme style tags immediately
        const newCss = generateTenantThemeCss(finalColor);
        const clientTag = document.getElementById("tenant-accent-theme-client") as HTMLStyleElement | null;
        const ssrTag = document.getElementById("tenant-accent-theme-ssr") as HTMLStyleElement | null;
        if (clientTag) {
          clientTag.innerHTML = newCss;
          clientTag.disabled = false;
        }
        if (ssrTag) {
          ssrTag.innerHTML = newCss;
          ssrTag.disabled = false;
        }

        // Keep preview tag in sync
        const previewTag = document.getElementById("tenant-accent-theme-live-preview") as HTMLStyleElement | null;
        if (previewTag) {
          previewTag.innerHTML = newCss;
        }

        // Cache in localStorage & cookie
        try {
          localStorage.setItem("framebooks_accent_color", finalColor);
          document.cookie = `fb_accent_color=${encodeURIComponent(finalColor)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}

        // Broadcast to all active components in the app
        window.dispatchEvent(new CustomEvent("accent:change", { detail: finalColor }));
        
        router.refresh();
        setToastMsg({ type: "success", text: "Workspace appearance saved successfully." });
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        setToastMsg({ type: "error", text: res.error || "Failed to save appearance setting." });
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: err?.message || "Failed to save appearance setting." });
    } finally {
      setSaving(false);
    }
  };

  const isDefault = selectedHex.toUpperCase() === DEFAULT_ACCENT_HEX.toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2.5 text-sm font-semibold border ${toastMsg.type === "success"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Action Header */}
      {canManage && (
        <div className="flex items-center justify-between gap-2.5 border-b border-border pb-4">
          <div>
            {!isProPlus && (
              <span className="text-xs text-amber-500 flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>Preview Mode — Upgrade to Pro to save</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isDefault || saving}
              onClick={handleResetDefault}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-40"
              title="Reset to Framebooks Default Green"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>

            {!isProPlus ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("upgrade-modal:open", {
                      detail: "Custom workspace accent colors are available on Pro and Pro Plus plans. Upgrade to Pro to save and apply custom branding across your workspace.",
                    })
                  );
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Lock className="w-4 h-4 stroke-[2.5]" />
                <span>Upgrade to Pro to Save</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-brand-950 font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Appearance</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Read-Only Notice if user lacks permission */}
      {!canManage && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm flex items-center gap-2.5">
          <Info className="w-5 h-5 shrink-0 text-amber-500" />
          <span>
            You are viewing this setting in read-only mode. Only the workspace owner or administrators with appearance permissions can save custom branding changes.
          </span>
        </div>
      )}

      {/* Curated Presets & Custom Grid */}
      <div className="space-y-4">


        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ACCENT_PRESETS.map((p) => {
            const isSelected = selectedHex.toUpperCase() === p.hex.toUpperCase();
            return (
              <button
                key={p.id}
                type="button"
                disabled={!canManage}
                onClick={() => handleSelectPreset(p.hex)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${isSelected
                  ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                  : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
                  } ${!canManage ? "cursor-default" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: p.hex }}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    {p.hex}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-xs text-foreground truncate">
                    {p.name}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Custom Colour Grid Item */}
          {(() => {
            const isPreset = ACCENT_PRESETS.some(
              (p) => p.hex.toUpperCase() === selectedHex.toUpperCase()
            );
            const isCustom = !isPreset;
            return (
              <div
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative ${isCustom
                    ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                    : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
                  } ${!canManage ? "cursor-default" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    className="relative cursor-pointer shrink-0"
                    title="Open colour picker"
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20"
                      style={{ backgroundColor: isCustom ? selectedHex : "#8B5CF6" }}
                    >
                      {isCustom ? (
                        <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                      ) : (
                        <Palette className="w-3.5 h-3.5 text-white/90" />
                      )}
                    </div>
                    <input
                      type="color"
                      value={selectedHex.startsWith("#") && selectedHex.length === 7 ? selectedHex : "#00E35B"}
                      disabled={!canManage}
                      onInput={(e) => handleSelectPreset((e.target as HTMLInputElement).value)}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                      className="sr-only"
                    />
                  </label>

                  <input
                    type="text"
                    value={customInput}
                    disabled={!canManage}
                    onChange={(e) => handleCustomInputChange(e.target.value)}
                    placeholder="#HEX"
                    maxLength={7}
                    className="w-20 px-2 py-1 text-[11px] font-mono font-bold rounded-lg bg-background border border-border focus:border-brand-500 focus:outline-none uppercase text-foreground text-center"
                    title="Enter custom hex code"
                  />
                </div>

                <div>
                  <div className="font-bold text-xs text-foreground truncate flex items-center justify-between">
                    <span>Custom</span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">
                      {isCustom ? selectedHex : "Hex Code"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Financial Semantic Warning if color resembles red or amber */}
        {palette.warningNotice && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3 mt-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Semantic Separation Notice</div>
              <p className="leading-relaxed text-[11px]">
                {palette.warningNotice} Financial metrics (incomes in green, expenses in red, and unpaid warning badges) always remain strictly fixed so financial meaning is never confused.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
