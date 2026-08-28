"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedClock } from "./components/AnimatedClock";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from 'next-auth/react';
import { getTenantInfo, leaveTeam } from "./actions/tenants";
import {
  motion,
  AnimatePresence,
  type Transition,
  type Variants,
} from "framer-motion";
import DateRangeSelector from "./components/DateRangeSelector";
import { AdminDateRangeProvider, useAdminDateRange } from "./context/AdminDateRangeContext";
import { RoleProvider } from "./context/RoleContext";
import { User as UserIcon, Building2, Receipt, Droplets, BarChart3, NotepadTextDashed, FolderOpenDot, Layers, FilePenLine, ChartLine, CalendarPlus, ExternalLink, Globe, RefreshCw, Server, Cloud, Megaphone, Terminal } from "lucide-react";
import { MdCreditCard, MdNotifications, MdMenu, MdSearch, MdDashboard, MdAccountBalanceWallet, MdInsertDriveFile, MdGroup, MdInventory2, MdLogout, MdClose, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdWorkOutline, MdKeyboardDoubleArrowLeft, MdKeyboardDoubleArrowRight, MdCalendarToday, MdAdd, MdAccessTime, MdSettings, MdAttachMoney, MdDownload, MdMenuBook, MdAccountBalance, MdLockOutline, MdLock, MdWarning } from "react-icons/md";
import { AppLockProvider, useAppLock, LockScreen } from "./components/AppLockProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { UpgradeModal } from "./components/UpgradeModal";
import ClientAvatar from "@/components/ClientAvatar";
import { PlanLockProvider } from "./components/PlanLockProvider";
import { LimitBanner } from "./components/LimitBanner";
import { getAllLimits } from "./actions/actions";

