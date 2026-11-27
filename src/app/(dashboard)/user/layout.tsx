"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedClock } from "./components/AnimatedClock";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from 'next-auth/react';
import { leaveTeam } from "./actions/tenants";
import { getClientTenantInfo } from "@/lib/tenant/clientTenantInfo";
import { 
  generateTenantThemeCss, 
  DEFAULT_ACCENT_HEX, 
  isGta6Palette, 
  GTA6_PALETTE_ID, 
  isF1Palette, 
  F1_PALETTE_ID,
  isSlCricketPalette,
  SL_CRICKET_PALETTE_ID,
  isSlFlagPalette,
  SL_FLAG_PALETTE_ID,
  isChristmasPalette,
  CHRISTMAS_PALETTE_ID,
  resolvePaletteId,
  resolveHeroAccentHex
} from "@/lib/theme/accent";
import {
  motion,
  AnimatePresence,
  type Transition,
  type Variants,
} from "framer-motion";
import DateRangeSelector from "./components/DateRangeSelector";
import { AdminDateRangeProvider, useAdminDateRange } from "./context/AdminDateRangeContext";
import { TaxEstimatorProvider, useTaxEstimator } from "./context/TaxEstimatorContext";
import { RoleProvider } from "./context/RoleContext";
import { User as UserIcon, Building2, Receipt, Droplets, BarChart3, NotepadTextDashed, FolderOpenDot, Layers, FilePenLine, ChartLine, CalendarPlus, ExternalLink, Globe, RefreshCw, Server, Cloud, Megaphone, Store, Printer, Package, Plug } from "lucide-react";
import { MdCreditCard, MdNotifications, MdMenu, MdSearch, MdDashboard, MdAccountBalanceWallet, MdInsertDriveFile, MdGroup, MdInventory2, MdLogout, MdClose, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdWorkOutline, MdKeyboardDoubleArrowLeft, MdKeyboardDoubleArrowRight, MdCalendarToday, MdAdd, MdAccessTime, MdSettings, MdAttachMoney, MdDownload, MdMenuBook, MdAccountBalance, MdLockOutline, MdLock, MdWarning, MdCancel, MdPointOfSale } from "react-icons/md";
import { AppLockProvider, useAppLock, LockScreen } from "./components/AppLockProvider";
import { PrivacyBlurToggle } from "./components/PrivacyBlurToggle";
import { ChristmasSnowfall } from "./components/ChristmasSnowfall";
import { NotificationScheduler } from "./components/NotificationScheduler";
import { UpgradeModal } from "./components/UpgradeModal";
import ClientAvatar from "@/components/ClientAvatar";
import { TenantLogo } from "@/components/TenantLogo";
import BusinessSwitcher from "./components/BusinessSwitcher";
import { PlanLockProvider } from "./components/PlanLockProvider";
import { GracePeriodBanner } from "./components/GracePeriodBanner";
import { LimitBanner } from "./components/LimitBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { NotificationBell } from "@/components/NotificationBell";
import { getAllLimits } from "./actions/actions";


// Framer Motion spring config for sidebar width
const sidebarSpring = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.8,
} as const;

const sidebarTransition = {
  type: "tween",
  ease: [0.25, 1, 0.5, 1],
  duration: 0.28,
} as const;

