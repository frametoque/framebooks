// src/components/admin/AdminSidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Repeat,
  CreditCard,
  Layers,
  Tag,
  BarChart3,
  Megaphone,
  History,
  UserCog,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
} from "lucide-react";
import { AdminRole, hasPermission } from "@/app/(dashboard)/admin/_lib/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: any;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: Repeat, permission: "view_subscriptions" },
  { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "view_payments" },
  { label: "Plans", href: "/admin/plans", icon: Layers, permission: "view_plans" },
  { label: "Coupons", href: "/admin/coupons", icon: Tag, permission: "view_coupons" },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, permission: "view_analytics" },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone, permission: "manage_announcements" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: History, permission: "view_audit_logs" },
  { label: "Admins & Roles", href: "/admin/admins", icon: UserCog, superAdminOnly: true },
  { label: "Settings", href: "/admin/settings", icon: Sliders, superAdminOnly: true },
];

export function AdminSidebar({
  role,
  mobileOpen,
  setMobileOpen,
}: {
  role: AdminRole;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && role !== "super_admin") return false;
    if (item.permission && !hasPermission(role, item.permission)) return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r border-border select-none">
      {/* Brand & Toggle Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border">
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 text-brand-600 dark:text-brand-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1 text-base font-bold text-foreground tracking-tight whitespace-nowrap">
              <span>Framebooks</span>
              <span className="text-[#00E35B]">.</span>
              <span className="text-[10px] uppercase font-bold text-brand-600 dark:text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded ml-1 border border-brand-500/20">
                Admin
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "text-brand-700 dark:text-brand-400 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {/* Sliding Highlight using Framer Motion layoutId */}
              {isActive && (
                <motion.div
                  layoutId="admin-sidebar-highlight"
                  className="absolute inset-0 bg-brand-500/15 dark:bg-brand-500/10 border border-brand-500/30 rounded-xl z-0"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className="w-4 h-4 shrink-0 relative z-10" />
              {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Return to App Link */}
      <div className="p-3 border-t border-border">
        <Link
          href="/user/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors truncate"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Return to Main App</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        <div
          className={`fixed top-0 bottom-0 left-0 z-30 transition-all duration-300 ${
            collapsed ? "w-18" : "w-64"
          }`}
        >
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10"
            >
              {sidebarContent}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-3 p-2 text-gray-400 hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