// Framer Motion spring config for sidebar width
const sidebarSpring = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.8,
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

  const desktopExpanded = !collapsed || (sidebarHovered && !ignoreHover);

  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const router = useRouter();

  const [tenantInfo, setTenantInfo] = useState<{plan: string, name: string, logo_url: string | null, industry: string | null, userRole?: string, teamMembersCount?: number, plan_expires_at?: string | null}>({ plan: "Loading...", name: "My Business", logo_url: null, industry: null });
  const [exceededLimits, setExceededLimits] = useState<string[]>([]);

  useEffect(() => {
    getTenantInfo().then(info => setTenantInfo(info));
    getAllLimits().then(limits => setExceededLimits(limits));
  }, []);

  useEffect(() => {
    if (isLoaded && user && !(user as any).tenantId) {
      router.push("/onboarding");
    }
  }, [isLoaded, user, router]);

  const isTeamLocked = tenantInfo.plan !== 'Loading...' && tenantInfo.plan !== 'Pro Plus' && tenantInfo.userRole !== 'owner' && tenantInfo.userRole !== 'Super Admin' && tenantInfo.userRole !== null;
  const showOwnerWarning = tenantInfo.plan !== 'Loading...' && tenantInfo.plan !== 'Pro Plus' && (tenantInfo.userRole === 'owner' || tenantInfo.userRole === 'Super Admin') && (tenantInfo.teamMembersCount || 0) > 1;

  return (
    <PlanLockProvider planExpiresAt={tenantInfo.plan_expires_at || null}>
    <AdminDateRangeProvider>
      <div className="min-h-screen bg-background text-foreground">
        {!isLocked && (
          <Sidebar
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            tenantInfo={tenantInfo}
          />
        )}

        {/* Main Content Area */}
        <motion.div
          animate={{ paddingLeft: isLocked ? 0 : 220 }}
          className="min-h-screen lg:flex flex-col hidden"
        >
          <LimitBanner exceededLimits={exceededLimits} />
          <Header user={user} isLoaded={isLoaded} setMobileMenuOpen={setMobileMenuOpen} tenantInfo={tenantInfo} />
          <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex-1 flex flex-col">
            <RoleProvider role={tenantInfo.userRole || null}>
              {isLocked ? <LockScreen /> : isTeamLocked ? (
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                  <div className="w-20 h-20 bg-brand-500/10 text-brand-500 rounded-3xl flex items-center justify-center mb-6">
                    <MdLockOutline className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">Workspace Locked</h2>
                  <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                    Your workspace owner has downgraded their plan, which means team member access is currently disabled. Please contact your workspace owner to upgrade to Pro Plus to restore access.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button onClick={() => signOut()} className="px-6 py-3 bg-card hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-border rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
                      <MdLogout className="w-5 h-5" />
                      Sign Out
                    </button>
                    <button onClick={async () => {
                      if(confirm("Are you sure you want to leave this workspace? This action cannot be undone.")) {
                        await leaveTeam();
                        window.location.reload();
                      }
                    }} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
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
                        <div className="p-2 bg-brand-500/20 rounded-lg text-brand-500">
                          <MdGroup className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground font-semibold">Team Access Disabled</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">You have active team members, but your current plan doesn't support them. Upgrade to restore their access.</p>
                        </div>
                      </div>
                      <Link href="/user/settings" className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                        Upgrade Now
                      </Link>
                    </div>
                  )}
                  {!hasAppLock && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                          <MdLockOutline className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground font-semibold">App Lock Not Configured</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Enable App Lock (Passkeys/Biometrics) to secure your dashboard from unauthorized access.</p>
                        </div>
                      </div>
                      <Link href="/user/settings" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                        Set up App Lock
                      </Link>
                    </div>
                  )}
                  {children}
                </>
              )}
            </RoleProvider>
          </main>
        </motion.div>

        {/* Mobile: no left padding */}
        <div className="lg:hidden flex flex-col min-h-screen">
          <LimitBanner exceededLimits={exceededLimits} />
          <Header user={user} isLoaded={isLoaded} setMobileMenuOpen={setMobileMenuOpen} tenantInfo={tenantInfo} />
          <main className="px-4 sm:px-6 pt-4 pb-8 flex-1 flex flex-col">
            <RoleProvider role={tenantInfo.userRole || null}>
              {isLocked ? <LockScreen /> : isTeamLocked ? (
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                  <div className="w-20 h-20 bg-brand-500/10 text-brand-500 rounded-3xl flex items-center justify-center mb-6">
                    <MdLockOutline className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">Workspace Locked</h2>
                  <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                    Your workspace owner has downgraded their plan, which means team member access is currently disabled. Please contact your workspace owner to upgrade to Pro Plus to restore access.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button onClick={() => signOut()} className="px-6 py-3 bg-card hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-border rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
                      <MdLogout className="w-5 h-5" />
                      Sign Out
                    </button>
                    <button onClick={async () => {
                      if(confirm("Are you sure you want to leave this workspace? This action cannot be undone.")) {
                        await leaveTeam();
                        window.location.reload();
                      }
                    }} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
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
                        <div className="p-2 bg-brand-500/20 rounded-lg text-brand-500">
                          <MdGroup className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground font-semibold">Team Access Disabled</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">You have active team members, but your current plan doesn't support them. Upgrade to restore their access.</p>
                        </div>
                      </div>
                      <Link href="/user/settings" className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                        Upgrade Now
                      </Link>
                    </div>
                  )}
                  {!hasAppLock && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                          <MdLockOutline className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground font-semibold">App Lock Not Configured</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Enable App Lock (Passkeys/Biometrics) to secure your dashboard from unauthorized access.</p>
                        </div>
                      </div>
                      <Link href="/user/settings" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                        Set up App Lock
                      </Link>
                    </div>
                  )}
                  {children}
                </>
              )}
            </RoleProvider>
          </main>
        </div>
      </div>
      <IdleTimer />
    </AdminDateRangeProvider>
    </PlanLockProvider>
  );
}

