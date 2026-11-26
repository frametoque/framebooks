import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Palette,
  Check,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  Lock,
  Sun,
  Moon
} from "lucide-react";
import {
  DEFAULT_ACCENT_HEX,
  ACCENT_PRESETS,
  COLOR_PALETTE_GROUPS,
  GTA6_PALETTE_GROUP,
  F1_PALETTE_GROUP,
  SL_CRICKET_PALETTE_GROUP,
  SL_FLAG_PALETTE_GROUP,
  CHRISTMAS_PALETTE_GROUP,
  CORE_PALETTE_GROUP,
  isGta6Color,
  isGta6Palette,
  isF1Color,
  isF1Palette,
  isSlCricketColor,
  isSlCricketPalette,
  isSlFlagColor,
  isSlFlagPalette,
  isChristmasColor,
  isChristmasPalette,
  GTA6_PALETTE_ID,
  F1_PALETTE_ID,
  SL_CRICKET_PALETTE_ID,
  SL_FLAG_PALETTE_ID,
  CHRISTMAS_PALETTE_ID,
  generateAccentPalette,
  generateTenantThemeCss,
  AccentPreset,
  resolveHeroAccentHex,
  resolvePaletteId
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
  const [customInput, setCustomInput] = useState<string>(() => {
    const val = initialAccent || DEFAULT_ACCENT_HEX;
    if (
      isGta6Palette(val) ||
      isF1Palette(val) ||
      isSlCricketPalette(val) ||
      isSlFlagPalette(val) ||
      isChristmasPalette(val) ||
      val.startsWith("palette:")
    ) {
      return "#8B5CF6";
    }
    return val;
  });
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isGtaActive = isGta6Palette(selectedHex);
  const isF1Active = isF1Palette(selectedHex);
  const isSlCricketActive = isSlCricketPalette(selectedHex);
  const isSlFlagActive = isSlFlagPalette(selectedHex);
  const isChristmasActive = isChristmasPalette(selectedHex);

  const [seasonalEffects, setSeasonalEffects] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const val = localStorage.getItem("framebooks_seasonal_effects");
      return val !== "false";
    } catch {
      return true;
    }
  });

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const handleSetTheme = (newTheme: "light" | "dark") => {
    if (resolvedTheme === newTheme) return;

    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      document.startViewTransition(() => {
        setTheme(newTheme);
      });
      return;
    }

    if (typeof document !== "undefined") {
      document.documentElement.classList.add("theme-transitioning");
      setTheme(newTheme);
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 250);
    } else {
      setTheme(newTheme);
    }
  };

  const handleToggleSeasonalEffects = () => {
    const next = !seasonalEffects;
    setSeasonalEffects(next);
    try {
      localStorage.setItem("framebooks_seasonal_effects", String(next));
      document.cookie = `fb_seasonal_effects=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    window.dispatchEvent(
      new CustomEvent("seasonal-effects:change", { detail: next })
    );
  };

  // Sync state if initialAccent changes
  useEffect(() => {
    const val = initialAccent || DEFAULT_ACCENT_HEX;
    savedHexRef.current = val;
    setSelectedHex(val);
    if (
      !isGta6Palette(val) &&
      !isF1Palette(val) &&
      !isSlCricketPalette(val) &&
      !isSlFlagPalette(val) &&
      !isChristmasPalette(val) &&
      !val.startsWith("palette:")
    ) {
      setCustomInput(val);
    }
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
    if (
      !isGta6Palette(hex) &&
      !isF1Palette(hex) &&
      !isSlCricketPalette(hex) &&
      !isSlFlagPalette(hex) &&
      !isChristmasPalette(hex)
    ) {
      setCustomInput(hex);
    }
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
      const isGta = isGta6Palette(selectedHex);
      const isF1 = isF1Palette(selectedHex);
      const isSl = isSlCricketPalette(selectedHex);
      const isFlag = isSlFlagPalette(selectedHex);
      const isXmas = isChristmasPalette(selectedHex);
      const isDef =
        !isGta &&
        !isF1 &&
        !isSl &&
        !isFlag &&
        !isXmas &&
        selectedHex.toUpperCase() === DEFAULT_ACCENT_HEX.toUpperCase();
      const payload = isDef
        ? null
        : resolvePaletteId(selectedHex);
      const finalColor = payload || DEFAULT_ACCENT_HEX;

      // 1. Instantly update CSS variables, style tags, and storage so UI updates with zero delay
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

      const previewTag = document.getElementById("tenant-accent-theme-live-preview") as HTMLStyleElement | null;
      if (previewTag) {
        previewTag.innerHTML = newCss;
      }

      document.documentElement.style.setProperty(
        "--accent",
        resolveHeroAccentHex(finalColor)
      );

      try {
        localStorage.setItem("framebooks_accent_color", finalColor);
        document.cookie = `fb_accent_color=${encodeURIComponent(finalColor)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}

      window.dispatchEvent(new CustomEvent("accent:change", { detail: finalColor }));
      onAccentSaved?.(payload);

      // 2. Persist to server
      const res = await updateTenantAccent(payload);
      if (res.success) {
        savedHexRef.current = finalColor;
        router.refresh();
        setToastMsg({ type: "success", text: "Workspace appearance saved successfully." });
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        // Rollback on server error
        const prevSaved = savedHexRef.current || DEFAULT_ACCENT_HEX;
        const prevCss = generateTenantThemeCss(prevSaved);
        if (clientTag) clientTag.innerHTML = prevCss;
        if (ssrTag) ssrTag.innerHTML = prevCss;
        document.documentElement.style.setProperty("--accent", prevSaved);
        try {
          localStorage.setItem("framebooks_accent_color", prevSaved);
          document.cookie = `fb_accent_color=${encodeURIComponent(prevSaved)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}
        window.dispatchEvent(new CustomEvent("accent:change", { detail: prevSaved }));
        setToastMsg({ type: "error", text: res.error || "Failed to save appearance setting." });
      }
    } catch (err: any) {
      setToastMsg({ type: "error", text: err?.message || "Failed to save appearance setting." });
    } finally {
      setSaving(false);
    }
  };

  const isDefault =
    !isGtaActive &&
    !isF1Active &&
    !isSlCricketActive &&
    !isSlFlagActive &&
    !isChristmasActive &&
    selectedHex.toUpperCase() === DEFAULT_ACCENT_HEX.toUpperCase();

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
        <div className="flex items-center justify-between gap-2.5">
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

      {/* Presets & Palettes Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {CORE_PALETTE_GROUP.presets.map((p) => {
            const isSelected =
              !isGtaActive &&
              !isF1Active &&
              !isSlCricketActive &&
              !isSlFlagActive &&
              !isChristmasActive &&
              selectedHex.toUpperCase() === p.hex.toUpperCase();
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
                    <span className="text-[11px] font-medium text-muted-foreground uppercase">
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

            {/* Custom Colour Card */}
            {(() => {
              const isPalette =
                selectedHex.startsWith("palette:") ||
                isGta6Palette(selectedHex) ||
                isF1Palette(selectedHex) ||
                isSlCricketPalette(selectedHex) ||
                isSlFlagPalette(selectedHex) ||
                isChristmasPalette(selectedHex);
              const isPreset = ACCENT_PRESETS.some(
                (p) => p.hex.toUpperCase() === selectedHex.toUpperCase()
              );
              const isCustom = !isPreset && !isPalette && /^#[0-9A-Fa-f]{6}$/.test(selectedHex);
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
                      className="w-20 px-2 py-1 text-[11px] font-bold rounded-lg bg-background border border-border focus:border-brand-500 focus:outline-none uppercase text-foreground text-center"
                      title="Enter custom hex code"
                    />
                  </div>

                  <div>
                    <div className="font-bold text-xs text-foreground truncate flex items-center justify-between">
                      <span>Custom</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {isCustom ? selectedHex : "Hex Code"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Featured Palette: GTA VI */}
          <button
            type="button"
            disabled={!canManage}
            onClick={() => handleSelectPreset(GTA6_PALETTE_ID)}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${
              isGtaActive
                ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
            } ${!canManage ? "cursor-default" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20 shrink-0 overflow-hidden relative bg-[#2A0E4E]"
              >
                <Image
                  src="/images/gta6-logo.png"
                  alt="GTA VI"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain p-0.5"
                />
                {isGtaActive && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-foreground truncate">
                GTA VI
              </div>
            </div>
          </button>

          {/* Featured Palette: F1 */}
          <button
            type="button"
            disabled={!canManage}
            onClick={() => handleSelectPreset(F1_PALETTE_ID)}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${
              isF1Active
                ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
            } ${!canManage ? "cursor-default" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20 shrink-0 overflow-hidden relative bg-white"
              >
                <Image
                  src="/images/f1-movie-logo.png"
                  alt="F1: The Movie"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain p-0.5"
                />
                {isF1Active && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-foreground truncate">
                F1: The Movie
              </div>
            </div>
          </button>

          {/* Featured Palette: SL Cricket */}
          <button
            type="button"
            disabled={!canManage}
            onClick={() => handleSelectPreset(SL_CRICKET_PALETTE_ID)}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${
              isSlCricketActive
                ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
            } ${!canManage ? "cursor-default" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20 shrink-0 overflow-hidden relative bg-[#0A50A1]"
              >
                <Image
                  src="/images/sl-cricket-logo.png"
                  alt="SL Cricket"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain p-0.5"
                />
                {isSlCricketActive && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-foreground truncate">
                SL Cricket
              </div>
            </div>
          </button>

          {/* Featured Palette: Sri Lanka Flag */}
          <button
            type="button"
            disabled={!canManage}
            onClick={() => handleSelectPreset(SL_FLAG_PALETTE_ID)}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${
              isSlFlagActive
                ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
            } ${!canManage ? "cursor-default" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20 shrink-0 overflow-hidden relative bg-[#8D153A]"
              >
                <Image
                  src="/images/sl-flag-logo.png"
                  alt="Sri Lanka Flag"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
                {isSlFlagActive && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-foreground truncate">
                Sri Lanka Flag
              </div>
            </div>
          </button>

          {/* Featured Palette: Christmas */}
          <button
            type="button"
            disabled={!canManage}
            onClick={() => handleSelectPreset(CHRISTMAS_PALETTE_ID)}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative cursor-pointer ${
              isChristmasActive
                ? "bg-card border-brand-500 shadow-md ring-2 ring-brand-500/20"
                : "bg-card/70 border-border hover:border-brand-500/40 hover:bg-card"
            } ${!canManage ? "cursor-default" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 border border-white/20 shrink-0 overflow-hidden relative bg-[#FFFCF5]"
              >
                <Image
                  src="/images/christmas-logo.png"
                  alt="Christmas"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain p-0.5"
                />
                {isChristmasActive && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-foreground truncate">
                Christmas
              </div>
            </div>
          </button>
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

        {/* Interface Theme (Light / Dark) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border shadow-xs flex items-center justify-between gap-4 mt-6">
          <div className="min-w-0">
            <span className="font-bold text-xs sm:text-sm text-foreground">Theme Mode</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-muted/40 rounded-2xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => handleSetTheme("light")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                themeMounted && (resolvedTheme === "light" || theme === "light")
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme("dark")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                themeMounted && (resolvedTheme === "dark" || theme === "dark")
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* Seasonal Effects */}
        <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border shadow-xs flex items-center justify-between gap-4 mt-6">
          <span className="font-bold text-xs sm:text-sm text-foreground">Seasonal Effects</span>

          <button
            type="button"
            role="switch"
            aria-checked={seasonalEffects}
            onClick={handleToggleSeasonalEffects}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              seasonalEffects ? "bg-brand-500" : "bg-muted"
            }`}
            title={seasonalEffects ? "Turn off seasonal effects" : "Turn on seasonal effects"}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                seasonalEffects ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
