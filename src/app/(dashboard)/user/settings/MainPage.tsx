"use client";
import { Loader } from "@/components/ui/Loader";
import RolesConfigurator from "../components/RolesConfigurator";


import { useState, useEffect, useRef } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useSession, signOut } from 'next-auth/react';
import { IdCard, Globe, Save, Building, Copy, Terminal, Store, Sliders, Upload, FileText, CheckCircle2, AlertCircle, X, ExternalLink, ArrowUp, ArrowDown, Palette, ChevronDown, Clock, ShieldOff, ShieldCheck, Sparkles, Info, Loader2, CreditCard, Plus, Repeat, Wallet, AlertTriangle, Tag, RefreshCw, ArrowRight, Bell, QrCode, Plug } from "lucide-react";
import IntegrationsTab from "./IntegrationsTab";
import { TeamPosCodeModal } from "@/components/pos/TeamPosCodeModal";
import { MdPerson, MdMailOutline, MdKeyboardArrowRight, MdKeyboardArrowLeft, MdLocationOn, MdPhone, MdUpload, MdDownload, MdCheck, MdShowChart, MdCreditCard, MdGroup, MdBusiness, MdHistory, MdLogout, MdWarning, MdSecurity, MdDelete, MdLock } from "react-icons/md";
import AppearanceTab from "./AppearanceTab";
import InvoiceLayoutTab from "./invoice-layout/InvoiceLayoutTab";
import { NotificationsTab } from "./NotificationsTab";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { updateTenantInfo, getTeamMembers, updateTeamMemberRole, removeTeamMember, leaveTeam, getCurrentUserRole, resetWorkspace, deleteWorkspace, deletePersonalAccount, deleteTeamInvitation } from "../actions/tenants";
import { exportData, exportReport } from "../actions/export";
import DateRangeSelector from "../components/DateRangeSelector";
import { getRoles } from "../actions/roles";
import { useAppLock } from "../components/AppLockProvider";
import AuditLogsTab from "./AuditLogsTab";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { UpgradeOverlay } from "../components/UpgradeOverlay";
import Image from "next/image";
import { TenantLogo } from "@/components/TenantLogo";
import ClientAvatar from "@/components/ClientAvatar";

export interface PlanViewItem {
  name: string;
  price: string;
  yearlyPrice: string;
  description: string;
  popular: boolean;
  features: {
    label: string;
    value: string;
    icon: any;
  }[];
}

export function formatDBPlanToDashboardPlan(p: any): PlanViewItem {
  const limits = p.limits || {};
  const features = p.features || {};

  return {
    name: p.name,
    price: p.price_monthly === 0 ? "0" : Number(p.price_monthly).toLocaleString(),
    yearlyPrice: p.price_yearly === 0 ? "0" : Number(p.price_yearly).toLocaleString(),
    description: p.description || "",
    popular: !!p.is_popular,
    features: [
      {
        label: "Invoices Limit",
        value: (p.name === 'Pro' || p.name === 'Pro Plus' || p.key === 'pro' || p.key === 'pro_plus' || limits.invoices === -1) ? "Unlimited" : String(limits.invoices ?? 50),
        icon: MdUpload
      },
      {
        label: "Quotations Limit",
        value: (p.name === 'Pro' || p.name === 'Pro Plus' || p.key === 'pro' || p.key === 'pro_plus' || limits.quotations === -1) ? "Unlimited" : String(limits.quotations ?? 50),
        icon: MdUpload
      },
      {
        label: "Income Limit",
        value: limits.incomes === -1 ? "Unlimited" : String(limits.incomes ?? 100),
        icon: MdUpload
      },
      {
        label: "Expense Limit",
        value: limits.expenses === -1 ? "Unlimited" : String(limits.expenses ?? 100),
        icon: MdDownload
      },
      {
        label: "Client Limit",
        value: limits.clients === -1 ? "Unlimited" : String(limits.clients ?? 50),
        icon: MdGroup
      },
      {
        label: "Bank Accounts",
        value: limits.accounts === -1 ? "Unlimited" : String(limits.accounts ?? 2),
        icon: MdBusiness
      },
      {
        label: "Team Members",
        value: limits.team_members === -1 ? "Unlimited" : (limits.team_members > 0 ? String(limits.team_members) : "No"),
        icon: MdGroup
      },
      {
        label: "Customized Invoices & Quotations",
        value: (p.name === 'Pro Plus' || p.key === 'pro_plus' || (features.custom_invoice_layout && p.key !== 'pro' && p.name !== 'Pro')) ? "Yes" : "No",
        icon: MdCheck
      },
      {
        label: "Inventory Management",
        value: features.inventory ? "Yes" : "No",
        icon: MdCheck
      },
      {
        label: "Advanced Reports",
        value: features.advanced_reports ? "Yes" : "No",
        icon: MdShowChart
      },
      {
        label: "Security Level",
        value: features.audit_logs ? "High + Audit Logs" : (features.two_factor ? "High + 2FA" : "Standard"),
        icon: MdSecurity
      },
      {
        label: "Customize Workspace Appearance",
        value: p.name === 'Pro Plus' || p.name === 'Pro' || p.key === 'pro' || p.key === 'pro_plus' || features.appearance ? "Yes" : "No",
        icon: Palette
      },
    ],
  };
}

const defaultPlans: PlanViewItem[] = [
  {
    name: "Free",
    price: "0",
    yearlyPrice: "0",
    description: "Get started for free to explore the product",
    popular: false,
    features: [
      { label: "Invoices Limit", value: "50", icon: MdUpload },
      { label: "Quotations Limit", value: "50", icon: MdUpload },
      { label: "Income Limit", value: "100", icon: MdUpload },
      { label: "Expense Limit", value: "100", icon: MdDownload },
      { label: "Client Limit", value: "50", icon: MdGroup },
      { label: "Bank Accounts", value: "2", icon: MdBusiness },
      { label: "Team Members", value: "No", icon: MdGroup },
      { label: "Customized Invoices & Quotations", value: "No", icon: MdCheck },
      { label: "Customize Workspace Appearance", value: "No", icon: Palette },
      { label: "Inventory Management", value: "No", icon: MdCheck },
      { label: "Advanced Reports", value: "No", icon: MdShowChart },
      { label: "Security Level", value: "Standard", icon: MdSecurity },
    ],
  },
  {
    name: "Pro",
    price: "2,600",
    yearlyPrice: "26,000",
    popular: true,
    description: "Advanced tools to manage finances and grow faster.",
    features: [
      { label: "Invoices Limit", value: "Unlimited", icon: MdUpload },
      { label: "Quotations Limit", value: "Unlimited", icon: MdUpload },
      { label: "Income Limit", value: "Unlimited", icon: MdUpload },
      { label: "Expense Limit", value: "Unlimited", icon: MdDownload },
      { label: "Client Limit", value: "Unlimited", icon: MdGroup },
      { label: "Bank Accounts", value: "2", icon: MdBusiness },
      { label: "Team Members", value: "No", icon: MdGroup },
      { label: "Customized Invoices & Quotations", value: "No", icon: MdCheck },
      { label: "Customize Workspace Appearance", value: "Yes", icon: Palette },
      { label: "Inventory Management", value: "No", icon: MdCheck },
      { label: "Advanced Reports", value: "Yes", icon: MdShowChart },
      { label: "Security Level", value: "High + 2FA", icon: MdSecurity },
    ],
  },
  {
    name: "Pro Plus",
    price: "5,200",
    yearlyPrice: "52,000",
    description: "For Power Users and large teams",
    popular: false,
    features: [
      { label: "Invoices Limit", value: "Unlimited", icon: MdUpload },
      { label: "Quotations Limit", value: "Unlimited", icon: MdUpload },
      { label: "Income Limit", value: "Unlimited", icon: MdUpload },
      { label: "Expense Limit", value: "Unlimited", icon: MdDownload },
      { label: "Client Limit", value: "Unlimited", icon: MdGroup },
      { label: "Bank Accounts", value: "Unlimited", icon: MdBusiness },
      { label: "Team Members", value: "Unlimited", icon: MdGroup },
      { label: "Customized Invoices & Quotations", value: "Yes", icon: MdCheck },
      { label: "Customize Workspace Appearance", value: "Yes", icon: Palette },
      { label: "Inventory Management", value: "Yes", icon: MdCheck },
      { label: "Advanced Reports", value: "Yes", icon: MdShowChart },
      { label: "Security Level", value: "High + Audit Logs", icon: MdSecurity },
    ],
  }
];

import {
  SETTINGS_SLUG_TO_TAB,
  SETTINGS_TAB_TO_SLUG,
  SETTINGS_TAB_TITLES,
  isSettingsSectionAllowed
} from "./settings-permissions";

export {
  SETTINGS_SLUG_TO_TAB,
  SETTINGS_TAB_TO_SLUG,
  SETTINGS_TAB_TITLES,
  isSettingsSectionAllowed
};

interface SettingsMemoryCache {
  profile: any;
  passkeys: any[];
  tenantInfo: any;
  currentUserRole: string | null;
  teamData?: {
    sent: any[];
    members: any[];
    roles: any[];
  };
}

let settingsMemoryCache: SettingsMemoryCache | null = null;

const AUTO_LOCK_OPTIONS = [
  { value: 60000, label: "After 1 minute" },
  { value: 300000, label: "After 5 minutes" },
  { value: 600000, label: "After 10 minutes" },
  { value: 900000, label: "After 15 minutes" },
  { value: 1800000, label: "After 30 minutes" },
  { value: 3600000, label: "After 1 hour" },
  { value: 0, label: "Auto-lock off" },
];

function AutoLockDurationSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption =
    AUTO_LOCK_OPTIONS.find((opt) => opt.value === value) ||
    (value === 0 ? AUTO_LOCK_OPTIONS[6] : AUTO_LOCK_OPTIONS[1]);

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-card border rounded-2xl px-4 py-3 text-sm text-foreground flex items-center justify-between transition-all cursor-pointer shadow-2xs ${isOpen
            ? "border-brand-500 ring-2 ring-brand-500/20"
            : "border-border hover:border-black/20 dark:hover:border-white/20"
          }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span className={value === 0 ? "text-amber-500" : "text-brand-500"}>
            {value === 0 ? <ShieldOff className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </span>
          <span className="font-medium text-foreground truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${isOpen ? "rotate-180 text-brand-500" : ""
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full rounded-2xl bg-popover border border-border/80 dark:border-white/10 shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
          {AUTO_LOCK_OPTIONS.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-all cursor-pointer text-left ${isSelected
                    ? "bg-brand-500/10 text-brand-500 font-semibold dark:bg-brand-500/15"
                    : "text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      isSelected
                        ? option.value === 0
                          ? "text-amber-500"
                          : "text-brand-500"
                        : "text-muted-foreground"
                    }
                  >
                    {option.value === 0 ? <ShieldOff className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </span>
                  <span>{option.label}</span>
                </div>
                {isSelected && <MdCheck className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface SettingsPageProps {
  initialPlans?: any[];
  initialSection?: string;
}

export default function SettingsPage({ initialPlans, initialSection }: SettingsPageProps = {}) {
  const [plansList, setPlansList] = useState<PlanViewItem[]>(() => {
    if (initialPlans && initialPlans.length > 0) {
      return initialPlans.map(formatDBPlanToDashboardPlan);
    }
    return defaultPlans;
  });

  useEffect(() => {
    import("../actions/billing").then(m => m.getAvailablePlansAction()).then(res => {
      if (res?.success && res.plans && res.plans.length > 0) {
        setPlansList(res.plans.map(formatDBPlanToDashboardPlan));
      }
    }).catch(() => { });
  }, []);
  const { confirm } = useConfirm();
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const searchParams = useSearchParams();
  const router = useRouter();

  const cachedRole = settingsMemoryCache?.currentUserRole;
  const targetTabFromSection = initialSection ? SETTINGS_SLUG_TO_TAB[initialSection] : undefined;
  const targetTabFromQuery = searchParams.get("tab") ? SETTINGS_SLUG_TO_TAB[searchParams.get("tab")!] : undefined;
  const requestedTab = targetTabFromSection || targetTabFromQuery;
  const isAllowedInitial = !requestedTab || !cachedRole || isSettingsSectionAllowed(requestedTab, cachedRole);

  const [activeTab, setActiveTab] = useState(isAllowedInitial && requestedTab ? requestedTab : "profile");
  const [activeView, setActiveView] = useState(isAllowedInitial && requestedTab ? "form" : "hub");

  const [teamSubTab, setTeamSubTab] = useState<"members" | "roles">(() => {
    if (initialSection === "roles") return "roles";
    if (searchParams.get("sub") === "roles") return "roles";
    return "members";
  });

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(() => settingsMemoryCache?.currentUserRole || null);

  // Role guard effect: immediately revert to profile/hub if activeTab is forbidden for current role
  useEffect(() => {
    if (currentUserRole && !isSettingsSectionAllowed(activeTab, currentUserRole)) {
      setActiveTab("profile");
      setActiveView("hub");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, '', '/settings');
        window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
      }
    }
  }, [currentUserRole, activeTab]);

  useEffect(() => {
    if (initialSection) {
      const mapped = SETTINGS_SLUG_TO_TAB[initialSection] || "profile";
      if (currentUserRole && !isSettingsSectionAllowed(mapped, currentUserRole)) {
        setActiveTab("profile");
        setActiveView("hub");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, '', '/settings');
        }
        return;
      }
      setActiveTab(mapped);
      setActiveView("form");
      if (initialSection === "roles") {
        setTeamSubTab("roles");
      } else if (initialSection === "team") {
        setTeamSubTab("members");
      }
    } else {
      if (typeof window !== "undefined") {
        const match = window.location.pathname.match(/(?:\/user)?\/settings\/?([^/]*)/);
        const slug = match ? match[1] : "";
        if (!slug) {
          setActiveView("hub");
        }
      }
    }
  }, [initialSection, currentUserRole]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      const mapped = SETTINGS_SLUG_TO_TAB[tabParam] || "profile";
      if (currentUserRole && !isSettingsSectionAllowed(mapped, currentUserRole)) {
        setActiveTab("profile");
        setActiveView("hub");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, '', '/settings');
        }
        return;
      }
      setActiveTab(mapped);
      setActiveView("form");
    }
  }, [searchParams, currentUserRole]);

  useEffect(() => {
    if (!initialSection && !searchParams.get("tab") && typeof window !== "undefined") {
      const match = window.location.pathname.match(/(?:\/user)?\/settings\/?([^/]*)/);
      const slug = match ? match[1] : "";
      if (slug && SETTINGS_SLUG_TO_TAB[slug]) {
        const mapped = SETTINGS_SLUG_TO_TAB[slug];
        if (currentUserRole && !isSettingsSectionAllowed(mapped, currentUserRole)) {
          setActiveTab("profile");
          setActiveView("hub");
          window.history.replaceState(null, '', '/settings');
          return;
        }
        setActiveTab(mapped);
        setActiveView("form");
      }
    }
  }, [currentUserRole]);
  const [loading, setLoading] = useState(() => !settingsMemoryCache);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userNameSaving, setUserNameSaving] = useState(false);
  const [userNameSuccess, setUserNameSuccess] = useState(false);
  const [customPasskeys, setCustomPasskeys] = useState<any[]>(() => settingsMemoryCache?.passkeys || []);
  const { autoLockDuration, setAutoLockDuration, highSecurityMode, setHighSecurityMode, requireAuth } = useAppLock();
  const [tenantInfo, setTenantInfo] = useState<{ plan: string, name: string, logo_url: string | null, industry: string | null, phone: string | null, email: string | null, website: string | null, address: string | null, accent_color?: string | null, has_pos_addon?: boolean }>(() => settingsMemoryCache?.tenantInfo || { plan: "Free", name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null, accent_color: null, has_pos_addon: false });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [sentInvitations, setSentInvitations] = useState<any[]>(() => settingsMemoryCache?.teamData?.sent || []);
  const [teamMembers, setTeamMembers] = useState<any[]>(() => settingsMemoryCache?.teamData?.members || []);
  const [managingPosCodeMember, setManagingPosCodeMember] = useState<any | null>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>(() => settingsMemoryCache?.teamData?.roles || []);

  const [reportType, setReportType] = useState<"profit_loss" | "cash_flow" | "balance_sheet" | "">("");
  const [reportDateRange, setReportDateRange] = useState("this year");
  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleDeleteInvitation = async (id: number, email: string) => {
    if (!await confirm(`Are you sure you want to cancel the invitation sent to ${email}?`)) return;
    try {
      const res = await deleteTeamInvitation(id);
      if (res.success) {
        setSentInvitations(prev => prev.filter(inv => inv.id !== id));
        if (settingsMemoryCache?.teamData) {
          settingsMemoryCache.teamData.sent = settingsMemoryCache.teamData.sent.filter(inv => inv.id !== id);
        }
      } else {
        alert(res.error || "Failed to delete invitation");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeamData = async () => {
    try {
      if (settingsMemoryCache?.teamData) {
        setSentInvitations(settingsMemoryCache.teamData.sent);
        setTeamMembers(settingsMemoryCache.teamData.members);
        setAvailableRoles(settingsMemoryCache.teamData.roles);
        return;
      }
      const [invitesRes, membersRes, rolesRes] = await Promise.all([
        fetch('/api/team/invitations/sent').then(r => r.json()),
        getTeamMembers(),
        getRoles()
      ]);
      const sent = invitesRes.sent || [];
      const members = membersRes.success ? membersRes.members : [];
      const roles = rolesRes || [];
      setSentInvitations(sent);
      setTeamMembers(members);
      setAvailableRoles(roles);
      if (settingsMemoryCache) {
        settingsMemoryCache.teamData = { sent, members, roles };
      }
    } catch (e) {
      console.error("Failed to fetch team data", e);
    }
  };

  useEffect(() => {
    if ((activeTab === "team" || activeTab === "danger") && user && isSettingsSectionAllowed(activeTab, currentUserRole)) {
      fetchTeamData();
    }
  }, [activeTab, user, currentUserRole]);

  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState(() => {
    if (settingsMemoryCache?.profile) {
      const p = settingsMemoryCache.profile;
      return {
        id: "",
        name: p?.fullName || user?.name || "",
        email: p?.email || user?.email || "",
        phone: p?.phone || "",
        company: p?.company || "",
        website: p?.website || "",
        address: p?.address || "",
      };
    }
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      company: "",
      website: "",
      address: "",
    };
  });

  const connectedAccounts = [];

  // Helper: apply a fetched profile object onto formData
  const applyProfile = (profile: any) => {
    setFormData(prev => ({
      ...prev,
      name: profile?.fullName || user?.name || "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
      company: profile?.company || "",
      website: profile?.website || "",
      address: profile?.address || "",
    }));
  };

  // Load user + DB data
  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      const loadAllData = async () => {
        try {
          if (!settingsMemoryCache) {
            setLoading(true);
          }

          let fetchedProfile: any = null;
          let fetchedPasskeys: any[] = [];
          let fetchedTenant: any = null;
          let fetchedRole: string | null = null;

          const fetchProfileAndPasskeys = async () => {
            const [resProfile, resPasskeys] = await Promise.all([
              fetch(`/api/users/get-profile?userId=${user.id}`),
              fetch(`/api/auth/passkey/list`)
            ]);

            if (resProfile.ok) {
              const data = await resProfile.json();
              fetchedProfile = data.success ? data.profile : null;
              applyProfile(fetchedProfile);
            } else {
              applyProfile(null);
            }

            if (resPasskeys.ok) {
              const pkData = await resPasskeys.json();
              fetchedPasskeys = pkData.passkeys || [];
              setCustomPasskeys(fetchedPasskeys);
            }
          };

          const fetchTenantAndRole = async () => {
            const { getClientTenantInfo } = await import("@/lib/tenant/clientTenantInfo");
            const [data, role] = await Promise.all([
              getClientTenantInfo(),
              getCurrentUserRole()
            ]);
            if (data) {
              fetchedTenant = data;
              setTenantInfo(data);
            }
            if (role) {
              fetchedRole = role;
              setCurrentUserRole(role);
            }
          };

          await Promise.all([fetchProfileAndPasskeys(), fetchTenantAndRole()]);

          settingsMemoryCache = {
            profile: fetchedProfile || settingsMemoryCache?.profile,
            passkeys: fetchedPasskeys || settingsMemoryCache?.passkeys || [],
            tenantInfo: fetchedTenant || settingsMemoryCache?.tenantInfo,
            currentUserRole: fetchedRole || settingsMemoryCache?.currentUserRole || null,
            teamData: settingsMemoryCache?.teamData,
          };
        } catch (err) {
          console.error("Error loading settings:", err);
        } finally {
          setLoading(false);
        }
      };

      loadAllData();
    } else {
      setLoading(false);
    }
  }, [isLoaded, user]);

  // Handle browser back and forward button navigation seamlessly
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const match = pathname.match(/(?:\/user)?\/settings\/?([^/]*)/);
      const slug = match ? match[1] : "";
      if (!slug) {
        setActiveView("hub");
        window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
      } else {
        const mapped = SETTINGS_SLUG_TO_TAB[slug] || "profile";
        if (currentUserRole && !isSettingsSectionAllowed(mapped, currentUserRole)) {
          setActiveTab("profile");
          setActiveView("hub");
          window.history.replaceState(null, '', '/settings');
          window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
          return;
        }
        setActiveTab(mapped);
        setActiveView("form");
        const title = SETTINGS_TAB_TITLES[mapped] || "Settings";
        window.dispatchEvent(new CustomEvent("update-title", { detail: title }));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUserRole]);

  // Sync dashboard top-bar title dynamically
  useEffect(() => {
    if (activeView === "hub") {
      window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
    } else {
      const title = SETTINGS_TAB_TITLES[activeTab] || "Settings";
      window.dispatchEvent(new CustomEvent("update-title", { detail: title }));
    }
  }, [activeTab, activeView]);

  const [tenantFormData, setTenantFormData] = useState({
    name: "My Business",
    industry: "",
    phone: "",
    email: "",
    website: "",
    address: "",
  });

  const handleTenantChange = (e) => {
    const { name, value } = e.target;
    setTenantFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Sync tenant form data when tenantInfo changes
  useEffect(() => {
    setTenantFormData({
      name: tenantInfo.name || "",
      industry: tenantInfo.industry || "",
      phone: tenantInfo.phone || "",
      email: tenantInfo.email || "",
      website: tenantInfo.website || "",
      address: tenantInfo.address || "",
    });
  }, [tenantInfo]);

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    requireAuth(async () => {
      setSaving(true);
      setSaveSuccess(false);

      const res = await updateTenantInfo({
        name: tenantFormData.name,
        industry: tenantFormData.industry || null,
        phone: tenantFormData.phone || null,
        email: tenantFormData.email || null,
        website: tenantFormData.website || null,
        address: tenantFormData.address || null,
        logo_url: tenantInfo.logo_url
      });

      if (res.success) {
        import("@/lib/tenant/clientTenantInfo").then(m => m.invalidateClientTenantInfo()).catch(() => {});
        setTenantInfo(prev => ({ ...prev, ...tenantFormData }));
        if (settingsMemoryCache) {
          settingsMemoryCache.tenantInfo = { ...settingsMemoryCache.tenantInfo, ...tenantFormData };
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(`Error: ${res.error}`);
      }
      setSaving(false);
    });
  };

  const [logoUploading, setLogoUploading] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const processLogoFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, GIF or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB.");
      return;
    }

    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        setTenantInfo(prev => ({ ...prev, logo_url: data.url }));
        if (settingsMemoryCache) {
          settingsMemoryCache.tenantInfo = { ...settingsMemoryCache.tenantInfo, logo_url: data.url };
        }
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processLogoFile(file);
    e.target.value = "";
  };

  const handleRemoveLogo = async () => {
    requireAuth(async () => {
      setLogoUploading(true);
      try {
        const res = await updateTenantInfo({
          name: tenantFormData.name,
          industry: tenantFormData.industry || null,
          phone: tenantFormData.phone || null,
          email: tenantFormData.email || null,
          website: tenantFormData.website || null,
          address: tenantFormData.address || null,
          logo_url: null,
        });
        if (res.success) {
          setTenantInfo(prev => ({ ...prev, logo_url: null }));
          if (settingsMemoryCache) {
            settingsMemoryCache.tenantInfo = { ...settingsMemoryCache.tenantInfo, logo_url: null };
          }
        } else {
          alert(`Error: ${res.error}`);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to remove logo.");
      } finally {
        setLogoUploading(false);
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("You must be signed in to save changes.");
      return;
    }

    requireAuth(async () => {
      setUserNameSaving(true);
      setUserNameSuccess(false);

      try {
        const parts = formData.name.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";

        // Update custom database via API

        const payload = {
          userId: user.id,
          // email updates via next-auth are read-only from Google,
          fullName: formData.name.trim(),
          phone: formData.phone || null,
          company: formData.company || null,
          website: formData.website || null,
          address: formData.address || null,
        };

        const res = await fetch("/api/users/save-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Update formData immediately from the returned profile — no refresh needed
          applyProfile(data.profile);
          setUserNameSuccess(true);
          setTimeout(() => setUserNameSuccess(false), 3000);
        } else {
          alert(`Failed to save: ${data.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("Save error:", err);
        alert("An unexpected error occurred while saving.");
      } finally {
        setUserNameSaving(false);
      }
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, or GIF image.");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `MdUpload Error: Invalid file type "${file.type}" for avatar` }),
      }).catch(() => { });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB.");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `MdUpload Error: Avatar file size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit` }),
      }).catch(() => { });
      return;
    }

    try {
      // await user?.setProfileImage({ file }); // Feature requires custom storage now
      alert("Photo updated successfully!");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `Updated admin profile photo: "${file.name}"` }),
      }).catch(() => { });
    } catch (err: any) {
      console.error("MdUpload error:", err);
      alert("MdUpload failed. Please try again.");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `MdUpload Error: Profile photo upload failed: ${err.message || String(err)}` }),
      }).catch(() => { });
    }
  };


  const tabs = [
    { id: "profile", name: "Security", icon: MdSecurity },
    ...(isSettingsSectionAllowed("billing", currentUserRole)
      ? [{ id: "billing", name: "Billing & Plans", icon: MdCreditCard }] : []),
    ...(isSettingsSectionAllowed("prefs", currentUserRole)
      ? [
        { id: "prefs", name: "Admin Preferences", icon: Sliders }
      ] : []),
  ];

  const handleRoleChange = async (memberId: number, newRole: string) => {
    requireAuth(async () => {
      const res = await updateTeamMemberRole(memberId, newRole);
      if (res.success) {
        fetchTeamData();
      } else {
        alert(res.error || "Failed to change role");
      }
    });
  };

  const handleRemoveMember = async (memberId: number, name: string) => {
    if (!await confirm(`Are you sure you want to remove ${name || 'this member'}?`)) return;
    requireAuth(async () => {
      const res = await removeTeamMember(memberId);
      if (res.success) {
        fetchTeamData();
      } else {
        alert(res.error || "Failed to remove member");
      }
    });
  };

  const handleLeaveTeam = async () => {
    if (!await confirm("Are you sure you want to leave this business? You will lose access to its data and be switched to a personal workspace.")) return;
    requireAuth(async () => {
      const res = await leaveTeam();
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Failed to leave team");
      }
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] space-y-4">
        <p className="text-gray-400">You must be signed in to access settings.</p>
        <Link
          href="/login"
          className="px-6 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-foreground rounded-3xl font-semibold hover:opacity-90 transition-opacity"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto pb-20 px-6">
      {activeView === "hub" && (
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Left Column (Profile Card) */}
          <div className="w-full lg:w-[340px] shrink-0 space-y-4">

            {/* Business Card */}
            <div className="bg-card rounded-[32px] p-8 flex flex-col items-center text-center shadow-lg">
              <div className="mb-4">
                <TenantLogo
                  logoUrl={tenantInfo.logo_url}
                  name={tenantInfo.name}
                  size={80}
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  fallbackClassName="w-20 h-20 rounded-full bg-card flex items-center justify-center border-2 border-border"
                  iconClassName="w-8 h-8 text-gray-500"
                />
              </div>
              <h2 className="text-[22px] font-black uppercase leading-tight tracking-wider mb-1">
                {tenantInfo.name}
              </h2>
              <p className="text-brand-500 text-sm font-semibold tracking-wide uppercase mb-4">Business Profile</p>

              <div className="bg-card border border-border px-4 py-1.5 rounded-full flex items-center justify-center gap-2">
                <span className="text-brand-500 font-bold text-xs">{tenantInfo.plan}</span>
              </div>
            </div>

            {/* Logged-in User Info */}
            <div className="bg-card rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-border">
                  <Image
                    src={user.image || "/logos/ft/logo.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    width={800} height={800} unoptimized={true}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = "/logos/ft/logo.png";
                      e.currentTarget.onerror = null;
                    }}
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-foreground truncate">{user.name || formData.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
                title="Sign Out"
              >
                <MdLogout className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Guide & Steps Shortcut */}
            <a
              href="/guide/business-profile"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card hover:bg-muted/60 border border-border/80 rounded-2xl p-4 flex items-center justify-between transition-colors group text-left block shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground group-hover:text-brand-500 transition-colors">
                    Settings Guide & Steps
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Step-by-step documentation for all settings
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-brand-500 transition-colors shrink-0" />
            </a>

            {/* Enterprise-grade encryption & security info */}
            <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed pt-2 flex flex-row items-center gap-3 text-left px-1">
              <div className="p-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 shrink-0">
                <MdLock className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-[11px] leading-relaxed">
                Your data stays secure with <span className="text-brand-500 font-medium">enterprise-grade encryption</span>. &copy; {new Date().getFullYear()}. <a href="https://frametoque.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors hover:underline">FrameToque Digital</a>. All rights reserved.
              </p>
            </div>

          </div>

          {/* Right Column (Navigation Menu) */}
          <div className="flex-1 space-y-10 lg:pl-6">

            {/* Section 2 */}
            <div>

              <div className="flex flex-col">
                {[
                  { name: "Business Profile", sub: "Update business name, contact & details.", icon: MdBusiness, id: "business", allowed: isSettingsSectionAllowed("business", currentUserRole) },
                  { name: "Invoice Layouts", sub: "Design, customize, and arrange custom invoice templates and fields.", icon: FileText, id: "invoice-layout", allowed: isSettingsSectionAllowed("invoice-layout", currentUserRole) },
                  { name: "Appearance", sub: "Customize dashboard accent colour, theme branding, and palettes.", icon: Palette, id: "appearance", allowed: isSettingsSectionAllowed("appearance", currentUserRole) },
                  { name: "Notifications", sub: "Configure browser push notifications, transaction reminders, and automated expense alerts.", icon: Bell, id: "notifications", allowed: true },
                  { name: "Security", sub: "Manage App Lock and authentication passkeys.", icon: MdSecurity, id: "profile", allowed: true },
                  { name: "Billing & Plans", sub: "Manage your subscription and payments.", icon: MdCreditCard, id: "billing", allowed: isSettingsSectionAllowed("billing", currentUserRole) },
                  { name: "Team & Permissions", sub: "Manage team members, invitations, and custom roles.", icon: MdGroup, id: "team", allowed: isSettingsSectionAllowed("team", currentUserRole) },
                  { name: "3rd Party Integrations", sub: "Two-way stock and order synchronization for online stores.", icon: Plug, id: "integrations", allowed: isSettingsSectionAllowed("integrations", currentUserRole) },
                  { name: "Admin Preferences", sub: "Configure default dashboard date range and display preferences.", icon: Sliders, id: "prefs", allowed: isSettingsSectionAllowed("prefs", currentUserRole) },
                  { name: "Audit Logs", sub: "View system and user activity.", icon: MdHistory, id: "audit_logs", allowed: isSettingsSectionAllowed("audit_logs", currentUserRole) },
                  { name: "Data Export", sub: "Export your workspace data to CSV.", icon: MdDownload, id: "export", allowed: isSettingsSectionAllowed("export", currentUserRole) },
                  { name: "Danger Zone", sub: "Destructive account and workspace actions.", icon: MdWarning, id: "danger", allowed: isSettingsSectionAllowed("danger", currentUserRole) }
                ]
                  .filter(item => item.allowed)
                  .map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const slug = SETTINGS_TAB_TO_SLUG[item.id] || item.id;
                        setActiveTab(item.id);
                        setActiveView("form");
                        window.history.pushState(null, '', `/settings/${slug}`);
                        const title = SETTINGS_TAB_TITLES[item.id] || "Settings";
                        window.dispatchEvent(new CustomEvent("update-title", { detail: title }));
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                      className="flex items-center justify-between py-4 group cursor-pointer text-left hover:bg-card px-2 -mx-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-5">
                        <div className="p-2.5 rounded-full border border-black/20 dark:border-white/20 text-gray-300 group-hover:border-white/40 transition-colors shrink-0 mt-1">
                          <item.icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[15px]">{item.name}</span>
                          <span className="text-sm text-gray-400 mt-0.5">{item.sub}</span>
                        </div>
                      </div>
                      <MdKeyboardArrowRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                    </button>
                  ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Data Export Tab */}
      {activeView === "form" && activeTab === "export" && isSettingsSectionAllowed("export", currentUserRole) && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-50">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("profile");
                setActiveView("hub");
                window.history.pushState(null, '', "/settings");
                window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-foreground font-semibold transition-colors cursor-pointer w-fit"
            >
              <MdKeyboardArrowLeft className="w-5 h-5" /> Settings
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {[
                { name: "Business", id: "business", icon: MdBusiness, allowed: isSettingsSectionAllowed("business", currentUserRole) },
                { name: "Invoice Layouts", id: "invoice-layout", icon: FileText, allowed: isSettingsSectionAllowed("invoice-layout", currentUserRole) },
                { name: "Appearance", id: "appearance", icon: Palette, allowed: isSettingsSectionAllowed("appearance", currentUserRole) },
                { name: "Notifications", id: "notifications", icon: Bell, allowed: true },
                { name: "Security", id: "profile", icon: MdSecurity, allowed: true },
                { name: "Billing", id: "billing", icon: MdCreditCard, allowed: isSettingsSectionAllowed("billing", currentUserRole) },
                { name: "Team & Permissions", id: "team", icon: MdGroup, allowed: isSettingsSectionAllowed("team", currentUserRole) },
                { name: "3rd Party Integrations", id: "integrations", icon: Plug, allowed: isSettingsSectionAllowed("integrations", currentUserRole) },
                { name: "Preferences", id: "prefs", icon: Sliders, allowed: isSettingsSectionAllowed("prefs", currentUserRole) },
                { name: "Audit Logs", id: "audit_logs", icon: MdHistory, allowed: isSettingsSectionAllowed("audit_logs", currentUserRole) },
                { name: "Export", id: "export", icon: MdDownload, allowed: isSettingsSectionAllowed("export", currentUserRole) },
                { name: "Danger Zone", id: "danger", icon: MdWarning, allowed: isSettingsSectionAllowed("danger", currentUserRole) }
              ]
                .filter(item => item.allowed)
                .map(item => {
                  const isCurrent = activeTab === item.id;
                  const slug = SETTINGS_TAB_TO_SLUG[item.id] || item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        window.history.pushState(null, '', `/settings/${slug}`);
                        const title = SETTINGS_TAB_TITLES[item.id] || "Settings";
                        window.dispatchEvent(new CustomEvent("update-title", { detail: title }));
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isCurrent
                          ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
                        }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="bg-transparent border border-border rounded-3xl p-7">
            <p className="text-gray-400 text-sm mb-6">Export your workspace data into CSV format for your own records or to share with your accountant.</p>

            {tenantInfo.plan === "Free" ? (
              <UpgradeOverlay
                title="Data Export"
                description="Exporting your financial data to CSV is only available on Pro and Pro Plus plans."
                requiredPlan="Pro"
              >
                <div className="h-[200px]" />
              </UpgradeOverlay>
            ) : (
              <div className="space-y-8">
                {/* Export All Section */}
                <div className="bg-card/50 rounded-2xl p-6 border border-brand-500/20 shadow-[0_0_20px_rgba(0,227,91,0.05)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <MdDownload className="w-5 h-5 text-brand-500" /> Bulk Export
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">Download all your lists sequentially to backup your workspace.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const items: ("invoices" | "incomes" | "expenses" | "clients")[] = ["invoices", "incomes", "expenses", "clients"];
                        for (const item of items) {
                          const res = await exportData(item);
                          if (res.success && res.csv) {
                            const blob = new Blob([res.csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `framebooks_${item}_${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          }
                          await new Promise(r => setTimeout(r, 800)); // stagger downloads
                        }
                      }}
                      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-brand-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(0,227,91,0.2)]"
                    >
                      Export All Data
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: "invoices", label: "Invoices" },
                      { id: "incomes", label: "Incomes" },
                      { id: "expenses", label: "Expenses" },
                      { id: "clients", label: "Clients" }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={async () => {
                          const res = await exportData(item.id as any);
                          if (res.success && res.csv) {
                            const blob = new Blob([res.csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `framebooks_${item.id}_${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          } else {
                            alert(res.error || "Failed to export data");
                          }
                        }}
                        className="flex items-center justify-between p-3 border border-border rounded-xl bg-background hover:border-brand-500 transition-colors group"
                      >
                        <span className="font-medium text-sm text-foreground">{item.label}</span>
                        <MdDownload className="w-4 h-4 text-gray-500 group-hover:text-brand-500" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Reports Section */}
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                    <MdShowChart className="w-5 h-5 text-gray-400" /> Financial Reports
                  </h3>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                    <div className="w-full md:w-auto">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Select Report</label>
                      <select
                        value={reportType}
                        onChange={(e: any) => setReportType(e.target.value)}
                        className="w-full md:w-[250px] bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:border-brand-500 outline-none transition-colors cursor-pointer"
                      >
                        <option value="" disabled>Select a report...</option>
                        <option value="profit_loss">Profit & Loss</option>
                        <option value="cash_flow">Cash Flow Statement</option>
                        <option value="balance_sheet">Balance Sheet</option>
                      </select>
                    </div>

                    {reportType && (
                      <div className="w-full md:w-auto animate-in fade-in duration-300">
                        <label className="block text-sm font-medium text-gray-400 mb-1">Date Range</label>
                        <DateRangeSelector
                          dateRange={reportDateRange}
                          startDate={reportStartDate}
                          endDate={reportEndDate}
                          onRangeChange={setReportDateRange}
                          onStartDateChange={setReportStartDate}
                          onEndDateChange={setReportEndDate}
                        />
                      </div>
                    )}
                  </div>

                  {reportType && (
                    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <button
                        onClick={async () => {
                          const res = await exportReport(reportType as any, reportStartDate, reportEndDate);
                          if (res.success && res.csv) {
                            const blob = new Blob([res.csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `framebooks_${reportType}_${reportStartDate}_to_${reportEndDate}.csv`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          } else {
                            alert(res.error || "Failed to export report");
                          }
                        }}
                        className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl transition-all font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(0,227,91,0.2)]"
                      >
                        <MdDownload className="w-5 h-5" /> Export Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Views */}
      {activeView === "form" && activeTab !== "export" && (
        <div className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <button
              onClick={() => {
                setActiveView("hub");
                window.history.pushState(null, '', "/settings");
                window.dispatchEvent(new CustomEvent("update-title", { detail: "Settings" }));
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-foreground font-semibold transition-colors cursor-pointer w-fit"
            >
              <MdKeyboardArrowLeft className="w-5 h-5" /> Settings
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {[
                { name: "Business", id: "business", icon: MdBusiness, allowed: isSettingsSectionAllowed("business", currentUserRole) },
                { name: "Invoice Layouts", id: "invoice-layout", icon: FileText, allowed: isSettingsSectionAllowed("invoice-layout", currentUserRole) },
                { name: "Appearance", id: "appearance", icon: Palette, allowed: isSettingsSectionAllowed("appearance", currentUserRole) },
                { name: "Notifications", id: "notifications", icon: Bell, allowed: true },
                { name: "Security", id: "profile", icon: MdSecurity, allowed: true },
                { name: "Billing", id: "billing", icon: MdCreditCard, allowed: isSettingsSectionAllowed("billing", currentUserRole) },
                { name: "Team & Permissions", id: "team", icon: MdGroup, allowed: isSettingsSectionAllowed("team", currentUserRole) },
                { name: "3rd Party Integrations", id: "integrations", icon: Plug, allowed: isSettingsSectionAllowed("integrations", currentUserRole) },
                { name: "Preferences", id: "prefs", icon: Sliders, allowed: isSettingsSectionAllowed("prefs", currentUserRole) },
                { name: "Audit Logs", id: "audit_logs", icon: MdHistory, allowed: isSettingsSectionAllowed("audit_logs", currentUserRole) },
                { name: "Export", id: "export", icon: MdDownload, allowed: isSettingsSectionAllowed("export", currentUserRole) },
                { name: "Danger Zone", id: "danger", icon: MdWarning, allowed: isSettingsSectionAllowed("danger", currentUserRole) }
              ]
                .filter(item => item.allowed)
                .map(item => {
                  const isCurrent = activeTab === item.id;
                  const slug = SETTINGS_TAB_TO_SLUG[item.id] || item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        window.history.pushState(null, '', `/settings/${slug}`);
                        const title = SETTINGS_TAB_TITLES[item.id] || "Settings";
                        window.dispatchEvent(new CustomEvent("update-title", { detail: title }));
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isCurrent
                          ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
                        }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="bg-transparent">

            {activeTab === "business" && (
              <div className="space-y-6">
                {!isSettingsSectionAllowed("business", currentUserRole) ? (
                  <div className="p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                    You do not have permission to view or edit the business profile.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Business Profile & Logo */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                    {/* Logo Upload Card */}
                    <div className="p-6 rounded-2xl border border-border bg-card/40 backdrop-blur-sm">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        {/* Logo Preview */}
                        <div className="relative shrink-0">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border/80 bg-muted/40 shadow-sm flex items-center justify-center">
                            {logoUploading ? (
                              <Loader />
                            ) : (
                              <TenantLogo
                                logoUrl={tenantInfo.logo_url}
                                name={tenantInfo.name}
                                size={96}
                                className="w-full h-full object-cover"
                                fallbackClassName="w-full h-full bg-card flex items-center justify-center font-bold text-xl text-foreground"
                                iconClassName="w-8 h-8 text-muted-foreground"
                              />
                            )}
                          </div>
                        </div>

                        {/* Logo Details & Compact Uploader */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-foreground">Company Logo</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Your logo will appear on all client invoices, receipts, and quotations.
                              </p>
                            </div>
                            {tenantInfo.logo_url && currentUserRole !== 'Viewer' && (
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                disabled={logoUploading}
                                className="self-start sm:self-auto text-xs text-rose-500 hover:text-rose-400 font-semibold transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Remove Logo</span>
                              </button>
                            )}
                          </div>

                          <label
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (currentUserRole !== 'Viewer') setIsDraggingLogo(true);
                            }}
                            onDragLeave={() => setIsDraggingLogo(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDraggingLogo(false);
                              if (currentUserRole !== 'Viewer') {
                                const file = e.dataTransfer.files?.[0];
                                if (file) processLogoFile(file);
                              }
                            }}
                            className={`flex items-center justify-center gap-2.5 w-full py-3.5 px-4 transition-all border-2 border-dashed rounded-xl ${isDraggingLogo
                                ? "border-brand-500 bg-brand-500/10"
                                : "border-border hover:border-brand-500/70 hover:bg-muted/30"
                              } ${currentUserRole === 'Viewer' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <Upload className="w-4 h-4 text-brand-500 shrink-0" />
                            <span className="text-xs">
                              <span className="font-semibold text-foreground">
                                {logoUploading ? "Uploading logo..." : currentUserRole === 'Viewer' ? "Read Only" : "Click to browse logo"}
                              </span>
                              <span className="text-muted-foreground hidden sm:inline"> or drag & drop file here</span>
                            </span>
                            <input
                              type="file"
                              name="file_upload"
                              className="hidden"
                              accept="image/png, image/jpeg, image/gif, image/webp"
                              disabled={logoUploading || currentUserRole === 'Viewer'}
                              onChange={handleLogoUpload}
                            />
                          </label>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Supported: JPG, PNG, GIF, WebP</span>
                            <span>Max size: 2MB</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Business Details Form Card */}
                    <form onSubmit={handleSaveTenant} className="p-6 sm:p-8 rounded-2xl border border-border bg-card/40 backdrop-blur-sm space-y-6">
                      <div className="border-b border-border/60 pb-3">
                        <h4 className="text-sm font-bold text-foreground">Business Information</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          General company details shown on your invoices and client communications.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Business Name */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Business Name *</label>
                          <div className="relative">
                            <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              name="name"
                              value={tenantFormData.name}
                              onChange={handleTenantChange}
                              disabled={currentUserRole === 'Viewer'}
                              placeholder="e.g. FrameToque Digital"
                              className="w-full pl-10 pr-4 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none disabled:opacity-50"
                              required
                            />
                          </div>
                        </div>

                        {/* Industry */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Industry / Sector</label>
                          <div className="relative">
                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              name="industry"
                              placeholder="e.g. Retail, Tech, Manufacturing"
                              value={tenantFormData.industry}
                              onChange={handleTenantChange}
                              disabled={currentUserRole === 'Viewer'}
                              className="w-full pl-10 pr-4 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Business Email */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Business Email</label>
                          <div className="relative">
                            <MdMailOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="email"
                              name="email"
                              placeholder="contact@business.com"
                              value={tenantFormData.email}
                              onChange={handleTenantChange}
                              disabled={currentUserRole === 'Viewer'}
                              className="w-full pl-10 pr-4 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Phone Number</label>
                          <div className="relative">
                            <MdPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                              type="tel"
                              name="phone"
                              placeholder="+94 77 000 0000"
                              value={tenantFormData.phone}
                              onChange={handleTenantChange}
                              disabled={currentUserRole === 'Viewer'}
                              className="w-full pl-10 pr-4 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Website */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Website</label>
                          <div className="relative flex rounded-xl border border-border bg-card/60 hover:bg-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all overflow-hidden">
                            <span className="flex items-center px-3.5 bg-muted/40 border-r border-border text-xs font-medium text-muted-foreground select-none">
                              https://
                            </span>
                            <input
                              type="text"
                              name="website"
                              placeholder="yourwebsite.com"
                              value={tenantFormData.website.replace(/^https?:\/\//, '')}
                              disabled={currentUserRole === 'Viewer'}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTenantFormData(prev => ({ ...prev, website: v.startsWith('http') ? v : v ? `https://${v}` : '' }));
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent text-foreground text-sm outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Business Address */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Business Address</label>
                          <textarea
                            name="address"
                            placeholder="123 Business Street, City, Country"
                            value={tenantFormData.address}
                            disabled={currentUserRole === 'Viewer'}
                            onChange={handleTenantChange}
                            rows={3}
                            className="w-full px-3.5 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none resize-y disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Info className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          <span>Shown on invoices and client-facing documents.</span>
                        </div>
                        {currentUserRole !== 'Viewer' && (
                          <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl transition-all shadow-md active:scale-98 cursor-pointer text-xs disabled:opacity-50"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <MdCheck className="w-4 h-4" />
                                <span>Save Changes</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {saveSuccess && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2 mt-4 animate-in fade-in">
                          <MdCheck className="w-4 h-4" />
                          <span>Business profile updated successfully.</span>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Right Column: User Profile Details */}
                  <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                    <div className="p-6 sm:p-7 rounded-2xl border border-border bg-card/40 backdrop-blur-sm space-y-6">
                      <div className="border-b border-border/60 pb-3">
                        <h4 className="text-sm font-bold text-foreground">User Profile</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Your personal account identity and display name.
                        </p>
                      </div>

                      {/* Photo and Identity */}
                      <div className="flex flex-col items-center text-center gap-4">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border/80 bg-muted/40 shadow-sm shrink-0">
                          <Image
                            src={user?.image || "/logos/ft/logo.png"}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            width={800} height={800} unoptimized={true}
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.src = "/logos/ft/logo.png"; e.currentTarget.onerror = null; }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-foreground truncate">{user?.name || "No name provided"}</h3>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email || "No email provided"}</p>
                        </div>
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-border rounded-xl hover:bg-white/20 transition-colors cursor-pointer text-xs font-semibold text-foreground">
                          <MdUpload className="w-4 h-4 text-brand-500" />
                          <span>Change Photo</span>
                          <input type="file" accept="image/jpeg,image/png,image/gif" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                      </div>

                      {/* Display Name form */}
                      <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-border/60">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground">Display Name</label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3.5 py-2.5 bg-card/60 hover:bg-card border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-foreground text-sm transition-all outline-none"
                            placeholder="Your full name"
                            required
                          />
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={userNameSaving || userNameSuccess}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl transition-all shadow-md active:scale-98 cursor-pointer text-xs disabled:opacity-50"
                          >
                            {userNameSuccess ? (
                              <>
                                <MdCheck className="w-4 h-4" />
                                <span>Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span>{userNameSaving ? "Saving..." : "Save Name"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

            {activeTab === "invoice-layout" && isSettingsSectionAllowed("invoice-layout", currentUserRole) && (
              <div className="space-y-4">
                {/* Pro Plus Upgrade Banner for Free and Pro Users */}
                {tenantInfo.plan !== 'Pro Plus' && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-blue-500/10 border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center shrink-0">
                        <MdLock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>Exclusive Pro Plus Features</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO PLUS</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You are viewing invoice layouts in preview mode. Upgrade to Pro Plus to customize and save invoice templates and fields.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('upgrade-modal:open', {
                          detail: "Upgrade to Pro Plus to unlock custom invoice templates and layout builder."
                        }));
                      }}
                      className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs shrink-0 transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Upgrade to Pro Plus</span>
                    </button>
                  </div>
                )}

                <InvoiceLayoutTab
                  canManage={currentUserRole === 'owner' || currentUserRole === 'Super Admin' || currentUserRole === 'Admin'}
                  isProPlus={tenantInfo.plan === 'Pro Plus'}
                />
              </div>
            )}

            {activeTab === "appearance" && isSettingsSectionAllowed("appearance", currentUserRole) && (
              <div className="space-y-4">
                {/* Pro Upgrade Banner for Free Users */}
                {tenantInfo.plan === 'Free' && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-blue-500/10 border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center shrink-0">
                        <MdLock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>Exclusive Pro Features</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-brand-500/20 text-brand-400 border border-brand-500/30">PRO</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You are viewing theme branding in preview mode. Upgrade to Pro to customize and save workspace accent colors and palettes.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('upgrade-modal:open', {
                          detail: "Upgrade to Pro to unlock custom workspace accent colors and themes."
                        }));
                      }}
                      className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs shrink-0 transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Upgrade to Pro</span>
                    </button>
                  </div>
                )}

                <AppearanceTab
                  initialAccent={tenantInfo?.accent_color || null}
                  canManage={currentUserRole === 'owner' || currentUserRole === 'Super Admin' || currentUserRole === 'Admin'}
                  isProPlus={tenantInfo.plan === 'Pro' || tenantInfo.plan === 'Pro Plus'}
                  onAccentSaved={(hex) => {
                    setTenantInfo(prev => ({ ...prev, accent_color: hex }));
                    if (settingsMemoryCache) {
                      settingsMemoryCache.tenantInfo = { ...settingsMemoryCache.tenantInfo, accent_color: hex };
                    }
                  }}
                />
              </div>
            )}

            {activeTab === "team" && isSettingsSectionAllowed("team", currentUserRole) && (
              <div className="space-y-4">
                {tenantInfo.plan !== 'Pro Plus' ? (
                  <UpgradeOverlay
                    title="Team & Permissions"
                    description="Invite team members and configure custom roles. Upgrade to Pro Plus to unlock this feature."
                    requiredPlan="Pro Plus"
                  >
                    <div />
                  </UpgradeOverlay>
                ) : (
                  <div>
                    {/* Sub-tabs header for Team & Permissions */}
                    <div className="flex items-center gap-2 border-b border-border pb-3 mb-6">
                      <button
                        type="button"
                        onClick={() => setTeamSubTab("members")}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${teamSubTab === "members"
                            ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                            : "bg-card text-muted-foreground hover:text-foreground border border-border"
                          }`}
                      >
                        Team Members ({teamMembers.length})
                      </button>
                      {(currentUserRole === 'owner' || currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
                        <button
                          type="button"
                          onClick={() => setTeamSubTab("roles")}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${teamSubTab === "roles"
                              ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                              : "bg-card text-muted-foreground hover:text-foreground border border-border"
                            }`}
                        >
                          Roles & Permissions
                        </button>
                      )}
                    </div>

                    {teamSubTab === "roles" ? (
                      <RolesConfigurator currentUserRole={currentUserRole} />
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Active Team Members</h3>
                            <p className="text-sm text-gray-400 mt-1">Manage current members and roles.</p>
                          </div>
                          <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-full transition-colors cursor-pointer text-sm"
                          >
                            <MdGroup className="w-4 h-4" />
                            Add Member
                          </button>
                        </div>

                        {isInviteModalOpen && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ margin: 0 }}>
                            <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                              <button
                                onClick={() => { setIsInviteModalOpen(false); setInviteMessage(null); }}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-foreground rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                ✕
                              </button>

                              <div className="text-center mb-8">
                                <MdGroup className="w-12 h-12 text-brand-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-foreground mb-2">Invite to Team</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Invite team members to collaborate and manage access to your business profile.</p>
                              </div>

                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (!inviteEmail) return;
                                  setIsInviting(true);
                                  setInviteMessage(null);
                                  try {
                                    const res = await fetch('/api/team/invite', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                      setInviteMessage({ type: 'success', text: data.message });
                                      setInviteEmail("");
                                      setInviteRole("Viewer");
                                      fetchTeamData();
                                      setTimeout(() => setIsInviteModalOpen(false), 2000);
                                    } else {
                                      setInviteMessage({ type: 'error', text: data.error || 'Failed to invite user.' });
                                    }
                                  } catch (err) {
                                    setInviteMessage({ type: 'error', text: 'An unexpected error occurred.' });
                                  } finally {
                                    setIsInviting(false);
                                  }
                                }}
                                className="space-y-4"
                              >
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                                  <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="teammember@domain.com"
                                    className="w-full bg-card border border-border hover:border-black/20 dark:border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-sm text-foreground mb-4 shadow-2xs placeholder:text-gray-500 dark:placeholder:text-gray-400"
                                    required
                                  />
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                                  <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full bg-card border border-border hover:border-black/20 dark:border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-sm text-foreground appearance-none cursor-pointer shadow-2xs"
                                  >
                                    {availableRoles.length > 0 ? availableRoles.filter(r => r.role.toLowerCase() !== 'owner').map((r) => (
                                      <option key={r.role} value={r.role} className="bg-card text-foreground">{r.role}</option>
                                    )) : (
                                      <>
                                        <option value="Admin" className="bg-card text-foreground">Admin</option>
                                        <option value="Editor" className="bg-card text-foreground">Editor</option>
                                        <option value="Viewer" className="bg-card text-foreground">Viewer</option>
                                      </>
                                    )}
                                  </select>
                                </div>

                                {inviteMessage && (
                                  <div className={`p-4 rounded-2xl text-sm font-medium ${inviteMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {inviteMessage.text}
                                  </div>
                                )}

                                <button
                                  type="submit"
                                  disabled={isInviting || !inviteEmail}
                                  className="w-full px-6 py-3 mt-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-900 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  {isInviting ? <Loader size="sm" /> : "Send Invitation"}
                                </button>
                              </form>
                            </div>
                          </div>
                        )}

                        {teamMembers.length > 0 && (
                          <div className="bg-card border border-border rounded-3xl p-8 shadow-xs">
                            <div className="space-y-3">
                              {teamMembers.map(member => (
                                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-border gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <ClientAvatar
                                      imageUrl={member.avatar_url}
                                      email={member.email}
                                      name={member.full_name}
                                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border"
                                      fallbackClassName="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center uppercase shrink-0 text-sm"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground flex items-center gap-2">
                                        {member.full_name || 'Unnamed User'}
                                        {(String(member.id) === String(user?.id) || String(member.id) === String((user as any)?.dbId)) && <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 dark:bg-brand-500/10 dark:text-brand-400 text-[10px] uppercase font-bold rounded-full dark:border-brand-500/20">You</span>}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{member.email}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {(currentUserRole === 'owner' || currentUserRole === 'Super Admin') && member.role !== 'owner' && member.role !== 'Super Admin' ? (
                                      <select
                                        value={member.role}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer shadow-2xs"
                                      >
                                        {availableRoles.length > 0 ? (
                                          availableRoles.filter(r => r.role.toLowerCase() !== 'owner').map((r) => (
                                            <option key={r.role} value={r.role} className="bg-card text-foreground">{r.role}</option>
                                          ))
                                        ) : (
                                          <>
                                            <option value="Admin" className="bg-card text-foreground">Admin</option>
                                            <option value="Editor" className="bg-card text-foreground">Editor</option>
                                            <option value="Viewer" className="bg-card text-foreground">Viewer</option>
                                          </>
                                        )}
                                      </select>
                                    ) : (
                                      <span className="px-3 py-1.5 text-xs font-bold uppercase rounded-full bg-slate-100 text-slate-800 border border-slate-200/80 dark:bg-card dark:text-gray-300 dark:border-border">
                                        {member.role}
                                      </span>
                                    )}

                                    {Boolean(tenantInfo?.has_pos_addon) && (
                                      <button
                                        type="button"
                                        onClick={() => setManagingPosCodeMember(member)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
                                        title="Manage POS Manager Access Code and QR Badge"
                                      >
                                        <QrCode className="w-3.5 h-3.5 text-brand-500" />
                                        <span className="hidden sm:inline">POS Code & QR</span>
                                      </button>
                                    )}

                                    {(currentUserRole === 'owner' || currentUserRole === 'Super Admin') && member.role !== 'owner' && member.role !== 'Super Admin' && (
                                      <button
                                        onClick={() => handleRemoveMember(member.id, member.full_name)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 rounded-xl text-sm font-medium transition-colors border border-rose-200/60 dark:border-red-500/20"
                                      >
                                        Remove
                                      </button>
                                    )}

                                    {(String(member.id) === String(user?.id) || String(member.id) === String((user as any)?.dbId)) && member.role !== 'owner' && member.role !== 'Super Admin' && (
                                      <button
                                        onClick={handleLeaveTeam}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 rounded-xl text-sm font-medium transition-colors border border-rose-200/60 dark:border-red-500/20"
                                      >
                                        Leave Team
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* POS Manager Access Code & QR Badge Modal */}
                        <TeamPosCodeModal
                          isOpen={Boolean(managingPosCodeMember)}
                          onClose={() => setManagingPosCodeMember(null)}
                          member={managingPosCodeMember}
                          tenantName={tenantInfo?.name || "Framebooks POS"}
                          onUpdated={(memberId, newCode) => {
                            setTeamMembers((prev) =>
                              prev.map((m) => (m.id === memberId ? { ...m, pos_manager_code: newCode } : m))
                            );
                            if (managingPosCodeMember?.id === memberId) {
                              setManagingPosCodeMember((prev: any) => ({ ...prev, pos_manager_code: newCode }));
                            }
                          }}
                        />

                        {sentInvitations.length > 0 && (
                          <div className="mt-8 bg-card border border-border rounded-3xl p-8 shadow-xs">
                            <h3 className="text-lg font-semibold text-foreground mb-6">Sent Invitations</h3>
                            <div className="space-y-3">
                              {sentInvitations.map(inv => (
                                <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-border">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <ClientAvatar
                                      imageUrl={inv.avatar_url}
                                      email={inv.email}
                                      name={inv.full_name}
                                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border"
                                      fallbackClassName="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center uppercase shrink-0 text-sm"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground truncate">{inv.email}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sent on {new Date(inv.created_at).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full ${inv.status === 'pending' ? 'bg-amber-100/80 text-amber-800 border border-amber-300/60 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20' :
                                        inv.status === 'accepted' ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300/60 dark:bg-green-400/10 dark:text-green-400 dark:border-green-400/20' :
                                          'bg-rose-100/80 text-rose-800 border border-rose-300/60 dark:bg-red-400/10 dark:text-red-400 dark:border-red-400/20'
                                      }`}>
                                      {inv.status}
                                    </span>
                                    {inv.status === 'pending' && currentUserRole === 'owner' && (
                                      <button
                                        onClick={() => handleDeleteInvitation(inv.id, inv.email)}
                                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-md transition-colors"
                                        title="Cancel Invitation"
                                      >
                                        <MdDelete className="w-5 h-5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "profile" && (
              <div className="max-w-4xl space-y-6">
                {/* App Lock */}
                {(() => {
                  const hasCurrentDevicePasskey = customPasskeys.some((pk: any) => pk.is_current_device);
                  return (
                    <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card/40 backdrop-blur-sm space-y-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-border/60 gap-4">
                        <div className="flex-1 pr-4">
                          <h3 className="text-base font-bold text-foreground">App Lock</h3>
                          <p className="text-xs text-muted-foreground mt-1">Secure your dashboard with your device using a fingerprint, face scan, or screen lock.</p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const { startRegistration } = await import('@simplewebauthn/browser');
                              const resp = await fetch('/api/auth/passkey/register/generate');
                              const options = await resp.json();
                              if (options.error) throw new Error(options.error);

                              const attResp = await startRegistration(options);

                              const verifyResp = await fetch('/api/auth/passkey/register/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(attResp),
                              });

                              const verification = await verifyResp.json();
                              if (verification.verified) {
                                alert("App Lock successfully enabled!");
                                const refresh = await fetch('/api/auth/passkey/list');
                                const pkData = await refresh.json();
                                setCustomPasskeys(pkData.passkeys || []);
                                // reload page to apply lock provider immediately
                                window.location.reload();
                              } else {
                                alert(verification.error || "Failed to verify passkey.");
                              }
                            } catch (e: any) {
                              console.error("Passkey error:", e);
                              alert("Failed to add App Lock: " + e.message);
                            }
                          }}
                          className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-xl font-bold transition-all shadow-md active:scale-98 text-xs whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {customPasskeys.length > 0 ? "Add Another Passkey" : "Enable App Lock with Passkey"}
                        </button>
                      </div>

                      {customPasskeys.length > 0 && (
                        <div className="relative z-30">
                          <label className="block text-xs font-semibold text-foreground mb-1.5">Auto-Lock Duration</label>
                          <AutoLockDurationSelect
                            value={autoLockDuration}
                            onChange={setAutoLockDuration}
                          />
                        </div>
                      )}

                      {customPasskeys.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">High Security Mode</label>
                          <div className="flex items-center justify-between p-4 bg-card/60 border border-border rounded-xl">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Require passkey for all actions</p>
                              <p className="text-xs text-muted-foreground">If disabled, passkey is only required for major actions like workspace deletion.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={highSecurityMode} onChange={(e) => setHighSecurityMode(e.target.checked)} />
                              <div className="w-11 h-6 bg-slate-200 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                            </label>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 pt-2">
                        {!hasCurrentDevicePasskey && customPasskeys.length > 0 && !customPasskeys.some((pk: any) => pk.device_type === 'multiDevice') && (
                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p className="text-amber-500 dark:text-amber-400 font-semibold text-xs">App Lock is not enabled on this device.</p>
                          </div>
                        )}
                        {customPasskeys.length === 0 ? (
                          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/80 bg-muted/20">
                            <MdSecurity className="w-10 h-10 text-muted-foreground/60 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-foreground">App Lock is currently disabled</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                              Add a passkey using your device biometrics (Touch ID, Face ID, or Windows Hello) to protect your financial data.
                            </p>
                          </div>
                        ) : (
                          customPasskeys.map((pk: any) => (
                            <div key={pk.id} className="flex items-center justify-between p-4 bg-card/60 rounded-xl border border-border">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-brand-500/10 rounded-2xl flex items-center justify-center">
                                  <MdCheck className="w-5 h-5 text-brand-400" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">{pk.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs text-muted-foreground">Added on {new Date(pk.created_at).toLocaleDateString()}</p>
                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                    <p className="text-xs text-muted-foreground">
                                      {pk.device_type === 'singleDevice' ? 'Single Device Key' : 'Multi-Device Passkey'}
                                      {pk.backed_up ? ' • Backed up' : ''}
                                      {pk.is_current_device ? ' • Ready on this Device' : ''}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Delete passkey "${pk.name}"?`)) return;
                                  try {
                                    const res = await fetch('/api/auth/passkey/remove', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: pk.id })
                                    });
                                    if (res.ok) {
                                      setCustomPasskeys((prev: any[]) => prev.filter((p: any) => p.id !== pk.id));
                                    } else {
                                      alert("Failed to delete passkey.");
                                    }
                                  } catch (e) {
                                    alert("Error deleting passkey.");
                                  }
                                }}
                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/10 cursor-pointer"
                                title="Delete this passkey"
                              >
                                <MdDelete className="w-5 h-5" />
                              </button>
                            </div>
                          ))
                        )}
                        {customPasskeys.length > 0 && (
                          <div className="pt-4 mt-2 border-t border-border flex justify-end">
                            <button
                              onClick={() => {
                                requireAuth(async () => {
                                  if (!confirm("Are you sure you want to remove App Lock? This will remove all registered devices.")) return;
                                  try {
                                    const res = await fetch('/api/auth/passkey/remove', { method: 'POST' });
                                    if (res.ok) {
                                      alert("App Lock removed successfully.");
                                      window.location.reload();
                                    } else {
                                      alert("Failed to remove App Lock.");
                                    }
                                  } catch (e) {
                                    alert("An error occurred while removing App Lock.");
                                  }
                                }, true);
                              }}
                              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-medium transition-colors text-xs cursor-pointer"
                            >
                              Remove App Lock
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "notifications" && (
              <NotificationsTab />
            )}

            {activeTab === "audit_logs" && isSettingsSectionAllowed("audit_logs", currentUserRole) && (
              <AuditLogsTab />
            )}

            {activeTab === "danger" && isSettingsSectionAllowed("danger", currentUserRole) && (
              <DangerZoneView currentUserRole={currentUserRole} teamMembers={teamMembers} />
            )}

            {activeTab === "billing" && isSettingsSectionAllowed("billing", currentUserRole) && (
              <BillingView tenantInfo={tenantInfo} plansList={plansList} />
            )}

            {activeTab === "prefs" && isSettingsSectionAllowed("prefs", currentUserRole) && (
              <AdminPreferencesView />
            )}

            {activeTab === "integrations" && isSettingsSectionAllowed("integrations", currentUserRole) && (
              <IntegrationsTab />
            )}

            {currentUserRole && !isSettingsSectionAllowed(activeTab, currentUserRole) && (
              <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-lg mx-auto my-12 animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
                  <MdWarning className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Access Restricted</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Your workspace role ({currentUserRole}) does not have permission to view or manage this section.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("profile");
                    setActiveView("hub");
                    if (typeof window !== "undefined") {
                      window.history.replaceState(null, '', '/settings');
                    }
                  }}
                  className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-brand-950 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Return to Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BillingView({
  tenantInfo,
  plansList
}: {
  tenantInfo: { plan: string, name: string, logo_url: string | null, industry: string | null };
  plansList?: PlanViewItem[];
}) {
  const activePlans = plansList && plansList.length > 0 ? plansList : defaultPlans;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(tenantInfo.plan && tenantInfo.plan !== "Free" ? tenantInfo.plan : "Pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [subDetails, setSubDetails] = useState<any>(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [savingBillingSettings, setSavingBillingSettings] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // Switch Billing Interval Modal
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [switchTargetInterval, setSwitchTargetInterval] = useState<"monthly" | "yearly">("yearly");
  const [switchingCycle, setSwitchingCycle] = useState(false);

  // Renewal Notice Modal before redirecting to Payments.lk checkout
  const [renewalNoticeModalOpen, setRenewalNoticeModalOpen] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: number;
    code: string;
    type: "percent" | "fixed";
    value: number;
    discountText: string;
    isComplimentary: boolean;
    applicablePlans?: string[] | null;
  } | null>(null);

  // Billing address & email details
  const [posAddonStatus, setPosAddonStatus] = useState<any>(null);
  const [enablingPosAddon, setEnablingPosAddon] = useState(false);

  const [billingSettings, setBillingSettings] = useState<{
    billingEmail: string;
    billingName: string;
    billingAddress: string;
    billingCity: string;
    billingPostalCode: string;
    billingCountry: string;
  }>({
    billingEmail: "",
    billingName: tenantInfo.name || "",
    billingAddress: "",
    billingCity: "",
    billingPostalCode: "",
    billingCountry: "Sri Lanka",
  });

  useEffect(() => {
    import("../actions/billing").then(m => m.getGatewayStatusAction()).then(res => {
      if (res?.success) {
        setGatewayStatus(res.status);
      }
    }).catch(() => { });
  }, []);

  const fetchHistoryAndUsage = async () => {
    try {
      setLoading(true);
      const [histRes, subRes, billRes, posAddonRes] = await Promise.all([
        import("../actions/billing").then(m => m.getSubscriptionHistory()),
        import("../actions/billing").then(m => m.getActiveSubscriptionDetails()),
        import("../actions/billing").then(m => m.getBillingSettingsAction()),
        import("../actions/billing").then(m => m.getTenantPosAddonAction()),
      ]);

      if (posAddonRes?.success && posAddonRes.status) {
        setPosAddonStatus(posAddonRes.status);
      }

      if (histRes.success) {
        setHistory(histRes.history || []);
      }
      if (subRes?.success) {
        setSubDetails(subRes.subscription || null);
        if (subRes.subscription?.activeCoupon) {
          setAppliedCoupon(subRes.subscription.activeCoupon);
        } else if ((subRes as any).activeCoupon) {
          setAppliedCoupon((subRes as any).activeCoupon);
        } else {
          setAppliedCoupon(null);
        }
      }
      if (billRes?.success && billRes.data) {
        setBillingSettings(billRes.data);
      }

      if (tenantInfo.plan === "Free") {
        const { getTenantUsage } = await import("../actions/tenants");
        const usageData = await getTenantUsage();
        setUsage(usageData);
      }
    } catch (e) {
      console.error("Failed to load history or usage", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndUsage();
  }, [tenantInfo.plan]);

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period, after which your workspace will revert to Free.")) {
      return;
    }
    setCancelingSubscription(true);
    setStatusMessage(null);
    try {
      const { cancelSubscriptionAction } = await import("../actions/billing");
      const res = await cancelSubscriptionAction();
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: res.message || "Your subscription has been canceled.",
        });
        await fetchHistoryAndUsage();
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to cancel subscription.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "An unexpected error occurred while canceling.",
      });
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleSaveBillingDetails = async () => {
    setSavingBillingSettings(true);
    try {
      const { updateBillingDetailsAction } = await import("../actions/billing");
      const res = await updateBillingDetailsAction(billingSettings);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: "Billing details saved successfully.",
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to save billing details.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to save billing details.",
      });
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const handleEnablePosAddon = async () => {
    setEnablingPosAddon(true);
    try {
      const { enablePosAddonAction } = await import("../actions/billing");
      const res = await enablePosAddonAction();
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: "Point of Sale (POS) add-on activated successfully! You can now access POS from the top bar.",
        });
        setPosAddonStatus((prev: any) => ({ ...prev, hasAddon: true, status: "active" }));
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to activate POS add-on.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to activate POS add-on.",
      });
    } finally {
      setEnablingPosAddon(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your billing history?")) return;
    setClearingHistory(true);
    try {
      const { clearWorkspacePaymentsAction } = await import("../actions/billing");
      const res = await clearWorkspacePaymentsAction();
      if (res.success) {
        setHistory([]);
      }
    } catch (e) {
      console.error("Failed to clear history", e);
    } finally {
      setClearingHistory(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const { applyCouponToSubscriptionAction } = await import("../actions/billing");
      const res = await applyCouponToSubscriptionAction(couponInput.trim());
      if (res.success && res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponError("");
        setStatusMessage({
          type: "success",
          text: res.message || `Coupon "${res.coupon.code}" applied! (${res.coupon.discountText})`,
        });
      } else {
        setCouponError(res.message || "Invalid or inactive coupon code.");
        setAppliedCoupon(null);
      }
    } catch (err: any) {
      setCouponError(err.message || "Failed to validate coupon.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
    try {
      const { removeCouponFromSubscriptionAction } = await import("../actions/billing");
      await removeCouponFromSubscriptionAction();
      setStatusMessage({
        type: "success",
        text: "Coupon removed from subscription.",
      });
    } catch (err: any) {
      console.error("Error removing coupon:", err);
    }
  };

  const calculatePlanPrice = (plan: PlanViewItem, cycle: "monthly" | "yearly") => {
    const rawPriceStr = cycle === "monthly" ? plan.price : plan.yearlyPrice;
    const rawPriceNum = parseInt(String(rawPriceStr).replace(/[^0-9]/g, ""), 10) || 0;

    if (!appliedCoupon || rawPriceNum === 0) {
      return {
        rawPrice: rawPriceNum,
        rawPriceStr,
        finalPrice: rawPriceNum,
        finalPriceStr: rawPriceStr,
        discountAmount: 0,
        isDiscounted: false,
      };
    }

    if (appliedCoupon.applicablePlans && appliedCoupon.applicablePlans.length > 0) {
      const normPlan = plan.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isApplicable = appliedCoupon.applicablePlans.some(
        (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, "") === normPlan
      );
      if (!isApplicable) {
        return {
          rawPrice: rawPriceNum,
          rawPriceStr,
          finalPrice: rawPriceNum,
          finalPriceStr: rawPriceStr,
          discountAmount: 0,
          isDiscounted: false,
        };
      }
    }

    const couponVal = Number(appliedCoupon.value) || 0;
    let discount = 0;
    if (appliedCoupon.type === "percent" || (appliedCoupon as any).type === "percentage") {
      discount = Math.round(rawPriceNum * (couponVal / 100));
    } else {
      discount = Math.min(rawPriceNum, couponVal);
    }

    const final = Math.max(0, rawPriceNum - discount);
    return {
      rawPrice: rawPriceNum,
      rawPriceStr,
      finalPrice: final,
      finalPriceStr: final.toLocaleString(),
      discountAmount: discount,
      isDiscounted: discount > 0,
    };
  };

  const handleOpenSwitchModal = (target: "monthly" | "yearly") => {
    setSwitchTargetInterval(target);
    setSwitchModalOpen(true);
  };

  const handleConfirmSwitchInterval = async () => {
    setSwitchingCycle(true);
    setStatusMessage(null);
    try {
      const res = await import("../actions/billing").then(m =>
        m.switchBillingIntervalAction({ targetInterval: switchTargetInterval, couponCode: appliedCoupon?.code })
      );

      if (res.success && res.checkoutUrl) {
        if (res.checkoutUrl.includes("/billing/success") || res.checkoutUrl.includes("switched=true")) {
          window.location.href = res.checkoutUrl;
          return;
        }
        setSwitchModalOpen(false);
        setPendingCheckoutUrl(res.checkoutUrl);
        setRenewalNoticeModalOpen(true);
      } else if (res.success) {
        setSwitchModalOpen(false);
        setStatusMessage({
          type: "success",
          text: res.message || `Switched billing cycle to ${switchTargetInterval}!`,
        });
        await fetchHistoryAndUsage();
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to switch billing cycle.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      });
    } finally {
      setSwitchingCycle(false);
    }
  };

  const handleUpgradePlan = async (targetPlanName: string) => {
    try {
      setProcessingCheckout(true);
      setStatusMessage(null);

      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName: targetPlanName,
          billingInterval: billingCycle,
          couponCode: appliedCoupon?.code,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to initiate online upgrade.",
        });
        return;
      }

      if (data.checkoutUrl) {
        if (data.checkoutUrl.includes("/billing/success")) {
          window.location.href = data.checkoutUrl;
          return;
        }
        setPendingCheckoutUrl(data.checkoutUrl);
        setRenewalNoticeModalOpen(true);
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setStatusMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setProcessingCheckout(false);
    }
  };

  const limits = {
    invoices: 50,
    quotations: 50,
    incomes: 100,
    expenses: 100,
    clients: 50,
    accounts: 2
  };
  const getPercentage = (current: number, max: number) => Math.min(100, (current / max) * 100);

  const activePlanName = tenantInfo.plan || "Free";
  const isPaidPlan = activePlanName.toLowerCase() !== "free";
  const subStatus = subDetails?.status || (isPaidPlan ? "active" : "free");

  const currentPlanDef = activePlans.find(
    p => p.name.toLowerCase() === activePlanName.toLowerCase()
  ) || activePlans.find(p => p.name.toLowerCase() === "pro plus") || activePlans[0];

  const baseTargetPriceNum = switchTargetInterval === "yearly"
    ? (subDetails?.price_yearly ? Number(subDetails.price_yearly) : currentPlanDef?.yearlyPrice ? parseInt(String(currentPlanDef.yearlyPrice).replace(/[^0-9]/g, ""), 10) : 25000)
    : (subDetails?.price_monthly ? Number(subDetails.price_monthly) : currentPlanDef?.price ? parseInt(String(currentPlanDef.price).replace(/[^0-9]/g, ""), 10) : 2500);

  const normActivePlan = activePlanName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isCouponApplicableToTarget = Boolean(
    appliedCoupon &&
    (!appliedCoupon.applicablePlans ||
      appliedCoupon.applicablePlans.length === 0 ||
      appliedCoupon.applicablePlans.some((p: string) => {
        const normP = p.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normP === normActivePlan;
      }))
  );

  let targetPriceNum = baseTargetPriceNum;
  let targetDiscountAmount = 0;
  if (isCouponApplicableToTarget && appliedCoupon) {
    if (appliedCoupon.type === "percent") {
      targetDiscountAmount = Math.round(baseTargetPriceNum * (appliedCoupon.value / 100));
    } else {
      targetDiscountAmount = Math.min(baseTargetPriceNum, appliedCoupon.value);
    }
    targetPriceNum = Math.max(0, baseTargetPriceNum - targetDiscountAmount);
  }

  return (
    <div className="space-y-8">
      {/* 1. Status Message Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3 ${statusMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
            }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Free Plan Lifetime Usage (if applicable) */}
      {tenantInfo.plan === "Free" && usage && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Free Plan Lifetime Quota</h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Tracked cumulatively. Upgrade to unlock unlimited records.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-foreground border border-border self-start sm:self-auto">
              Lifetime Quota
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Invoices</span>
                <span className="text-muted-foreground">{usage.invoices} / {limits.invoices}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.invoices, limits.invoices)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Quotations</span>
                <span className="text-muted-foreground">{usage.quotations ?? 0} / {limits.quotations}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.quotations ?? 0, limits.quotations)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Income Records</span>
                <span className="text-muted-foreground">{usage.incomes} / {limits.incomes}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.incomes, limits.incomes)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Expense Records</span>
                <span className="text-muted-foreground">{usage.expenses} / {limits.expenses}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.expenses, limits.expenses)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Clients</span>
                <span className="text-muted-foreground">{usage.clients} / {limits.clients}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.clients, limits.clients)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-foreground">Accounts</span>
                <span className="text-muted-foreground">{usage.accounts} / {limits.accounts}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-orange-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.accounts, limits.accounts)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TWO CONTINUOUS COLUMNS: (Left: Active Subscription & Billing Details | Right: Available Plans & Invoices) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Active Subscription & Billing Details */}
        <div className="space-y-6">
          {/* Card 1: Active Subscription Overview */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Current Subscription</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-foreground">
                    {activePlanName} Plan
                  </span>
                  {subDetails?.billing_interval && isPaidPlan && (
                    <span className="text-xs sm:text-sm font-semibold text-muted-foreground capitalize">
                      ({subDetails.billing_interval})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    subStatus === "active"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : subStatus === "past_due"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : subStatus === "canceled"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {subStatus === "active" ? "Active" : subStatus === "past_due" ? "Past Due" : subStatus === "canceled" ? "Canceled" : "Free"}
                </span>
              </div>
            </div>

            {/* Renewal & Plan Summary */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Renewal Frequency</span>
                <span className="font-bold text-foreground capitalize">
                  {subDetails?.billing_interval ? `${subDetails.billing_interval} billing` : "None"}
                </span>
              </div>

              {subDetails?.current_period_end && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {subStatus === "canceled" ? "Access Until" : "Next Renewal Date"}
                  </span>
                  <span className="font-bold text-foreground">
                    {new Date(subDetails.current_period_end).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}

              {subDetails?.provider_subscription_id && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subscription ID</span>
                  <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                    {subDetails.provider_subscription_id}
                  </span>
                </div>
              )}
            </div>

            {/* Sub Actions */}
            {isPaidPlan && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {subStatus !== "canceled" && (
                  <button
                    type="button"
                    onClick={() => handleOpenSwitchModal(subDetails?.billing_interval === "yearly" ? "monthly" : "yearly")}
                    className="flex-1 min-w-[160px] py-2.5 px-3 rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300 hover:bg-brand-500/20 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Repeat className="w-3.5 h-3.5 text-brand-500" />
                    <span>Switch to {subDetails?.billing_interval === "yearly" ? "Monthly" : "Yearly (-17%)"}</span>
                  </button>
                )}

                {subStatus !== "canceled" ? (
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={cancelingSubscription}
                    className="py-2.5 px-3 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {cancelingSubscription ? "Canceling..." : "Cancel Subscription"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpgradePlan(activePlanName)}
                    disabled={processingCheckout}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Reactivate Subscription
                  </button>
                )}
              </div>
            )}

            {/* Sub Actions */}
          </div>

          {/* Card 2: Billing & Invoice Information */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-foreground">Billing Details</h3>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Company / Billing Name</label>
                <input
                  type="text"
                  value={billingSettings.billingName}
                  onChange={(e) => setBillingSettings(prev => ({ ...prev, billingName: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Email (Invoices Sent Here)</label>
                <input
                  type="email"
                  value={billingSettings.billingEmail}
                  onChange={(e) => setBillingSettings(prev => ({ ...prev, billingEmail: e.target.value }))}
                  placeholder="billing@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Billing Address</label>
                <input
                  type="text"
                  value={billingSettings.billingAddress}
                  onChange={(e) => setBillingSettings(prev => ({ ...prev, billingAddress: e.target.value }))}
                  placeholder="123 Galle Road, Colombo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">City</label>
                  <input
                    type="text"
                    value={billingSettings.billingCity}
                    onChange={(e) => setBillingSettings(prev => ({ ...prev, billingCity: e.target.value }))}
                    placeholder="Colombo"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Country</label>
                  <input
                    type="text"
                    value={billingSettings.billingCountry}
                    onChange={(e) => setBillingSettings(prev => ({ ...prev, billingCountry: e.target.value }))}
                    placeholder="Sri Lanka"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveBillingDetails}
                  disabled={savingBillingSettings}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingBillingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savingBillingSettings ? "Saving..." : "Save Billing Information"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: All Plan Things & Payment & Billing History */}
        <div className="space-y-6">
          {/* Card 1: All Plan Things */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            {/* Available Plans Header with Monthly/Yearly toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Available Plans</h3>
              </div>

              <div className="flex bg-muted/60 p-1 rounded-full w-fit border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer ${billingCycle === "monthly" ? "bg-brand-500 text-brand-950 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer ${billingCycle === "yearly" ? "bg-brand-500 text-brand-950 shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Yearly <span className="opacity-80 font-normal">-17%</span>
                </button>
              </div>
            </div>

            {/* Compact Plan Cards Grid */}
            {gatewayStatus?.cardPaymentsDisabled && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {appliedCoupon && Number(appliedCoupon.value) >= 100
                    ? "Card payments are disabled on live, but you can activate plans for free with your 100% off coupon!"
                    : "Card payments are disabled on live."}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activePlans.map((plan) => {
                const isCurrent = activePlanName.toLowerCase() === plan.name.toLowerCase();
                const priceInfo = calculatePlanPrice(plan, billingCycle);

                const getPlanTier = (pName: string): number => {
                  const norm = pName.toLowerCase().replace(/[^a-z0-9]/g, "");
                  if (norm.includes("plus")) return 2;
                  if (norm.includes("pro")) return 1;
                  return 0; // free
                };
                const currentTier = getPlanTier(activePlanName);
                const targetTier = getPlanTier(plan.name);
                const isDowngrade = !isCurrent && targetTier < currentTier;
                const isCardBlocked = !isCurrent && priceInfo.finalPrice > 0 && Boolean(gatewayStatus?.cardPaymentsDisabled);
                const isSamePlanAndCycle = isCurrent && (!subDetails?.billing_interval || subDetails.billing_interval === billingCycle);
                const isButtonDisabled = isSamePlanAndCycle || processingCheckout || isCardBlocked;

                return (
                  <div
                    key={plan.name}
                    className={`relative bg-background/60 rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${isCurrent
                        ? "border-brand-500 ring-2 ring-brand-500/20 shadow-xs"
                        : "border-border hover:border-muted-foreground/30"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
                        {isCurrent ? (
                          <span className="text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        ) : plan.popular ? (
                          <span className="text-[9px] font-bold uppercase bg-brand-500 text-brand-950 px-2 py-0.5 rounded-full shadow-xs">
                            Popular
                          </span>
                        ) : null}
                      </div>

                      {priceInfo.isDiscounted ? (
                        <div className="space-y-0.5 mb-1.5">
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground line-through font-semibold">
                              LKR {priceInfo.rawPrice.toLocaleString()}
                            </span>
                            <span className="text-emerald-500 font-bold">
                              -{(appliedCoupon?.type === "percent" || (appliedCoupon as any)?.type === "percentage") ? `${Number(appliedCoupon.value)}%` : `LKR ${priceInfo.discountAmount.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[11px] text-foreground font-semibold">LKR</span>
                            <span className="text-xl font-black text-brand-500 tracking-tight">
                              {priceInfo.finalPrice === 0 ? "0" : priceInfo.finalPriceStr}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              /{billingCycle === "monthly" ? "mo" : "yr"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1 mb-1.5">
                          <span className="text-[11px] text-foreground font-semibold">LKR</span>
                          <span className="text-xl font-black text-foreground tracking-tight">
                            {billingCycle === "monthly" ? plan.price : plan.yearlyPrice}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            /{billingCycle === "monthly" ? "mo" : "yr"}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isCurrent) {
                          handleUpgradePlan(plan.name);
                        } else if (subDetails?.billing_interval && subDetails.billing_interval !== billingCycle) {
                          handleOpenSwitchModal(billingCycle);
                        }
                      }}
                      disabled={isButtonDisabled}
                      title={isCardBlocked ? "Card payments are disabled on live" : undefined}
                      className={`w-full py-2 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1 ${isSamePlanAndCycle
                          ? "bg-muted text-muted-foreground cursor-default opacity-80"
                          : isCardBlocked
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60 border border-border"
                            : isCurrent
                              ? "bg-brand-500/15 border border-brand-500/40 text-brand-700 dark:text-brand-300 hover:bg-brand-500/25 shadow-xs cursor-pointer"
                              : isDowngrade
                                ? "bg-muted/70 hover:bg-muted text-foreground border border-border shadow-2xs cursor-pointer"
                                : "bg-brand-500 text-brand-950 hover:bg-brand-400 shadow-xs cursor-pointer"
                        }`}
                    >
                      {processingCheckout && !isCurrent ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {isCurrent
                              ? subDetails?.billing_interval && subDetails.billing_interval !== billingCycle
                                ? `Switch`
                                : `Active`
                              : isDowngrade
                                ? `Downgrade`
                                : `Upgrade`}
                          </span>
                          {isCurrent && subDetails?.billing_interval && subDetails.billing_interval !== billingCycle ? (
                            <Repeat className="w-3 h-3 text-brand-500" />
                          ) : isDowngrade ? (
                            <ArrowDown className="w-3 h-3 text-muted-foreground" />
                          ) : !isCurrent ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : null}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Coupon Bar */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-foreground">Have a coupon code?</span>
              </div>

              {appliedCoupon ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-mono font-bold text-xs text-foreground uppercase tracking-wider">{appliedCoupon.code}</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">({appliedCoupon.discountText})</span>
                  {(appliedCoupon as any).expiryType === "months" && (
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded border border-brand-500/30">
                      {(appliedCoupon as any).durationMonths || 1} Mo Auto-Expire
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="ml-1 p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                    title="Remove coupon"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponError) setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    placeholder="Coupon code"
                    className="w-32 px-2.5 py-1 rounded-xl bg-background border border-border text-xs font-mono font-semibold outline-none focus:border-brand-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponInput.trim()}
                    className="px-3 py-1 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {validatingCoupon ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
            </div>
            {couponError && (
              <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{couponError}</span>
              </div>
            )}

            {/* Add-ons & Extensions: Point of Sale (POS) */}
            <div id="pos-addon" className="pt-5 border-t border-border space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Add-ons & Extensions</span>
                  <div className="flex items-center gap-2 mt-1">
                    <h3 className="text-xl font-bold text-foreground">Point of Sale (POS)</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      posAddonStatus?.hasAddon
                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                        : "bg-brand-500/15 text-brand-500 border border-brand-500/30"
                    }`}>
                      {posAddonStatus?.hasAddon ? "Active" : "Available"}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-brand-500/10 text-brand-500 rounded-2xl border border-brand-500/20">
                  <Store className="w-6 h-6" />
                </div>
              </div>

              <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Add-on Price:</span>
                <span className="font-bold text-foreground">LKR 3,000 / month</span>
              </div>

              {posAddonStatus?.hasAddon ? (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Add-on Active on Workspace
                  </span>
                  <Link
                    href="/pos"
                    className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Store className="w-4 h-4" />
                    <span>Open POS Terminal</span>
                  </Link>
                </div>
              ) : tenantInfo.plan !== "Free" ? (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">Ready to activate on your {tenantInfo.plan} plan</span>
                  <button
                    type="button"
                    onClick={handleEnablePosAddon}
                    disabled={enablingPosAddon}
                    className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {enablingPosAddon ? "Activating..." : "Get POS Add-on (LKR 3,000/mo)"}
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    <MdLock className="w-3.5 h-3.5" />
                    Requires Pro or Pro Plus plan
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("Pro")}
                    className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Payment & Billing History */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Payment & Billing History</h3>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={clearingHistory}
                  className="text-xs font-medium text-muted-foreground hover:text-rose-500 transition-colors"
                >
                  {clearingHistory ? "Clearing..." : "Clear History"}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center p-8"><Loader /></div>
            ) : history.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-xs">No billing records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((row) => {
                      const isApproved = row.status === "approved" || row.status === "paid";
                      const isRejected = row.status === "rejected" || row.status === "failed";
                      return (
                        <tr key={row.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-3 px-3 text-muted-foreground font-medium text-xs whitespace-nowrap">
                            {new Date(row.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </td>
                          <td className="py-3 px-3 font-semibold text-foreground text-xs whitespace-nowrap">{row.plan_name}</td>
                          <td className="py-3 px-3 font-bold text-foreground text-xs whitespace-nowrap">
                            {row.amount ? `${Number(row.amount).toLocaleString()} LKR` : "—"}
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                            {row.method ? row.method : row.provider ? `${row.provider} (Card)` : "Card"}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isApproved
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                : isRejected
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              }`}>
                              {isApproved ? "PAID" : isRejected ? "FAILED" : "PENDING"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Switch Billing Cycle / Method Modal */}
      {switchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-500/15 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Change Billing Method</h3>
                  <p className="text-xs text-muted-foreground">Switch interval while keeping your subscription active</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interval comparison */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 border border-border rounded-2xl">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Current Billing
                </span>
                <span className="text-sm font-bold text-foreground capitalize flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                  {subDetails?.billing_interval || "Monthly"}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block mb-1">
                  New Billing Target
                </span>
                <span className="text-sm font-black text-brand-600 dark:text-brand-400 capitalize flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                  {switchTargetInterval} ({switchTargetInterval === "yearly" ? "Save 17% · 2 Mo Free" : "Per Month"})
                </span>
              </div>
            </div>

            {/* Plan Fee & Coupon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-muted-foreground font-medium">{activePlanName} ({switchTargetInterval}) Cost</span>
                <div className="text-right">
                  {targetDiscountAmount > 0 && (
                    <span className="text-xs text-muted-foreground line-through mr-2">
                      LKR {baseTargetPriceNum.toLocaleString()}
                    </span>
                  )}
                  <span className="text-base font-black text-foreground">
                    LKR {targetPriceNum.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    /{switchTargetInterval === "yearly" ? "yr" : "mo"}
                  </span>
                </div>
              </div>

              {targetDiscountAmount > 0 && appliedCoupon && (
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/50 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Coupon Discount ({appliedCoupon.code})</span>
                  </span>
                  <span>-LKR {targetDiscountAmount.toLocaleString()}</span>
                </div>
              )}

              {/* Coupon input inside Modal */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-500" />
                    <span>Have a Coupon Code?</span>
                  </span>
                  {appliedCoupon && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {appliedCoupon.code} ({appliedCoupon.discountText})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponError) setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:border-brand-500"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponInput.trim()}
                      className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                    </button>
                  )}
                </div>
                {couponError && (
                  <p className="text-[11px] text-red-500 font-medium">{couponError}</p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/20 border border-border text-xs text-muted-foreground leading-relaxed">
                You will be redirected to secure checkout to authorize and activate your new {switchTargetInterval} subscription cycle.
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-border flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleConfirmSwitchInterval}
                disabled={switchingCycle}
                className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {switchingCycle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initiating Checkout...</span>
                  </>
                ) : (
                  <>
                    <Repeat className="w-4 h-4" />
                    <span>Confirm & Switch (LKR {targetPriceNum.toLocaleString()})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="w-full py-2.5 rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Automatic Renewal Checkout Guidance Modal */}
      {renewalNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <h3 className="text-lg font-bold text-foreground">Automatic Renewal Notice</h3>
              <button
                type="button"
                onClick={() => {
                  setRenewalNoticeModalOpen(false);
                  setPendingCheckoutUrl(null);
                }}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instruction description */}
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                If you want <strong>automatic renewal</strong>, please make sure to <strong>tick the highlighted checkbox</strong> on the upcoming checkout page:
              </p>

              {/* Checkout Preview with Highlighted Box */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex items-center justify-center p-2.5">
                <img
                  src="/images/payments-checkout-guide.png"
                  alt="Payments.lk checkout preview with keep card on file highlighted"
                  className="w-full max-h-60 sm:max-h-72 object-contain rounded-xl select-none shadow-xs pointer-events-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <p className="leading-relaxed">
                  <strong>Otherwise:</strong> Your card will not be saved, and you will need to pay manually at the end of each billing cycle to prevent your workspace from reverting to the Free plan.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRenewalNoticeModalOpen(false);
                  setPendingCheckoutUrl(null);
                }}
                className="py-2.5 px-4 rounded-xl border border-border hover:bg-muted font-bold text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingCheckoutUrl) {
                    window.location.href = pendingCheckoutUrl;
                  }
                }}
                className="py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPreferencesView() {
  const [prefs, setPrefs] = useState({
    currency: "LKR",
    invoicePrefix: "INV",
    autoRefresh: "30",
    maxUploadSize: "5",
    defaultViewRange: "this year",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/preferences");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.prefs) {
            setPrefs(prev => ({
              ...prev,
              ...data.prefs,
              defaultViewRange: data.prefs.defaultViewRange || localStorage.getItem("framebooks_default_range") || "this year",
            }));
          }
        }
      } catch (e) {
        console.error("Failed to load preferences", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (typeof window !== "undefined" && prefs.defaultViewRange) {
        localStorage.setItem("framebooks_default_range", prefs.defaultViewRange);
      }
      const res = await fetch("/api/admin/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        alert("Failed to save preferences to database");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Default Currency</label>
            <select
              value={prefs.currency}
              onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="USD">USD ($)</option>
              <option value="LKR">LKR (Rs.)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Default Dashboard View Range</label>
            <select
              value={prefs.defaultViewRange || "this year"}
              onChange={(e) => setPrefs({ ...prefs, defaultViewRange: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="this year">This Year</option>
              <option value="lifetime">Lifetime</option>
              <option value="6 months">Last 6 Months</option>
              <option value="three months">Last 3 Months</option>
              <option value="one month">Last Month</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Invoice Number Prefix</label>
            <input
              type="text"
              value={prefs.invoicePrefix}
              onChange={(e) => setPrefs({ ...prefs, invoicePrefix: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="INV"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Analytics Auto-Refresh (sec)</label>
            <select
              value={prefs.autoRefresh}
              onChange={(e) => setPrefs({ ...prefs, autoRefresh: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="300">5 minutes</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Max Receipt Upload Size (MB)</label>
            <input
              type="number"
              value={prefs.maxUploadSize}
              onChange={(e) => setPrefs({ ...prefs, maxUploadSize: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              min="1"
              max="50"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-white text-black font-semibold rounded-3xl hover:opacity-95 transition-opacity"
          >
            {saving ? "Saving..." : success ? "Preferences Saved!" : "Save Preferences"}
          </button>

          <button
            type="button"
            onClick={() => window.open('/api/export', '_blank')}
            className="px-6 py-3 bg-brand-500/10 text-brand-400 border border-brand-500/20 font-semibold rounded-3xl hover:bg-brand-500/20 transition-all"
          >
            Export Data to CSV
          </button>
        </div>
      </form>
    </div>
  );
}

function DangerZoneView({ currentUserRole, teamMembers = [] }: { currentUserRole: string | null, teamMembers?: any[] }) {
  const router = useRouter();
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [transferToUserId, setTransferToUserId] = useState("");
  const { requireAuth } = useAppLock();

  const handleTransferOwnership = () => {
    if (currentUserRole !== 'owner' && currentUserRole !== 'Super Admin') {
      setErrorMsg("Only the owner can transfer ownership.");
      setPendingAction(null);
      return;
    }
    if (!transferToUserId) {
      setErrorMsg("Please select a team member.");
      return;
    }
    requireAuth(async () => {
      setIsDeleting(true);
      try {
        const { transferOwnership } = await import("../actions/tenants");
        const res = await transferOwnership(transferToUserId);
        if (res?.error) throw new Error(res.error);
        window.location.reload();
      } catch (e: any) {
        setErrorMsg(e.message);
      }
      setIsDeleting(false);
    }, true);
  };

  const handleResetWorkspace = () => {
    requireAuth(async () => {
      setIsDeleting(true);
      try {
        const { resetWorkspace } = await import("../actions/tenants");
        await resetWorkspace();
        window.location.reload();
      } catch (e: any) {
        setErrorMsg(e.message);
      }
      setIsDeleting(false);
    }, true);
  };

  const handleDeleteWorkspace = () => {
    requireAuth(async () => {
      setIsDeleting(true);
      try {
        const { deleteWorkspace } = await import("../actions/tenants");
        await deleteWorkspace();
        window.location.href = "/";
      } catch (e: any) {
        setErrorMsg(e.message);
      }
      setIsDeleting(false);
    }, true);
  };

  const handleDeleteAccount = () => {
    if (currentUserRole === 'owner') {
      setErrorMsg("You cannot delete your account while you are the owner of a workspace. Please transfer ownership or delete the workspace first.");
      setPendingAction(null);
      return;
    }
    requireAuth(async () => {
      setIsDeleting(true);
      try {
        const { deletePersonalAccount } = await import("../actions/tenants");
        await deletePersonalAccount();
        window.location.href = "/";
      } catch (e: any) {
        setErrorMsg(e.message);
      }
      setIsDeleting(false);
    }, true);
  };

  if (pendingAction) {
    let requiredText = 'DELETE';
    if (pendingAction === 'reset') requiredText = 'RESET';
    else if (pendingAction === 'transfer') requiredText = 'TRANSFER';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6 text-red-500">
          <Terminal className="w-5 h-5" />
          <h2 className="text-xl font-bold">Confirm Action</h2>
        </div>

        {errorMsg && (
          <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6">
            {errorMsg}
          </div>
        )}

        <div className="bg-card border border-red-500/20 rounded-3xl p-6 shadow-xs">
          <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to proceed? This action is irreversible.</p>

          <div className="bg-rose-50 dark:bg-red-500/10 border border-rose-200 dark:border-red-500/20 rounded-2xl p-6 mb-6">
            <p className="text-sm text-rose-800 dark:text-red-300/80 mb-4">Please type <span className="font-mono font-bold text-red-600 dark:text-red-400">{requiredText}</span> to confirm.</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type ${requiredText}`}
              className="w-full sm:w-64 bg-card border border-rose-300 dark:border-red-500/20 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-red-500 shadow-2xs placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { setPendingAction(null); setDeleteConfirmText(""); setErrorMsg(""); }}
              className="px-6 py-2 bg-card hover:bg-black/5 dark:hover:bg-white/10 text-foreground border border-border rounded-xl transition-colors font-medium cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (pendingAction === 'reset') handleResetWorkspace();
                else if (pendingAction === 'delete_workspace') handleDeleteWorkspace();
                else if (pendingAction === 'delete_account') handleDeleteAccount();
                else if (pendingAction === 'transfer') handleTransferOwnership();
              }}
              disabled={isDeleting || deleteConfirmText !== requiredText}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isDeleting ? "Processing..." : "Confirm Action"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {errorMsg && (
        <div className="text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-400/10 border border-red-300 dark:border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-rose-200/60 dark:border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all shadow-xs">
          <h3 className="font-bold text-foreground mb-2">Reset Workspace</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Delete all invoices, clients, inventory, and transactions, but keep the workspace itself and your team members.</p>
          <button
            onClick={() => { setPendingAction('reset'); setErrorMsg(""); }}
            disabled={isDeleting}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 font-bold rounded-xl text-sm transition-colors border border-rose-200/60 dark:border-red-500/20 cursor-pointer shadow-2xs"
          >
            Reset Data
          </button>
        </div>

        <div className="bg-card border border-rose-200/60 dark:border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all shadow-xs">
          <h3 className="font-bold text-foreground mb-2">Delete Workspace</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Permanently delete this workspace and all associated data. This action is irreversible.</p>
          <button
            onClick={() => { setPendingAction('delete_workspace'); setErrorMsg(""); }}
            disabled={isDeleting || currentUserRole !== 'owner'}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 font-bold rounded-xl text-sm transition-colors border border-rose-200/60 dark:border-red-500/20 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            Delete Workspace
          </button>
        </div>

        <div className="bg-card border border-rose-200/60 dark:border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all md:col-span-2 shadow-xs">
          <h3 className="font-bold text-foreground mb-2">Transfer Ownership</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Transfer your workspace ownership to another team member. You will lose owner privileges and become an Admin.</p>

          {teamMembers.length > 0 ? (
            <div className="flex gap-4 items-center">
              <select
                value={transferToUserId}
                onChange={(e) => setTransferToUserId(e.target.value)}
                className="bg-card border border-border rounded-xl px-4 py-2 text-foreground outline-none focus:border-brand-500 text-sm w-full sm:w-auto min-w-[200px] shadow-2xs"
              >
                <option value="" className="bg-card text-foreground">Select a team member...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id} className="bg-card text-foreground">{member.email}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!transferToUserId) {
                    setErrorMsg("Please select a team member first.");
                    return;
                  }
                  setPendingAction('transfer');
                  setErrorMsg("");
                }}
                disabled={isDeleting || !transferToUserId || currentUserRole !== 'owner'}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 font-bold rounded-xl text-sm transition-colors border border-rose-200/60 dark:border-red-500/20 disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-2xs"
              >
                Transfer
              </button>
            </div>
          ) : (
            <p className="text-sm text-yellow-500 font-medium">You need to add team members before you can transfer ownership.</p>
          )}
        </div>

        <div className="bg-card border border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all md:col-span-2">
          <h3 className="font-bold text-foreground mb-2">Delete Personal Account</h3>
          <p className="text-sm text-gray-400 mb-6">Permanently delete your account and personal data from the platform. Workspace owners cannot delete their account without first deleting or transferring the workspace.</p>
          <button
            onClick={() => { setPendingAction('delete_account'); setErrorMsg(""); }}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-foreground font-bold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}