// ------------------ Header ------------------
const Header = ({ user, isLoaded, setMobileMenuOpen, tenantInfo }) => {
  const pathname = usePathname();
  const isClients = pathname === "/user/clients";
  const isInventory = pathname === "/user/inventory";
  const isInvoiceDetail = pathname.startsWith("/user/invoice/");
  const isDashboard = pathname === "/user/dashboard";
  const isAccounts = pathname.startsWith("/user/accounts");
  const isSettings = pathname.startsWith("/user/settings");
  const isLogs = pathname.startsWith("/user/logs");
  const isReports = pathname === "/user/reports";
  const [reportsActiveTab, setReportsActiveTab] = useState("overview");
  const hideSelector = isInvoiceDetail || isDashboard || isAccounts || isSettings || isLogs || (isInventory && tenantInfo.plan !== 'Pro Plus') || (isReports && tenantInfo.plan !== 'Pro Plus' && reportsActiveTab !== 'overview' && reportsActiveTab !== 'profit_loss');
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
    if (path === "/admin" || path === "/user/dashboard") return "Dashboard";
    if (path === "/user/clients") return "Clients";
    if (path === "/user/inventory") return "Inventory";
    if (path.startsWith("/user/clients/")) return "Client Details";
    if (path.startsWith("/user/invoice/")) {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      return id ? `Invoice #${id}` : "Invoice Details";
    }
    if (path === "/user/invoices/new") return "New Invoice";
    if (path.startsWith("/user/invoices/") && path.endsWith("/edit")) return "Edit Invoice";
    if (path.startsWith("/user/invoices")) return "Invoices";
    if (path === "/user/quotations/new") return "New Quotation";
    if (path.startsWith("/user/quotations/") && path.endsWith("/edit")) return "Edit Quotation";
    if (path.startsWith("/user/quotations")) return "Quotations";
    if (path.startsWith("/user/income")) return "Income";
    if (path.startsWith("/user/expenses")) return "Expenses";
    if (path.startsWith("/user/accounts")) return "Accounts";
    if (path.startsWith("/user/reports")) return "Reports";
    if (path.startsWith("/user/settings")) return "Settings";
    if (path.startsWith("/user/logs")) return "Logs";
    return "Admin";
  };

  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    document.title = `${pageTitle} | FrameBookss`;
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
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl h-20 flex-shrink-0 flex items-center">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Left Side: Title & Date Selector */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-3xl"
          >
            <MdMenu className="w-6 h-6" />
          </button>
          {/* Page Title */}
          <h1 className="text-2xl sm:text-3xl font-bold -skew-x-6 text-foreground tracking-tight flex items-baseline">
            {dynamicTitle || getPageTitle(pathname)}<span className="text-brand-500 ml-0.5">.</span>
          </h1>

          {/* Top bar context action buttons */}
          {hideSelector && (isInvoiceDetail || isAccounts || pathname === "/user/social-media/new") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />

              {pathname === "/user/social-media/new" && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Link href="/user/social-media" className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center hover:text-foreground" title="Go Back">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                  </Link>
                  <span className="text-sm font-semibold tracking-tight text-gray-300">Create New Post</span>
                </div>
              )}
              {isInvoiceDetail && (
                <div className="flex items-center gap-2">
                  <Link href="/user/invoices" className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center text-gray-400 hover:text-foreground mr-2" title="Back to Invoices">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
                  </Link>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("invoice:create-income"))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap"
                  >
                    <MdAttachMoney className="w-4 h-4" />
                    <span>Create Income</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("invoice:download-pdf"))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:opacity-90 text-brand-900 rounded-3xl font-bold transition-opacity active:scale-95 duration-200 cursor-pointer text-xs whitespace-nowrap"
                  >
                    <MdDownload className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              )}
              {isAccounts && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-transfer"))}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-foreground rounded-xl font-medium transition-colors cursor-pointer text-sm"
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
            </>
          )}

          {!hideSelector && (
            <>
              {/* Divider */}
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />

              {/* Range Selector */}
              <div className="flex items-center">
                {(isClients || isInventory) ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-32 sm:w-64">
                      <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="MdSearch..."
                        value={headerSearchTerm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHeaderSearchTerm(val);
                          window.dispatchEvent(new CustomEvent(isInventory ? "inventory:search" : "clients:search", { detail: val }));
                        }}
                        className="w-full bg-transparent border border-border rounded-full pl-10 pr-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm text-foreground"
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
                    className="bg-transparent border border-border hover:border-black/20 dark:border-white/20 active:bg-white/10 rounded-xl px-4 py-2 text-xs text-foreground flex items-center gap-2 transition-all cursor-pointer shadow-sm select-none"
                  >
                    <MdCalendarToday className="w-4 h-4 text-foreground" />
                    <span className="font-semibold text-gray-400">As of:</span>
                    <span className="font-bold">{reportsFormattedDate || "Select Date"}</span>
                  </button>
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
        <div className="hidden xl:flex items-center gap-5 text-sm text-gray-400">
          {/* Live Visitors Status - Show only if > 0 */}
          {activeVisitors > 0 && (
            <>
              <div className="flex items-center gap-2 text-gray-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium flex items-center gap-1">
                  <span className="text-gray-400">Live:</span>
                  <span className="font-semibold text-foreground/90">{activeVisitors} {activeVisitors === 1 ? "visitor" : "visitors"}</span>
                </span>
              </div>
              <span className="w-1 h-1 rounded-full bg-white/20" />
            </>
          )}

          {/* Current Time */}
          <AnimatedClock />

          <span className="w-1 h-1 rounded-full bg-white/20" />

          {/* Current Date (showing Day Name e.g. Fri, Sat, Sun) */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <MdCalendarToday className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-sm">{currentDate || "Loading..."}</span>
          </div>



          <ThemeToggle />

          {/* Business Info on Top Bar */}
          <Link href="/user/settings?tab=business" className="flex items-center gap-3 pl-4 ml-2 border-l border-border hover:opacity-80 transition-opacity">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-semibold text-foreground tracking-tight">{tenantInfo.name}</span>
              {tenantInfo.userRole && (
                <span className="text-xs text-gray-500 mt-0.5">You're {tenantInfo.userRole.charAt(0).toUpperCase() + tenantInfo.userRole.slice(1)}</span>
              )}
            </div>
            
            {(() => {
              const plan = (tenantInfo.plan || "").toLowerCase();
              const isProPlus = plan.includes("plus");
              const isPro = !isProPlus && plan.includes("pro");
              
              const Inner = () => tenantInfo.logo_url ? (
                <img src={tenantInfo.logo_url} alt="Logo" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-gray-400" />
                </div>
              );

              let containerClass = "rounded-full flex-shrink-0";
              if (isProPlus) {
                containerClass += " ring-2 ring-offset-2 ring-offset-background ring-brand-500 shadow-[0_0_15px_rgba(159,232,112,0.4)]";
              } else if (isPro) {
                containerClass += " ring-2 ring-offset-2 ring-offset-background ring-brand-500";
              }

              return (
                <div className={containerClass}>
                  <Inner />
                </div>
              );
            })()}
          </Link>
        </div>
      </div>
    </header>
  );
};

// ------------------ Sidebar Component (Module Level) ------------------
const Sidebar = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  tenantInfo,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  tenantInfo: { plan: string, name: string, logo_url: string | null, industry: string | null };
}) => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const isSettingsActive = pathname.startsWith("/user/settings");

  const links: { name: string; href: string; icon: any; divider?: boolean; newtab?: boolean }[] = [
    { name: "Dashboard", href: "/user/dashboard", icon: MdDashboard },
    { name: "Income", href: "/user/income", icon: MdAccountBalanceWallet },
    { name: "Expenses", href: "/user/expenses", icon: Receipt },
    { name: "Accounts", href: "/user/accounts", icon: MdAccountBalance, divider: false },
    { name: "Invoices", href: "/user/invoices", icon: MdInsertDriveFile, divider: true },
    { name: "Quotations", href: "/user/quotations", icon: NotepadTextDashed },
    { name: "Clients", href: "/user/clients", icon: MdGroup },
    { name: "Inventory", href: "/user/inventory", icon: MdInventory2 },
    { name: "Reports", href: "/user/reports", icon: BarChart3, divider: true },
    { name: "Settings", href: "/user/settings", icon: MdSettings },
  ];

  const isActive = (href: string) => {
    if (href === "/user/dashboard") return pathname === href;
    if (href === "/user/invoices") {
      return pathname.startsWith("/user/invoices") || pathname.startsWith("/user/invoice");
    }
    return pathname.startsWith(href);
  };

  const sidebarSpring = {
    type: "spring",
    stiffness: 280,
    damping: 28,
    mass: 0.8,
  } as const;

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
        animate={{
          width: 220,
          x: mobileMenuOpen ? 0 : undefined,
        }}
        transition={sidebarSpring}
        className={`fixed top-0 left-0 h-full bg-background backdrop-blur-xl z-50
          w-64
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ overflow: "hidden" }}
      >
        <div className="flex flex-col h-full">

          {/* Logo + Collapse toggle */}
          <div className="flex items-center justify-between h-20 flex-shrink-0 overflow-hidden px-4">

            <div className="flex-1 flex justify-center overflow-hidden">
              <Link href="/" className="lg:block flex items-center">
                <div className="flex items-center">
                  <Image
                    src="/logos/ft/name-logo.png"
                    alt="FrameBooks"
                    width={125}
                    height={25}
                    className="h-[25px] w-[125px] flex-shrink-0 animate-fade-in"
                  />
                  {tenantInfo.plan && tenantInfo.plan !== "Loading..." && (
                    <span className="text-foreground/30 text-[11px] font-medium tracking-widest ml-3 flex-shrink-0 flex items-center gap-2">
                      |
                      <span className="text-brand-500 font-bold uppercase">
                        {tenantInfo.plan.toLowerCase() === "pro plus" ? "PRO +" : tenantInfo.plan}
                      </span>
                    </span>
                  )}
                </div>
              </Link>
            </div>

            {/* Mobile: close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-3xl ml-auto"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
            {links.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    target={item.newtab ? "_blank" : "_self"}
                    className={`flex items-center gap-3 pl-[14px] pr-3 py-2.5 rounded-full transition-colors duration-150 overflow-hidden w-full justify-start
                      ${active
                        ? "bg-white/10 text-brand-500 font-semibold"
                        : "text-foreground font-medium hover:text-brand-500 bg-transparent"
                      }`}
                  >
                    <span className="flex-shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>

                    <span className="overflow-hidden whitespace-nowrap text-sm">
                      {item.name}
                    </span>
                  </Link>
                </div>
              );
            })}
          </nav>

          {/* User Settings Link */}
          <div className="p-4 flex flex-col mt-auto space-y-2">
            <div className="flex items-center gap-2">
              <Link 
                href="/user/settings?tab=profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center gap-3 p-2 hover:bg-card rounded-2xl transition-colors min-w-0"
              >
                <ClientAvatar 
                  imageUrl={user?.image} 
                  name={user?.name || "User"}
                  email={user?.email}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-border"
                  fallbackClassName="w-10 h-10 rounded-full bg-brand-500/10 border border-border flex items-center justify-center text-brand-400 font-bold text-sm shrink-0"
                />
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email || "Account & Security"}</p>
                </div>
              </Link>
              <LockSidebarButton />
            </div>
            
            <div className="px-2 pt-3 pb-1 text-[10px] text-gray-500 leading-relaxed text-center border-t border-border/50 flex flex-col items-center justify-center gap-1.5">
              <p className="max-w-[200px]">
                All Data are Secured &amp; <span className="text-brand-500 font-medium">End to End encrypted</span>. Guaranteed by <a href="https://frametoque.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors hover:underline">FrameToque Digital Media</a> @{new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function LockSidebarButton() {
  const { hasAppLock, lock } = useAppLock();
  if (!hasAppLock) return null;
  return (
    <button
      onClick={lock}
      title="Lock App"
      className="p-3 bg-card hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground rounded-2xl transition-colors shrink-0"
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