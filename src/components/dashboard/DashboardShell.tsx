// src/components/dashboard/DashboardShell.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Receipt, 
  BarChart3, 
  NotepadTextDashed, 
  Layers, 
  Repeat, 
  Megaphone, 
  Terminal, 
  ShieldCheck,
  Search,
  LogOut,
  User as UserIcon,
  RefreshCw
} from "lucide-react";
import { 
  MdDashboard, 
  MdAccountBalanceWallet, 
  MdInsertDriveFile, 
  MdGroup, 
  MdInventory2, 
  MdClose, 
  MdMenu, 
  MdSettings, 
  MdCalendarToday, 
  MdLockOutline, 
  MdAdd, 
  MdLocalOffer,
  MdAccountBalance
} from "react-icons/md";

import { AnimatedClock } from "@/app/(dashboard)/user/components/AnimatedClock";
import { ThemeToggle } from "@/app/(dashboard)/user/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import ClientAvatar from "@/components/ClientAvatar";
import { TenantLogo } from "@/components/TenantLogo";
import { CurrentAdmin } from "@/app/(dashboard)/admin/_lib/auth";

const sidebarSpring = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.8,
} as const;

export interface DashboardShellProps {
  variant: "user" | "admin";
  admin?: CurrentAdmin | null;
  tenantInfo?: {
    plan?: string;
    name?: string;
    logo_url?: string | null;
    industry?: string | null;
    userRole?: string | null;
  };
  children: React.ReactNode;
}