// Fade + slide config for labels
const labelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -8,
    width: 0,
  },
  visible: {
    opacity: 1,
    x: 0,
    width: "auto",
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: -8,
    width: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

export default function DashboardLayout({ children }) {
  return (
    <AppLockProvider>
      <LayoutContent>{children}</LayoutContent>
      <UpgradeModal />
    </AppLockProvider>
  );
}

function LayoutContent({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [ignoreHover, setIgnoreHover] = useState(false);

  const { isLocked, hasAppLock } = useAppLock();

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )sidebar-collapsed=([^;]*)/);
    const saved = match ? match[1] === "true" : false;
    setCollapsed(saved);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      if (next) {
        setIgnoreHover(true);
      }
      return next;
    });
  };

  const pathname = usePathname();
  const desktopExpanded = !collapsed || (sidebarHovered && !ignoreHover);

  // Reset sidebar hover expansion whenever the route changes
  useEffect(() => {
    setSidebarHovered(false);
  }, [pathname]);

  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const router = useRouter();

  const [tenantInfo, setTenantInfo] = useState<{
    id?: number;
    tenantId?: number;
    plan: string;
    name: string;
    logo_url: string | null;
    industry: string | null;
    payment_status?: string | null;
    userRole?: string | null;
    teamMembersCount?: number;
    plan_expires_at?: string | null;
    is_grace_period?: boolean;
    is_read_only?: boolean;
    grace_days_remaining?: number | null;
    grace_end_date?: string | null;
    accent_color?: string | null;
    is_cashier_only?: boolean;
    has_pos_addon?: boolean;
    can_purchase_pos?: boolean;
    can_use_pos?: boolean;
    pos_addon_status?: string;
    has_active_shift?: boolean;
    active_shift?: { id: number; shift_number: number } | null;
  }>({
    plan: "Loading...",
    name: "My Business",
    logo_url: null,
    industry: null,
    accent_color: null,
    is_cashier_only: false,
    has_pos_addon: false,
    can_purchase_pos: false,
    can_use_pos: false,
    pos_addon_status: "none",
    has_active_shift: false,
    active_shift: null,
  });
  const [exceededLimits, setExceededLimits] = useState<string[]>([]);

  const applyClientAccent = useCallback((hex: string | null | undefined) => {
    const cleanHex = resolvePaletteId(hex) || DEFAULT_ACCENT_HEX;
    const newCss = generateTenantThemeCss(cleanHex);
    let tag = (document.getElementById("tenant-accent-theme-ssr") || document.getElementById("tenant-accent-theme-client")) as HTMLStyleElement | null;
    if (tag) {
      tag.innerHTML = newCss;
    } else {
      tag = document.createElement("style");
      tag.id = "tenant-accent-theme-client";
      document.head.appendChild(tag);
      tag.innerHTML = newCss;
    }
    document.documentElement.style.setProperty("--accent", resolveHeroAccentHex(cleanHex));
  }, []);

  useEffect(() => {
    getClientTenantInfo().then(info => {
      if (!info) return;
      const activeColor = resolvePaletteId(info.accent_color) || DEFAULT_ACCENT_HEX;
      setTenantInfo({
        ...info,
        accent_color: activeColor,
      });
      try {
        document.cookie = `fb_accent_color=${encodeURIComponent(activeColor)}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem("framebooks_accent_color", activeColor);
      } catch {}
      applyClientAccent(activeColor);
    });
    getAllLimits().then(limits => setExceededLimits(limits));
  }, [applyClientAccent]);

  // Synchronize workspace accent color dynamically across client navigations
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)fb_accent_color=([^;]+)/);
      const cookieVal = match ? decodeURIComponent(match[1]).trim() : null;
      const cached = cookieVal || localStorage.getItem("framebooks_accent_color");
      const resolved = resolvePaletteId(cached);
      if (resolved) {
        setTenantInfo((prev: any) => ({ ...prev, accent_color: resolved }));
        applyClientAccent(resolved);
      }
    } catch { }

    const handleAccentChange = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const newHex = custom.detail || DEFAULT_ACCENT_HEX;
      const resolved = resolvePaletteId(newHex) || DEFAULT_ACCENT_HEX;
      setTenantInfo((prev: any) => ({ ...prev, accent_color: resolved }));
      applyClientAccent(resolved);
    };

    window.addEventListener("accent:change", handleAccentChange);
    return () => window.removeEventListener("accent:change", handleAccentChange);
  }, [applyClientAccent]);

  useEffect(() => {
    if (isLoaded && user && !(user as any).tenantId) {
      router.push("/onboarding");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (tenantInfo.payment_status === 'pending_payment') {
      router.push("/onboarding");
    }
  }, [tenantInfo.payment_status, router]);

  useEffect(() => {
    if (tenantInfo.is_cashier_only) {
      router.replace("/pos");
    }
  }, [tenantInfo.is_cashier_only, router]);

  if (tenantInfo.is_cashier_only) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 select-none">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/15 text-brand-500 flex items-center justify-center animate-pulse mb-3">
          <MdPointOfSale className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Opening Point of Sale Terminal...</p>
      </div>
    );
  }

  const isTeamLocked = tenantInfo.plan !== 'Loading...' && tenantInfo.plan !== 'Pro Plus' && tenantInfo.userRole !== 'owner' && tenantInfo.userRole !== 'Super Admin' && tenantInfo.userRole !== null;
  const showOwnerWarning = tenantInfo.plan !== 'Loading...' && tenantInfo.plan !== 'Pro Plus' && (tenantInfo.userRole === 'owner' || tenantInfo.userRole === 'Super Admin') && (tenantInfo.teamMembersCount || 0) > 1;
  const isMainDashboard = pathname === "/user/dashboard" || pathname === "/user" || pathname === "/dashboard";

  // --- Maintenance mode (optimized: visibility-aware on tab switch, zero background timer) ---
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string; allowed: boolean } | null>(null);
  useEffect(() => {
    const check = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetch("/api/maintenance-status")
        .then((r) => r.json())
        .then(setMaintenance)
        .catch(() => {});
    };
    check();
    const handleVisibility = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const showMaintenanceScreen = maintenance?.active && !maintenance?.allowed;

  return (
    <AdminDateRangeProvider>
      <TaxEstimatorProvider>
      {/* Maintenance screen – full viewport takeover, no sidebar/header */}
      {showMaintenanceScreen && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background text-foreground">
          <div className="flex flex-col items-center text-center px-6 max-w-lg">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center mb-8">
              <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Scheduled Maintenance
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 tracking-tight">
              We'll be back soon
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-8 text-sm sm:text-base">
              {maintenance?.message || "We're performing scheduled maintenance. We'll be back shortly."}
            </p>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 text-sm font-medium text-foreground transition-colors"
            >
              <MdLogout className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      <RoleProvider
        role={tenantInfo.is_read_only ? 'Viewer' : (tenantInfo.userRole || null)}
        actualRole={tenantInfo.userRole || null}
        isReadOnly={Boolean(tenantInfo.is_read_only)}
        isPaymentPending={Boolean((tenantInfo as any).is_payment_pending)}
        isGracePeriod={Boolean(tenantInfo.is_grace_period)}
        graceDaysRemaining={tenantInfo.grace_days_remaining ?? null}
        graceEndDate={tenantInfo.grace_end_date ?? null}
        planExpiresAt={tenantInfo.plan_expires_at ?? null}
        planName={tenantInfo.plan || "Free"}
      >
        <PlanLockProvider>
          <ChristmasSnowfall />
          <NotificationScheduler />
          <div className={`min-h-screen bg-background text-foreground font-sans antialiased${showMaintenanceScreen ? " pointer-events-none select-none" : ""}`}>
            {!isLocked && !showMaintenanceScreen && (
              <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                tenantInfo={tenantInfo}
                isHovered={sidebarHovered}
                setIsHovered={setSidebarHovered}
              />
            )}

            {/* Main Content Area – single responsive container */}
            <div
              className={`min-h-screen flex flex-col transition-[padding] duration-200 ${
                isLocked || showMaintenanceScreen ? "pl-0" : "pl-0 lg:pl-[72px]"
              }`}
            >
              {!showMaintenanceScreen && <LimitBanner exceededLimits={exceededLimits} />}
              {!showMaintenanceScreen && (
                <Header
                  user={user}
                  isLoaded={isLoaded}
                  setMobileMenuOpen={setMobileMenuOpen}
                  tenantInfo={tenantInfo}
                />
              )}
              <main className="px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-8 flex-1 flex flex-col">
                {isLocked ? (
                  <LockScreen />
                ) : isTeamLocked ? (
                  <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                    <div className="w-20 h-20 bg-brand-500/10 text-brand-500 rounded-3xl flex items-center justify-center mb-6">
                      <MdLockOutline className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Workspace Locked</h2>
                    <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed text-sm sm:text-base">
                      Your workspace owner has downgraded their plan, which means team member access is currently disabled. Please contact your workspace owner to upgrade to Pro Plus to restore access.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                      <button
                        onClick={() => signOut()}
                        className="px-6 py-3 bg-card hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-border rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
                      >
                        <MdLogout className="w-5 h-5" />
                        Sign Out
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to leave this workspace? This action cannot be undone.")) {
                            await leaveTeam();
                            window.location.reload();
                          }
                        }}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
                      >
                        <MdWarning className="w-5 h-5" />
                        Leave Workspace
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {showOwnerWarning && (
                      <div className="mb-6 p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-500/20 rounded-lg text-brand-500 shrink-0">
                            <MdGroup className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-foreground font-semibold text-sm sm:text-base">Team Access Disabled</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                              You have active team members, but your current plan doesn't support them. Upgrade to restore their access.
                            </p>
                          </div>
                        </div>
                        <Link
                          href="/settings/billing"
                          prefetch={false}
                          className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-sm whitespace-nowrap transition-colors w-full sm:w-auto text-center"
                        >
                          Upgrade Now
                        </Link>
                      </div>
                    )}
                    <GracePeriodBanner />
                    <AnnouncementBanner userPlan={tenantInfo.plan} />
                    {children}
                  </>
                )}
              </main>
            </div>
          </div>
          <IdleTimer />
        </PlanLockProvider>
      </RoleProvider>
      </TaxEstimatorProvider>
    </AdminDateRangeProvider>
  );
}

// ------------------ Header ------------------
const TaxTopBarControls = () => {
  const {
    taxEntityType,
    setTaxEntityType,
    taxProfitBasis,
    setTaxProfitBasis,
    customProfit,
    setCustomProfit,
    customRate,
    setCustomRate,
  } = useTaxEstimator();
  const { setDateRange, setStartDate, setEndDate } = useAdminDateRange();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Business Entity Structure */}
      <div className="relative">
        <select
          value={taxEntityType}
          onChange={(e) => setTaxEntityType(e.target.value as any)}
          aria-label="Business Entity Structure"
          className="bg-card border border-border hover:border-black/20 dark:border-white/20 active:bg-black/5 dark:active:bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:border-brand-500 cursor-pointer shadow-2xs transition-all appearance-none pr-7 select-none"
        >
          <option value="corporate" className="bg-popover text-foreground">Company / Pvt Ltd (30% CIT)</option>
          <option value="individual" className="bg-popover text-foreground">Sole Proprietor (0% - 36%)</option>
          <option value="custom" className="bg-popover text-foreground">Concessionary / Custom %</option>
        </select>
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Custom Tax Rate (if custom entity selected) */}
      {taxEntityType === "custom" && (
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2.5 py-1.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500">Rate:</span>
          <input
            type="number"
            min="0"
            max="100"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
            className="w-10 text-xs font-bold text-foreground bg-transparent outline-none text-right"
            placeholder="30"
          />
          <span className="text-xs text-gray-500 font-bold">%</span>
        </div>
      )}

      {/* Profit Basis / Period Selector */}
      <div className="relative">
        <select
          value={taxProfitBasis}
          onChange={(e) => {
            const val = e.target.value as any;
            setTaxProfitBasis(val);
            const yr = new Date().getFullYear();
            if (val === "this year") {
              setDateRange("this year");
              setStartDate(`${yr}-01-01`);
              setEndDate(`${yr}-12-31`);
            } else if (val === "last year") {
              setDateRange("last year");
              setStartDate(`${yr - 1}-01-01`);
              setEndDate(`${yr - 1}-12-31`);
            }
          }}
          aria-label="Annual Net Profit Source"
          className="bg-card border border-border hover:border-black/20 dark:border-white/20 active:bg-black/5 dark:active:bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:border-brand-500 cursor-pointer shadow-2xs transition-all appearance-none pr-7 select-none"
        >
          <option value="this year" className="bg-popover text-foreground">Annual Profit (This Year)</option>
          <option value="last year" className="bg-popover text-foreground">Last Year's Profit</option>
          <option value="custom" className="bg-popover text-foreground">Custom Target Profit</option>
        </select>
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Custom Target Profit input (if custom profit selected) */}
      {taxProfitBasis === "custom" && (
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-2.5 py-1.5 shadow-2xs">
          <span className="text-[11px] font-medium text-gray-500">Target:</span>
          <input
            type="number"
            min="0"
            value={customProfit}
            onChange={(e) => setCustomProfit(e.target.value)}
            className="w-24 text-xs font-bold text-foreground bg-transparent outline-none text-right"
            placeholder="5000000"
          />
          <span className="text-[10px] text-gray-500 font-bold">LKR</span>
        </div>
      )}
    </div>
  );
};

const Header = ({ user, isLoaded, setMobileMenuOpen, tenantInfo }) => {
  const pathname = usePathname();
  const cleanPath = pathname.replace(/^\/user/, "") || "/dashboard";
  const isClients = cleanPath === "/clients";
  const isInventory = cleanPath === "/inventory";
  const isStock = cleanPath === "/stock" || cleanPath.startsWith("/stock");
  const isInvoiceDetail = cleanPath.startsWith("/invoice/");
  const isInvoiceNewOrEdit = cleanPath === "/invoices/new" || (cleanPath.startsWith("/invoices/") && cleanPath.endsWith("/edit"));
  const isDashboard = cleanPath === "/dashboard";
  const isAccounts = cleanPath.startsWith("/accounts");
  const isSettings = cleanPath.startsWith("/settings");
  const isLogs = cleanPath.startsWith("/logs");
  const isReports = cleanPath.startsWith("/reports");
  const [reportsActiveTab, setReportsActiveTab] = useState("overview");
  const isTaxEstimator = isReports && (
    reportsActiveTab === "tax_summary" ||
    pathname.includes("tax-summary") ||
    pathname.includes("tax_summary") ||
    pathname.includes("tax-estimator") ||
    pathname.includes("tax_estimator")
  );
  const hideSelector = isInvoiceDetail || isInvoiceNewOrEdit || isAccounts || isSettings || isLogs || isStock || (isInventory && tenantInfo.plan !== 'Pro Plus') || (isReports && tenantInfo.plan !== 'Pro Plus' && reportsActiveTab !== 'overview' && reportsActiveTab !== 'profit_loss' && !isTaxEstimator);
  const { dateRange, startDate, endDate, setDateRange, setStartDate, setEndDate } = useAdminDateRange();
  const [currentTime, setCurrentTime] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [headerSearchTerm, setHeaderSearchTerm] = useState("");
  const [reportsFormattedDate, setReportsFormattedDate] = useState("");
  const [dynamicTitle, setDynamicTitle] = useState("");

  useEffect(() => {
    const handleUpdateTitle = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setDynamicTitle(customEvent.detail);
    };
    window.addEventListener("update-title", handleUpdateTitle);
    return () => {
      window.removeEventListener("update-title", handleUpdateTitle);
    };
  }, []);

  useEffect(() => {
    setDynamicTitle("");
  }, [pathname]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setReportsActiveTab(customEvent.detail);
    };
    const handleDateChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setReportsFormattedDate(customEvent.detail);
    };
    window.addEventListener("reports:tab-change", handleTabChange);
    window.addEventListener("reports:formatted-date", handleDateChange);
    return () => {
      window.removeEventListener("reports:tab-change", handleTabChange);
      window.removeEventListener("reports:formatted-date", handleDateChange);
    };
  }, []);

  const getPageTitle = (path: string): string => {
    if (path === "/admin") return "Dashboard";
    const p = path.replace(/^\/user/, "") || "/dashboard";

    if (p === "/dashboard") return "Dashboard";
    if (p === "/clients") return "Clients";
    if (p === "/inventory") return "Inventory";
    if (p === "/stock" || p.startsWith("/stock")) return "Stock";
    if (p.startsWith("/clients/")) return "Client Details";
    if (p.startsWith("/invoice/")) {
      const parts = p.split("/");
      const id = parts[parts.length - 1];
      return id ? `Invoice #${id}` : "Invoice Details";
    }
    if (p === "/invoices/new") return "New Invoice";
    if (p.startsWith("/invoices/") && p.endsWith("/edit")) return "Edit Invoice";
    if (p.startsWith("/invoices")) return "Invoices";
    if (p === "/quotations/new") return "New Quotation";
    if (p.startsWith("/quotations/") && p.endsWith("/edit")) return "Edit Quotation";
    if (p.startsWith("/quotations")) return "Quotations";
    if (p.startsWith("/income")) return "Income";
    if (p.startsWith("/expenses")) return "Expenses";
    if (p.startsWith("/accounts")) return "Bank Accounts";
    if (p.startsWith("/reports")) {
      const parts = p.split("/");
      const sub = parts[2];
      if (sub === "profit-loss" || sub === "profit_loss") return "Profit & Loss";
      if (sub === "cash-flow" || sub === "cash_flow") return "Cash Flow";
      if (sub === "balance-sheet" || sub === "balance_sheet") return "Balance Sheet";
      if (sub === "tax-summary" || sub === "tax_summary" || sub === "tax-estimator" || sub === "tax_estimator") return "Tax Estimator";
      if (sub === "trial-balance" || sub === "trial_balance") return "Trial Balance";
      if (sub === "general-ledger" || sub === "general_ledger") return "General Ledger";
      if (sub === "account-ledger" || sub === "account_ledger") return "Account Ledger";
      if (sub === "overview") return "Overview";
      return "Reports";
    }
    if (p.startsWith("/settings")) {
      if (p.includes("/invoice-layout/builder")) {
        return "Invoice Layout";
      }
      if (p.includes("/invoice-layout")) {
        return "Invoice Layouts";
      }
      const parts = p.split("/");
      const sub = parts[2];
      if (sub === "profile") return "Account & Security";
      if (sub === "business") return "Business Profile";
      if (sub === "appearance") return "Appearance";
      if (sub === "billing") return "Billing & Plans";
      if (sub === "team") return "Team Settings";
      if (sub === "roles") return "Roles & Permissions";
      if (sub === "audit-logs" || sub === "audit_logs") return "Audit Logs";
      if (sub === "export") return "Data Export";
      if (sub === "danger") return "Danger Zone";
      if (sub === "preferences" || sub === "prefs") return "Admin Preferences";
      return "Settings";
    }
    if (p.startsWith("/logs")) return "Logs";
    return "Dashboard";
  };

  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    document.title = pageTitle ? `${pageTitle} | Framebooks` : "Framebooks";
  }, [pathname]);

  useEffect(() => {
    const updateDate = () => {
      const dateStr = new Date().toLocaleDateString("en-US", {
        timeZone: "Asia/Colombo",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      setCurrentDate(dateStr);
    };
    updateDate();
    // Update date occasionally (every hour) since it doesn't change by the second
    const dateInterval = setInterval(updateDate, 3600000);
    return () => clearInterval(dateInterval);
  }, []);

  // Clock moved to AnimatedClock component

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl h-16 sm:h-20 flex-shrink-0 flex items-center">
      <div className="w-full flex items-center justify-between px-3 sm:px-6 lg:px-8">

        {/* Left Side: Title & Date Selector */}
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl text-foreground shrink-0 cursor-pointer"
            aria-label="Open menu"
          >
            <MdMenu className="w-6 h-6" />
          </button>
          {/* Page Title */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold -skew-x-6 text-foreground tracking-tight flex items-baseline truncate">
            {dynamicTitle || getPageTitle(pathname)}<span className="text-brand-500 ml-0.5">.</span>
          </h1>

          {/* Top bar context action buttons */}
          {hideSelector && (isInvoiceDetail || isAccounts || pathname === "/user/social-media/new" || isStock) && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-border" />

              {pathname === "/user/social-media/new" && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Link href="/user/social-media" prefetch={false} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center hover:text-foreground" title="Go Back">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                  </Link>
                  <span className="text-sm font-semibold tracking-tight text-gray-300">Create New Post</span>
                </div>
              )}
              {isInvoiceDetail && (
                <div className="flex items-center gap-2">
                  <Link href="/user/invoices" prefetch={false} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center text-gray-400 hover:text-foreground mr-2" title="Back to Invoices">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                  </Link>
                  {tenantInfo.userRole !== 'Viewer' && !tenantInfo.is_read_only && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("invoice:create-income"))}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap"
                    >
                      <MdAttachMoney className="w-4 h-4" />
                      <span>Create Income</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("invoice:download-pdf"))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:opacity-90 text-brand-900 rounded-3xl font-bold transition-opacity active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap"
                  >
                    <MdDownload className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                  {tenantInfo?.plan === "Pro Plus" && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("invoice:print"))}
                      className="flex items-center gap-1.5 px-4 py-2 bg-card hover:bg-black/5 dark:hover:bg-white/10 text-foreground border border-border rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap shadow-2xs"
                      title="Direct Print Invoice"
                    >
                      <Printer className="w-4 h-4 text-brand-500" />
                      <span>Print</span>
                    </button>
                  )}
                  {tenantInfo.userRole !== 'Viewer' && !tenantInfo.is_read_only && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("invoice:cancel"))}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap shadow-2xs"
                      title="Cancel & Revoke Invoice"
                    >
                      <MdCancel className="w-4 h-4" />
                      <span>Cancel Invoice</span>
                    </button>
                  )}
                </div>
              )}
              {isAccounts && tenantInfo.userRole !== 'Viewer' && !tenantInfo.is_read_only && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-transfer"))}
                    className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-black/5 dark:hover:bg-white/10 text-foreground border border-border rounded-xl font-medium transition-colors cursor-pointer text-sm shadow-2xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Transfer Cash</span>
                  </button>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-create"))}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl font-bold transition-colors cursor-pointer text-sm"
                  >
                    <MdAdd className="w-4 h-4" />
                    <span>Add Account</span>
                  </button>
                </div>
              )}
              {isStock && (
                <div className="flex items-center gap-2">
                  {tenantInfo?.has_woocommerce ? (
                    <>
                      <StockSyncButton />
                      <div
                        className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-purple-500/10 border border-purple-500/25 text-purple-400 rounded-full font-semibold text-xs whitespace-nowrap"
                        title="Products and details are managed on WooCommerce"
                      >
                        <Plug className="w-3.5 h-3.5" />
                        <span>Managed via WooCommerce</span>
                      </div>
                    </>
                  ) : (
                    tenantInfo.userRole !== 'Viewer' && !tenantInfo.is_read_only && (
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("stock:open-new"))}
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap shadow-xs"
                      >
                        <MdAdd className="w-4 h-4" />
                        <span>Add Product</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}

          {!hideSelector && (
            <>
              {/* Divider */}
              <span className="hidden sm:block w-[1px] h-5 bg-border" />

              {/* Range Selector */}
              <div className="flex items-center">
                {(isClients || isInventory) ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-32 sm:w-64">
                      <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={headerSearchTerm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHeaderSearchTerm(val);
                          window.dispatchEvent(new CustomEvent(isInventory ? "inventory:search" : "clients:search", { detail: val }));
                        }}
                        className="w-full bg-card border border-border rounded-full pl-10 pr-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm text-foreground placeholder:text-gray-500 dark:placeholder:text-gray-400 shadow-2xs"
                      />
                    </div>
                    {tenantInfo.userRole !== 'Viewer' && (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent(isInventory ? "inventory:open-new" : "clients:open-new"))}
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap"
                      >
                        <MdAdd className="w-4 h-4" />
                        {isInventory ? "Add Item" : "Add Client"}
                      </button>
                    )}
                  </div>
                ) : isReports && reportsActiveTab === "trial_balance" ? (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("reports:toggle-datepicker"))}
                    className="bg-card border border-border hover:border-black/20 dark:border-white/20 active:bg-black/5 dark:active:bg-white/10 rounded-xl px-4 py-2 text-xs text-foreground flex items-center gap-2 transition-all cursor-pointer shadow-2xs select-none"
                  >
                    <MdCalendarToday className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    <span className="font-semibold text-gray-500 dark:text-gray-400">As of:</span>
                    <span className="font-bold">{reportsFormattedDate || "Select Date"}</span>
                  </button>
                ) : isTaxEstimator ? (
                  <TaxTopBarControls />
                ) : (
                  <DateRangeSelector
                    dateRange={dateRange}
                    startDate={startDate}
                    endDate={endDate}
                    onRangeChange={setDateRange}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Side: System Stats */}
        <div className="hidden xl:flex items-center gap-5 text-sm text-gray-600 dark:text-gray-400">
          {/* Live Visitors Status - Show only if > 0 */}
          {activeVisitors > 0 && (
            <>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">Live:</span>
                  <span className="font-semibold text-foreground">{activeVisitors} {activeVisitors === 1 ? "visitor" : "visitors"}</span>
                </span>
              </div>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
            </>
          )}

          {/* Current Time & Date */}
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
            <AnimatedClock />
            <span className="font-medium text-sm">{currentDate || "Loading..."}</span>
          </div>

          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            <PrivacyBlurToggle />
            <NotificationBell />
          </div>

          {/* POS Top Bar Entry */}
          <PosTopBarButton tenantInfo={tenantInfo} />

          {/* Business Profile Switcher & Info */}
          <BusinessSwitcher tenantInfo={tenantInfo} />
        </div>

        {/* Mobile / Tablet Right Controls */}
        <div className="xl:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
          <NotificationBell />
          <PosTopBarButton tenantInfo={tenantInfo} />
          <BusinessSwitcher tenantInfo={tenantInfo} />
        </div>
      </div>
    </header>
  );
};