export function DashboardShell({
  variant,
  admin,
  tenantInfo = { plan: "Loading...", name: "My Business", logo_url: null, industry: null },
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  const [currentDate, setCurrentDate] = useState("");
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
    const updateDate = () => {
      const dateStr = new Date().toLocaleDateString("en-US", {
        timeZone: "Asia/Colombo",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setCurrentDate(dateStr);
    };
    updateDate();
    const dateInterval = setInterval(updateDate, 3600000);
    return () => clearInterval(dateInterval);
  }, []);

  // Compute page title based on path
  const getPageTitle = (path: string): string => {
    if (variant === "admin") {
      if (path === "/admin") return "Overview";
      if (path.startsWith("/admin/subscriptions") || path.startsWith("/admin/users")) return "Subscriptions";
      if (path.startsWith("/admin/payments")) return "Payments";
      if (path.startsWith("/admin/plans")) return "Plans";
      if (path.startsWith("/admin/coupons")) return "Coupons";
      if (path.startsWith("/admin/analytics")) return "Analytics";
      if (path.startsWith("/admin/announcements")) return "Announcements";
      if (path.startsWith("/admin/audit-logs")) return "Audit Logs";
      if (path.startsWith("/admin/admins")) return "Admins & Staff";
      if (path.startsWith("/admin/settings")) return "Settings";
      return "Admin";
    }

    // User paths
    if (path === "/user/dashboard") return "Dashboard";
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
    return "Dashboard";
  };

  // Define sidebar links based on variant
  const adminLinks = [
    { name: "Overview", href: "/admin", icon: MdDashboard },
    { name: "Subscriptions", href: "/admin/subscriptions", icon: Repeat },
    { name: "Payments", href: "/admin/payments", icon: MdAccountBalanceWallet },
    { name: "Plans", href: "/admin/plans", icon: Layers },
    { name: "Coupons", href: "/admin/coupons", icon: MdLocalOffer },
    { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: Terminal },
    { name: "Settings", href: "/admin/settings", icon: MdSettings },
  ];

  const userLinks = [
    { name: "Dashboard", href: "/user/dashboard", icon: MdDashboard },
    { name: "Income", href: "/user/income", icon: MdAccountBalanceWallet },
    { name: "Expenses", href: "/user/expenses", icon: Receipt },
    { name: "Accounts", href: "/user/accounts", icon: MdAccountBalance },
    { name: "Invoices", href: "/user/invoices", icon: MdInsertDriveFile },
    { name: "Quotations", href: "/user/quotations", icon: NotepadTextDashed },
    { name: "Clients", href: "/user/clients", icon: MdGroup },
    { name: "Inventory", href: "/user/inventory", icon: MdInventory2 },
    { name: "Reports", href: "/user/reports", icon: BarChart3 },
    { name: "Settings", href: "/user/settings", icon: MdSettings },
  ];

  const links = variant === "admin" ? adminLinks : userLinks;

  const isLinkActive = (href: string) => {
    if (href === "/admin" || href === "/user/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  if (pathname.startsWith("/admin/login") || pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
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
        className={`fixed top-0 left-0 h-full bg-background backdrop-blur-xl z-50 w-64
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 border-r border-border`}
        style={{ overflow: "hidden" }}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Header */}
          <div className="flex items-center justify-between h-20 flex-shrink-0 px-4">
            <div className="flex-1 flex items-center justify-start overflow-hidden">
              <Link href={variant === "admin" ? "/admin" : "/user/dashboard"} className="flex items-center">
                <Image
                  src="/logos/ft/name-logo.png"
                  alt="FrameBooks"
                  width={110}
                  height={22}
                  className="h-[22px] w-[110px] flex-shrink-0 [filter:brightness(0)] dark:[filter:none]"
                />
                {variant === "admin" ? (
                  <span className="text-gray-400 dark:text-foreground/30 text-[11px] font-medium tracking-widest ml-3 flex-shrink-0 flex items-center gap-2">
                    |
                    <span className="text-emerald-700 dark:text-brand-500 font-bold uppercase">
                      ADMIN
                    </span>
                  </span>
                ) : (
                  tenantInfo.plan && tenantInfo.plan !== "Loading..." && (
                    <span className="text-gray-400 dark:text-foreground/30 text-[11px] font-medium tracking-widest ml-3 flex-shrink-0 flex items-center gap-2">
                      |
                      <span className="text-emerald-700 dark:text-brand-500 font-bold uppercase">
                        {tenantInfo.plan.toLowerCase() === "pro plus" ? "PRO +" : tenantInfo.plan}
                      </span>
                    </span>
                  )
                )}
              </Link>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl ml-auto text-gray-400 hover:text-foreground cursor-pointer"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto min-h-0">
            {links.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item.href);
              return (
                <div key={item.href} className="relative">
                  {active && (
                    <motion.div
                      layoutId="active-sidebar-tab"
                      className="absolute inset-0 bg-brand-500/15 border border-brand-500/25 dark:bg-white/10 dark:border-transparent rounded-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative z-10 flex items-center gap-3 pl-3.5 pr-3 py-2 rounded-full transition-colors duration-150 overflow-hidden w-full justify-start
                      ${active
                        ? "text-brand-700 dark:text-brand-400 font-semibold"
                        : "text-foreground/80 font-medium hover:text-brand-600 dark:hover:text-brand-400 hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                  >
                    <span className="flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="overflow-hidden whitespace-nowrap text-xs tracking-tight">
                      {item.name}
                    </span>
                  </Link>
                </div>
              );
            })}

            {variant === "admin" && (
              <div className="pt-2 mt-2 border-t border-border">
                <button
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="relative z-10 flex items-center gap-3 pl-3.5 pr-3 py-2 rounded-full transition-colors duration-150 overflow-hidden w-full justify-start text-foreground/80 font-medium hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="flex-shrink-0">
                    <LogOut className="w-4 h-4" />
                  </span>
                  <span className="overflow-hidden whitespace-nowrap text-xs tracking-tight">
                    Sign out
                  </span>
                </button>
              </div>
            )}
          </nav>

          {/* Bottom Profile / Account Area (User only) */}
          {variant !== "admin" && (
            <div className="p-3.5 flex flex-col mt-auto space-y-2 shrink-0 border-t border-border">
              <div className="flex items-center gap-2">
                <Link
                  href="/user/settings?tab=profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center gap-2.5 p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors min-w-0"
                >
                  <ClientAvatar
                    imageUrl={user?.image}
                    name={user?.name || "User"}
                    email={user?.email}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-border"
                    fallbackClassName="w-8 h-8 rounded-full bg-brand-500/10 border border-border flex items-center justify-center text-brand-400 font-bold text-xs shrink-0"
                  />
                  <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user?.name || "User"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {user?.email || "Account"}
                    </p>
                  </div>
                </Link>
              </div>

              <div className="px-1 pt-2 text-[9px] text-gray-400 dark:text-gray-500 leading-tight text-center flex flex-col items-center justify-center gap-1">
                <p className="max-w-[200px]">
                  Your data stays secure with<br />
                  <span className="text-emerald-700 dark:text-brand-400 font-semibold">end-to-end encryption</span>.<br />
                  &copy; {new Date().getFullYear()} FrameToque Digital Media.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <motion.div
        animate={{ paddingLeft: 220 }}
        className="min-h-screen lg:flex flex-col hidden"
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl h-20 flex-shrink-0 flex items-center border-b border-border/50">
          <div className="w-full flex items-center justify-between px-6 lg:px-8">
            {/* Left: Title */}
            <div className="flex items-center gap-6">
              <h1 className="text-2xl sm:text-3xl font-bold -skew-x-6 text-foreground tracking-tight flex items-baseline">
                {dynamicTitle || getPageTitle(pathname)}<span className="text-brand-500 ml-0.5">.</span>
              </h1>
            </div>

            {/* Right: Actions, Clock, Date, Theme, User */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              {/* Time */}
              <AnimatedClock />

              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />

              {/* Date */}
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <MdCalendarToday className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="font-medium text-xs sm:text-sm">{currentDate || "Loading..."}</span>
              </div>

              <NotificationBell />
              <ThemeToggle />

              {/* Profile pill on top bar (User only) */}
              {variant !== "admin" && (
                <Link
                  href="/user/settings?tab=business"
                  className="flex items-center gap-3 pl-3 border-l border-border hover:opacity-80 transition-opacity"
                >
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-semibold text-foreground tracking-tight">{tenantInfo.name}</span>
                    {tenantInfo.userRole && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        You're {tenantInfo.userRole.charAt(0).toUpperCase() + tenantInfo.userRole.slice(1)}
                      </span>
                    )}
                  </div>
                  <TenantLogo
                    logoUrl={tenantInfo.logo_url}
                    name={tenantInfo.name}
                    className="w-9 h-9 rounded-full object-cover border border-border"
                    fallbackClassName="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
                  />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-6 lg:px-8 pt-6 pb-12 flex-1 flex flex-col">
          {children}
        </main>
      </motion.div>

      {/* Mobile Shell View */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl h-16 flex-shrink-0 flex items-center border-b border-border px-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-2xl cursor-pointer"
            >
              <MdMenu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold -skew-x-6 text-foreground tracking-tight flex items-baseline">
              {dynamicTitle || getPageTitle(pathname)}<span className="text-brand-500 ml-0.5">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="p-4 flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