const PosTopBarButton = ({ tenantInfo }: { tenantInfo: any }) => {
  const [activeShift, setActiveShift] = useState<{ id: number; shift_number: number } | null>(
    tenantInfo?.active_shift || null
  );

  // Sync with incoming tenantInfo updates
  useEffect(() => {
    if (tenantInfo?.active_shift !== undefined) {
      setActiveShift(tenantInfo.active_shift);
    }
  }, [tenantInfo?.active_shift]);

  // Sync with client-side shift events, cross-tab storage, and window focus
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const cached = localStorage.getItem("framebooks_pos_active_shift");
        if (cached === "closed") {
          setActiveShift(null);
        } else if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.id) {
            setActiveShift({
              id: Number(parsed.id),
              shift_number: Number(parsed.shift_number || parsed.id),
            });
          }
        }
      } catch {}
    };

    syncFromStorage();

    const handleShiftChange = (e: Event) => {
      const custom = e as CustomEvent<any>;
      if (custom.detail && custom.detail.id) {
        setActiveShift({
          id: Number(custom.detail.id),
          shift_number: Number(custom.detail.shift_number || custom.detail.id),
        });
      } else {
        setActiveShift(null);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "framebooks_pos_active_shift") {
        syncFromStorage();
      }
    };

    window.addEventListener("pos:shift-changed", handleShiftChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      window.removeEventListener("pos:shift-changed", handleShiftChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, []);

  if (tenantInfo?.has_pos_addon && tenantInfo?.can_use_pos !== false) {
    const hasActiveShift = Boolean(activeShift || tenantInfo?.has_active_shift);
    const shiftNumber = activeShift?.shift_number || tenantInfo?.active_shift?.shift_number;

    if (hasActiveShift) {
      return (
        <Link
          href="/pos"
          prefetch={false}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs transition-all active:scale-95 shadow-2xs group cursor-pointer"
          title={`POS • Shift #${shiftNumber || "1"} Active`}
        >
          <MdPointOfSale className="w-3.5 h-3.5 shrink-0" />
          <span>POS</span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-900/60 animate-pulse shrink-0" />
        </Link>
      );
    }

    // Shift is Closed / Inactive: Amber status button
    return (
      <Link
        href="/pos"
        prefetch={false}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs transition-all active:scale-95 shadow-2xs group cursor-pointer"
        title="POS • Shift Closed (Click to Open POS & Start Shift)"
      >
        <MdPointOfSale className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>POS</span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 shrink-0" />
      </Link>
    );
  }

  if (tenantInfo?.can_purchase_pos) {
    return (
      <Link
        href="/settings/billing#pos-addon"
        prefetch={false}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card hover:bg-black/5 dark:hover:bg-white/5 border border-border text-gray-400 hover:text-foreground font-semibold text-xs transition-all shadow-2xs"
        title="Get POS Add-on (Available on Pro & Pro Plus)"
      >
        <MdPointOfSale className="w-3.5 h-3.5 text-brand-500 shrink-0" />
        <span>POS</span>
        <MdLockOutline className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      href="/settings/billing"
      prefetch={false}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card hover:bg-black/5 dark:hover:bg-white/5 border border-border text-gray-400 hover:text-foreground font-semibold text-xs transition-all opacity-75 shadow-2xs"
      title="POS Add-on (Upgrade to Pro required)"
    >
      <MdPointOfSale className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span>POS</span>
      <MdLockOutline className="w-3.5 h-3.5 text-gray-400 shrink-0" />
    </Link>
  );
};

const StockSyncButton = () => {
  const [syncState, setSyncState] = useState<{
    isSyncing: boolean;
    progress: { current: number; total: number; percent: number } | null;
  }>({ isSyncing: false, progress: null });

  useEffect(() => {
    let unsub = () => {};
    import("@/lib/pos/product-sync-events").then(({ subscribeProductSync }) => {
      unsub = subscribeProductSync((state) => {
        setSyncState({ isSyncing: state.isSyncing, progress: state.progress });
      });
    });
    return () => unsub();
  }, []);

  const handleSync = async () => {
    if (syncState.isSyncing) return;
    const {
      broadcastProductSyncStart,
      broadcastProductSyncProgress,
      broadcastProductSyncComplete,
      broadcastProductSyncError,
    } = await import("@/lib/pos/product-sync-events");

    broadcastProductSyncStart();
    try {
      const { syncWooProductsBatchAction } = await import("@/app/(dashboard)/user/actions/woocommerce");
      let page = 1;
      let isFinished = false;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      const batchSize = 100;
      while (!isFinished) {
        const res = await syncWooProductsBatchAction(page, batchSize);
        if (!res.success) {
          throw new Error(res.error || "Failed to sync products from WooCommerce.");
        }

        totalImported += res.imported;
        totalUpdated += res.updated;
        totalCount = res.totalProducts || totalCount;

        const processed = Math.min(totalCount, page * batchSize);
        const percent = totalCount > 0 ? Math.min(100, Math.round((processed / totalCount) * 100)) : (res.isFinished ? 100 : 50);
        broadcastProductSyncProgress({ current: Math.min(processed, totalCount), total: totalCount, percent });

        if (res.isFinished || page >= res.totalPages || res.batchProcessed === 0) {
          isFinished = true;
        } else {
          page++;
        }
      }

      broadcastProductSyncComplete({ total: totalCount, imported: totalImported, updated: totalUpdated });
    } catch (err: any) {
      const msg = err.message || "Failed to sync products.";
      broadcastProductSyncError(msg);
      alert(msg);
    }
  };

  const syncing = syncState.isSyncing;
  const progress = syncState.progress;

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold transition-all cursor-pointer text-xs shadow-xs whitespace-nowrap disabled:opacity-50 active:scale-95"
      title="Sync all products & stock from WooCommerce"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
      <span>
        {syncing
          ? progress && progress.total > 0
            ? `Syncing (${progress.current}/${progress.total} • ${progress.percent}%)...`
            : "Syncing..."
          : "Sync Products"}
      </span>
    </button>
  );
};

// ------------------ Sidebar Component (Module Level) ------------------
const Sidebar = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  tenantInfo,
  isHovered,
  setIsHovered,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  tenantInfo: any;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
}) => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const isSettingsActive = pathname.startsWith("/user/settings") || pathname.startsWith("/settings");

  useEffect(() => {
    setIsHovered(false);
  }, [pathname, setIsHovered]);

  const links: { name: string; href: string; icon: any; divider?: boolean; newtab?: boolean }[] = [
    { name: "Dashboard", href: "/dashboard", icon: MdDashboard },
    { name: "Income", href: "/income", icon: MdAccountBalanceWallet },
    { name: "Expenses", href: "/expenses", icon: Receipt },
    { name: "Accounts", href: "/accounts", icon: MdAccountBalance, divider: false },
    { name: "Invoices", href: "/invoices", icon: MdInsertDriveFile, divider: true },
    { name: "Quotations", href: "/quotations", icon: NotepadTextDashed },
    { name: "Clients", href: "/clients", icon: MdGroup },
    { name: "Inventory", href: "/inventory", icon: MdInventory2 },
    ...(tenantInfo?.has_pos_addon && tenantInfo?.can_use_pos !== false
      ? [{ name: "Stock", href: "/stock", icon: Package }]
      : []),
    { name: "Reports", href: "/reports", icon: BarChart3, divider: true },
    { name: "Settings", href: "/settings", icon: MdSettings },
  ];

  const isActive = (href: string) => {
    const cur = pathname.replace(/^\/user/, "") || "/dashboard";
    const target = href.replace(/^\/user/, "");
    if (target === "/dashboard") return cur === "/dashboard";
    if (target === "/invoices") {
      return cur.startsWith("/invoices") || cur.startsWith("/invoice");
    }
    return cur.startsWith(target);
  };

  const isExpanded = mobileMenuOpen || isHovered;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-wise-charcoal/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{
          width: isExpanded ? 240 : 72,
          x: mobileMenuOpen ? 0 : undefined,
        }}
        transition={sidebarTransition}
        className={`fixed top-0 left-0 h-full bg-background/95 backdrop-blur-2xl z-50 border-r border-border
          ${isHovered ? "shadow-2xl ring-1 ring-black/5 dark:ring-white/10" : "shadow-xs"}
          ${mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}`}
        style={{ overflow: "hidden", willChange: "width" }}
      >
        <div className="flex flex-col h-full w-full">

          {/* Logo + Collapse toggle */}
          <div className="flex items-center h-20 flex-shrink-0 px-3 overflow-hidden relative">
            <Link href="/" prefetch={false} className="flex items-center h-full w-full overflow-hidden relative">
              {/* Folded icon */}
              <motion.div
                initial={false}
                animate={{
                  opacity: isExpanded ? 0 : 1,
                  scale: isExpanded ? 0.85 : 1,
                }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="absolute left-0 w-[48px] h-full flex items-center justify-center pointer-events-none"
              >
                <Image
                  src="/logos/ft/logo.png"
                  alt="FrameBooks"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain [filter:brightness(0)] dark:[filter:none]"
                />
              </motion.div>

              {/* Expanded full logo */}
              <motion.div
                initial={false}
                animate={{
                  opacity: isExpanded ? 1 : 0,
                  x: isExpanded ? 0 : -8,
                }}
                transition={{ duration: isExpanded ? 0.22 : 0.15, ease: "easeOut" }}
                className="flex items-center pl-1 min-w-0"
              >
                <Image
                  src="/logos/ft/name-logo.png"
                  alt="FrameBooks"
                  width={125}
                  height={25}
                  className="h-[25px] w-[125px] flex-shrink-0 [filter:brightness(0)] dark:[filter:none]"
                />
                {tenantInfo.plan && tenantInfo.plan !== "Loading..." && (
                  <span className="text-gray-400 dark:text-foreground/30 text-[11px] font-medium tracking-widest ml-2.5 flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap">
                    |
                    <span className="text-emerald-700 dark:text-brand-500 font-bold uppercase text-[10px]">
                      {tenantInfo.plan.toLowerCase() === "pro plus" ? "PRO +" : tenantInfo.plan}
                    </span>
                  </span>
                )}
              </motion.div>
            </Link>

            {/* Mobile: close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-3xl ml-auto"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden min-h-0">
            {links.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div key={item.href} data-tour={item.name.toLowerCase()} className="relative flex justify-center w-full">
                  {active && (
                    <motion.div
                      layoutId="active-sidebar-tab"
                      className="absolute inset-0 bg-brand-500/15 border border-brand-500/20 dark:bg-white/10 dark:border-transparent rounded-2xl pointer-events-none"
                      initial={false}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsHovered(false);
                    }}
                    target={item.newtab ? "_blank" : "_self"}
                    title={item.name}
                    className={`relative z-10 flex items-center h-11 rounded-2xl w-full px-3 gap-3 overflow-hidden transition-colors duration-150
                      ${active
                        ? "text-brand-700 dark:text-brand-400 font-semibold"
                        : "text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                      <Icon className="w-5 h-5" />
                    </span>

                    <motion.span
                      initial={false}
                      animate={{
                        opacity: isExpanded ? 1 : 0,
                        x: isExpanded ? 0 : -8,
                      }}
                      transition={{
                        duration: isExpanded ? 0.2 : 0.14,
                        ease: "easeOut",
                      }}
                      className="whitespace-nowrap text-sm truncate font-medium flex-1 pointer-events-none"
                    >
                      {item.name}
                    </motion.span>
                  </Link>
                </div>
              );
            })}
          </nav>

          {/* User Settings Link */}
          <div className="p-3 flex flex-col mt-auto space-y-2 shrink-0 border-t border-border w-full">
            <div className={`flex items-center w-full ${isExpanded ? "gap-2" : "justify-center"}`}>
              <Link
                href="/settings/profile"
                prefetch={false}
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsHovered(false);
                }}
                title={user?.name || "User Profile"}
                className={`flex items-center h-12 rounded-2xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                  isExpanded ? "flex-1 min-w-0 px-2 gap-3" : "w-12 justify-center px-0"
                }`}
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                  <ClientAvatar
                    imageUrl={user?.image}
                    name={user?.name || "User"}
                    email={user?.email}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-border aspect-square"
                    fallbackClassName="w-10 h-10 rounded-full bg-brand-500/10 border border-border flex items-center justify-center text-brand-400 font-bold text-xs shrink-0 aspect-square"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, width: 0, x: -8 }}
                      animate={{ opacity: 1, width: "auto", x: 0 }}
                      exit={{ opacity: 0, width: 0, x: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="overflow-hidden flex-1 min-w-0 pointer-events-none"
                    >
                      <p className="text-sm font-semibold text-foreground truncate">{user?.name || "User"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || "Account & Security"}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0, scale: 0.8 }}
                    animate={{ opacity: 1, width: "auto", scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.8 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden flex-shrink-0"
                  >
                    <LockSidebarButton />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

function LockSidebarButton() {
  const { hasAppLock, lock } = useAppLock();
  if (!hasAppLock) return null;
  return (
    <button
      onClick={lock}
      title="Lock App"
      className="p-3 bg-card border border-border hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 hover:text-foreground rounded-2xl transition-colors shrink-0 shadow-2xs"
    >
      <MdLockOutline className="w-5 h-5" />
    </button>
  );
}

function IdleTimer() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    let idleTimeout: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const IDLE_TIME_MS = 14 * 60 * 1000; // 14 minutes until warning

    const resetTimer = () => {
      clearTimeout(idleTimeout);
      clearInterval(countdownInterval);
      setShowWarning(false);
      setTimeLeft(60);

      idleTimeout = setTimeout(() => {
        setShowWarning(true);
        let currentLeft = 60;

        countdownInterval = setInterval(() => {
          currentLeft -= 1;
          setTimeLeft(currentLeft);

          if (currentLeft <= 0) {
            clearInterval(countdownInterval);
            signOut();
          }
        }, 1000);
      }, IDLE_TIME_MS);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      clearTimeout(idleTimeout);
      clearInterval(countdownInterval);
    };
  }, [showWarning, signOut]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center border border-border shadow-2xl">
        <div className="mx-auto w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mb-6">
          <MdAccessTime className="w-8 h-8 text-brand-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">You're about to be logged out</h2>
        <p className="text-gray-400 mb-6">
          It looks like you're not active right now. To keep your account secure, we'll automatically log you out when the timer runs out.
        </p>
        <div className="text-4xl font-bold text-foreground mb-8">
          00:{timeLeft.toString().padStart(2, '0')}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setShowWarning(false);
              // Event listener on document will catch next move and reset timer automatically
              // But just to be safe we can fire a fake event
              document.dispatchEvent(new MouseEvent('mousemove'));
            }}
            className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-full transition-colors cursor-pointer"
          >
            Stay logged in
          </button>
          <button
            onClick={() => signOut()}
            className="w-full py-3 bg-transparent text-gray-400 hover:text-foreground font-medium hover:underline transition-colors cursor-pointer"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
};