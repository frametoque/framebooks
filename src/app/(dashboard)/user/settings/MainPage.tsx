"use client";
import { Loader } from "@/components/ui/Loader";
import RolesConfigurator from "../components/RolesConfigurator";


import { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useSession, signOut } from 'next-auth/react';
import { IdCard, Globe, Save, Building, Copy, Terminal, Sliders } from "lucide-react";
import { MdPerson, MdMailOutline, MdKeyboardArrowRight, MdKeyboardArrowLeft, MdLocationOn, MdPhone, MdUpload, MdDownload, MdCheck, MdShowChart, MdCreditCard, MdGroup, MdBusiness, MdHistory, MdLogout, MdWarning, MdSecurity, MdDelete } from "react-icons/md";
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

const plans = [
  {
    name: "Free",
    price: "0",
    yearlyPrice: "0",
    description: "Get started for free to explore the product",
    popular: false,
    features: [
      { label: "Invoices Limit", value: "50", icon: MdUpload },
      { label: "Income Limit", value: "100", icon: MdUpload },
      { label: "Expense Limit", value: "100", icon: MdDownload },
      { label: "Client Limit", value: "50", icon: MdGroup },
      { label: "Bank Accounts", value: "2", icon: MdBusiness },
      { label: "Inventory Management", value: "No", icon: MdCheck },
      { label: "Advanced Reports", value: "No", icon: MdShowChart },
      { label: "Security Level", value: "Standard", icon: MdSecurity },
    ],
  },
  {
    name: "Pro",
    price: "2,500",
    yearlyPrice: "25,000",
    popular: true,
    description: "Advanced tools to manage finances and grow faster.",
    features: [
      { label: "Invoices Limit", value: "Unlimited", icon: MdUpload },
      { label: "Income Limit", value: "Unlimited", icon: MdUpload },
      { label: "Expense Limit", value: "Unlimited", icon: MdDownload },
      { label: "Client Limit", value: "Unlimited", icon: MdGroup },
      { label: "Bank Accounts", value: "2", icon: MdBusiness },
      { label: "Inventory Management", value: "No", icon: MdCheck },
      { label: "Advanced Reports", value: "Yes", icon: MdShowChart },
      { label: "Security Level", value: "High + 2FA", icon: MdSecurity },
    ],
  },
  {
    name: "Pro Plus",
    price: "5,000",
    yearlyPrice: "50,000",
    description: "For Power Users and large teams",
    popular: false,
    features: [
      { label: "Invoices Limit", value: "Unlimited", icon: MdUpload },
      { label: "Income Limit", value: "Unlimited", icon: MdUpload },
      { label: "Expense Limit", value: "Unlimited", icon: MdDownload },
      { label: "Client Limit", value: "Unlimited", icon: MdGroup },
      { label: "Bank Accounts", value: "Unlimited", icon: MdBusiness },
      { label: "Inventory Management", value: "Yes", icon: MdCheck },
      { label: "Advanced Reports", value: "Yes", icon: MdShowChart },
      { label: "Security Level", value: "High + Audit Logs", icon: MdSecurity },
    ],
  }
];

export default function SettingsPage() {
  const { confirm } = useConfirm();
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");
  const [activeView, setActiveView] = useState(searchParams.get("tab") ? "form" : "hub");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customPasskeys, setCustomPasskeys] = useState<any[]>([]);
  const { autoLockDuration, setAutoLockDuration, highSecurityMode, setHighSecurityMode, requireAuth } = useAppLock();
  const [tenantInfo, setTenantInfo] = useState<{plan: string, name: string, logo_url: string | null, industry: string | null, phone: string | null, email: string | null, website: string | null, address: string | null}>({ plan: "Free", name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{type: "success" | "error", text: string} | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

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
      } else {
        alert(res.error || "Failed to delete invitation");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeamData = async () => {
    try {
      const [invitesRes, membersRes, rolesRes] = await Promise.all([
        fetch('/api/team/invitations/sent').then(r => r.json()),
        getTeamMembers(),
        getRoles()
      ]);
      if (invitesRes.sent) setSentInvitations(invitesRes.sent);
      if (membersRes.success) setTeamMembers(membersRes.members);
      if (rolesRes) setAvailableRoles(rolesRes);
    } catch (e) {
      console.error("Failed to fetch team data", e);
    }
  };

  useEffect(() => {
    if ((activeTab === "team" || activeTab === "danger") && user) {
      fetchTeamData();
    }
  }, [activeTab, user]);

  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    clerk_id: "",
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    address: "",
  });

  const connectedAccounts = [];

  // Helper: apply a fetched profile object onto formData
  const applyProfile = (profile: any) => {
    setFormData(prev => ({
      ...prev,
      name:    profile?.fullName  || user?.name || "",
      email:   profile?.email     || user?.email || "",
      phone:   profile?.phone     || "",
      company: profile?.company   || "",
      website: profile?.website   || "",
      address: profile?.address   || "",
    }));
  };

   // Load Clerk user + DB data
  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      const loadAllData = async () => {
        try {
          setLoading(true);
          
          const fetchProfileAndPasskeys = async () => {
            const [resProfile, resPasskeys] = await Promise.all([
              fetch(`/api/users/get-profile?userId=${user.id}`),
              fetch(`/api/auth/passkey/list`)
            ]);
            
            if (resProfile.ok) {
              const data = await resProfile.json();
              applyProfile(data.success ? data.profile : null);
            } else {
              applyProfile(null);
            }

            if (resPasskeys.ok) {
              const pkData = await resPasskeys.json();
              setCustomPasskeys(pkData.passkeys || []);
            }
          };

          const fetchTenantAndRole = async () => {
            const { getTenantInfo } = await import("../actions/tenants");
            const [data, role] = await Promise.all([
              getTenantInfo(),
              getCurrentUserRole()
            ]);
            if (data) setTenantInfo(data);
            if (role) setCurrentUserRole(role);
          };

          await Promise.all([fetchProfileAndPasskeys(), fetchTenantAndRole()]);
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
        setTenantInfo(prev => ({ ...prev, ...tenantFormData }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(`Error: ${res.error}`);
      }
      setSaving(false);
    });
  };

  const [logoUploading, setLogoUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
      // Reset the file input
      e.target.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("You must be signed in to save changes.");
      return;
    }

    requireAuth(async () => {
      setSaving(true);
      setSaveSuccess(false);

      try {
        const parts = formData.name.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        
        // Update custom database via API instead of Clerk 

        const payload = {
          clerkId: user.id,
         // email updates via next-auth are read-only from Googlel,
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
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          alert(`Failed to save: ${data.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("Save error:", err);
        alert("An unexpected error occurred while saving.");
      } finally {
        setSaving(false);
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
      }).catch(() => {});
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB.");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `MdUpload Error: Avatar file size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit` }),
      }).catch(() => {});
      return;
    }

    try {
      // await user?.setProfileImage({ file }); // Feature requires custom storage now
      alert("Photo updated successfully!");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `Updated admin profile photo: "${file.name}"` }),
      }).catch(() => {});
    } catch (err: any) {
      console.error("MdUpload error:", err);
      alert("MdUpload failed. Please try again.");
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: `MdUpload Error: Profile photo upload failed: ${err.message || String(err)}` }),
      }).catch(() => {});
    }
  };


  const tabs = [
    { id: "profile", name: "Profile", icon: MdPerson },
    ...(currentUserRole === 'owner' || currentUserRole === 'Super Admin' 
      ? [{ id: "billing", name: "Billing & Plans", icon: MdCreditCard }] : []),
    ...(currentUserRole === 'owner' || currentUserRole === 'Super Admin' || currentUserRole === 'Admin' 
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
          href="/sign-in" 
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
              <div className="relative w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-border">
                {tenantInfo.logo_url ? (
                  <img
                    src={tenantInfo.logo_url}
                    alt="Business Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-card flex items-center justify-center">
                    <Building className="w-8 h-8 text-gray-500" />
                  </div>
                )}
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
                  <img
                    src={user.image || "/logos/ft/logo.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
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

          </div>

          {/* Right Column (Navigation Menu) */}
          <div className="flex-1 space-y-10 lg:pl-6">
            
            {/* Section 2 */}
            <div>

              <div className="flex flex-col">
                {[
                  { name: "Business Profile", sub: "Update business name, contact & details.", icon: MdBusiness, id: "business", allowed: currentUserRole !== 'Viewer' && currentUserRole !== 'Editor' },
                  { name: "Account & Security", sub: "Manage your profile, connected accounts, and app lock.", icon: MdPerson, id: "profile", allowed: true },
                  { name: "Billing & Plans", sub: "Manage your subscription and payments.", icon: MdCreditCard, id: "billing", allowed: currentUserRole === 'owner' || currentUserRole === 'Super Admin' },
                  { name: "Team Settings", sub: "Manage team members and roles.", icon: MdGroup, id: "team", allowed: currentUserRole === 'owner' || currentUserRole === 'Super Admin' },
                  { name: "Roles & Permissions", sub: "Configure custom roles.", icon: MdSecurity, id: "roles", allowed: currentUserRole === 'owner' },
                  { name: "Audit Logs", sub: "View system and user activity.", icon: MdHistory, id: "audit_logs", allowed: currentUserRole === 'owner' || currentUserRole === 'Super Admin' },
                  { name: "Data Export", sub: "Export your workspace data to CSV.", icon: MdDownload, id: "export", allowed: currentUserRole === 'owner' },
                  { name: "Danger Zone", sub: "Destructive account and workspace actions.", icon: MdWarning, id: "danger", allowed: currentUserRole === 'owner' || currentUserRole === 'Super Admin' }
                ]
                .filter(item => item.allowed)
                .map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setActiveTab(item.id); setActiveView("form"); router.push(`/user/settings?tab=${item.id}`); }}
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
      {activeTab === "export" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-6 relative z-50">
            <button 
              type="button"
              onClick={(e) => { 
                e.preventDefault();
                setActiveTab("profile"); 
                setActiveView("hub"); 
                router.replace("/user/settings"); 
              }} 
              className="p-2 hover:bg-card rounded-full transition-colors cursor-pointer relative z-50"
            >
              <MdKeyboardArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold">Data Export</h2>
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
                        const items: ("invoices"|"incomes"|"expenses"|"clients")[] = ["invoices", "incomes", "expenses", "clients"];
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
          <button 
            onClick={() => {
              setActiveView("hub");
              router.push("/user/settings");
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-foreground font-semibold mb-8 transition-colors"
          >
            <MdKeyboardArrowLeft className="w-5 h-5" /> Settings
          </button>
          
          <div className="bg-transparent">

            {activeTab === "business" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground mb-6">Business Profile</h2>
                
                {currentUserRole === 'Viewer' || currentUserRole === 'Editor' ? (
                  <div className="p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                    You do not have permission to view or edit the business profile.
                  </div>
                ) : (
                  <>
                    {/* Logo Upload */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border">
                    {logoUploading ? (
                      <div className="w-full h-full bg-card flex items-center justify-center">
                        <Loader />
                      </div>
                    ) : tenantInfo.logo_url ? (
                      <img src={tenantInfo.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-card flex items-center justify-center">
                        <Building className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Company Logo</label>
                    <label className={`flex items-center justify-center w-full h-32 px-4 transition bg-transparent border-2 border-border border-dashed rounded-2xl appearance-none focus:outline-none ${currentUserRole === 'Viewer' ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-500 cursor-pointer'}`}>
                      <span className="flex items-center space-x-2">
                        <MdUpload className="w-6 h-6 text-gray-400" />
                        <span className="font-medium text-gray-400">
                          {logoUploading ? "Uploading..." : currentUserRole === 'Viewer' ? "Read Only" : "Drop logo here or click to browse"}
                        </span>
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
                    <p className="text-xs text-gray-400">JPG, PNG, GIF or WebP. Max size 2MB</p>
                  </div>
                </div>

                <form onSubmit={handleSaveTenant} className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-300">Business Name *</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <Building className="w-4 h-4 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={tenantFormData.name}
                          onChange={handleTenantChange}
                          disabled={currentUserRole === 'Viewer'}
                          className="w-full pl-11 pr-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-300">Industry</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <Globe className="w-4 h-4 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          name="industry"
                          placeholder="e.g. Retail, Tech, Manufacturing"
                          value={tenantFormData.industry}
                          onChange={handleTenantChange}
                          disabled={currentUserRole === 'Viewer'}
                          className="w-full pl-11 pr-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-300">Business Email</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <MdMailOutline className="w-4 h-4 text-gray-500" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          placeholder="contact@business.com"
                          value={tenantFormData.email}
                          onChange={handleTenantChange}
                          disabled={currentUserRole === 'Viewer'}
                          className="w-full pl-11 pr-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-300">Phone Number</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <MdPhone className="w-4 h-4 text-gray-500" />
                        </div>
                        <input
                          type="tel"
                          name="phone"
                          placeholder="+94 77 000 0000"
                          value={tenantFormData.phone}
                          onChange={handleTenantChange}
                          disabled={currentUserRole === 'Viewer'}
                          className="w-full pl-11 pr-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Website</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">https://</div>
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
                        className="w-full pl-20 pr-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Business Address</label>
                    <textarea
                      name="address"
                      placeholder="123 Business Street, City, Country"
                      value={tenantFormData.address}
                      disabled={currentUserRole === 'Viewer'}
                      onChange={handleTenantChange}
                      rows={3}
                      className="w-full px-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <p className="text-sm text-gray-400">Shown on invoices and client-facing documents.</p>
                    {currentUserRole !== 'Viewer' && (
                      <button 
                        type="submit" 
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-full transition-colors disabled:opacity-50"
                      >
                        <MdCheck className="w-4 h-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </div>
                  {saveSuccess && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2 mt-4">
                      <MdCheck className="w-4 h-4" /> Business profile updated successfully
                    </div>
                  )}
                </form>
                </>
              )}
              </div>
            )}

            {activeTab === "team" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground mb-6">Manage Team Members</h2>
                {tenantInfo.plan !== 'Pro Plus' ? (
                  <UpgradeOverlay 
                    title="Team Management"
                    description="Invite and manage team members to collaborate on your workspace. Upgrade to Pro Plus to unlock this feature."
                    requiredPlan="Pro Plus"
                  >
                    <div />
                  </UpgradeOverlay>
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
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-foreground rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>

                          <div className="text-center mb-8">
                            <MdGroup className="w-12 h-12 text-brand-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-foreground mb-2">Invite to Team</h3>
                            <p className="text-sm text-gray-400">Invite team members to collaborate and manage access to your business profile.</p>
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
                              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                              <input 
                                type="email" 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="colleague@example.com"
                                className="w-full bg-black/50 border border-border hover:border-black/20 dark:border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-sm text-foreground mb-4"
                                required
                              />
                              <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                              <select 
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="w-full bg-black/50 border border-border hover:border-black/20 dark:border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-sm text-foreground appearance-none cursor-pointer"
                              >
                                {availableRoles.length > 0 ? availableRoles.filter(r => r.role.toLowerCase() !== 'owner').map((r) => (
                                  <option key={r.role} value={r.role} className="bg-[#1a1d1a]">{r.role}</option>
                                )) : (
                                  <>
                                    <option value="Admin" className="bg-[#1a1d1a]">Admin</option>
                                    <option value="Editor" className="bg-[#1a1d1a]">Editor</option>
                                    <option value="Viewer" className="bg-[#1a1d1a]">Viewer</option>
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
                  <div className="bg-card border border-border rounded-3xl p-8">
                    <div className="space-y-3">
                      {teamMembers.map(member => (
                        <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/20 rounded-2xl border border-border gap-4">
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-2">
                              {member.full_name || 'Unnamed User'}
                              {member.clerk_id === user.id && <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 text-[10px] uppercase font-bold rounded-full border border-brand-500/20">You</span>}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{member.email}</p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {(currentUserRole === 'owner' || currentUserRole === 'Super Admin') && member.role !== 'owner' && member.role !== 'Super Admin' ? (
                              <select 
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                className="bg-white/10 border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none cursor-pointer"
                              >
                                {availableRoles.length > 0 ? availableRoles.filter(r => r.role.toLowerCase() !== 'owner').map((r) => (
                                  <option key={r.role} value={r.role} className="bg-[#1a1d1a]">{r.role}</option>
                                )) : (
                                  <>
                                    <option value="Admin">Admin</option>
                                    <option value="Editor">Editor</option>
                                    <option value="Viewer">Viewer</option>
                                  </>
                                )}
                              </select>
                            ) : (
                              <span className="px-3 py-1.5 text-xs font-bold uppercase rounded-full bg-card text-gray-300 border border-border">
                                {member.role}
                              </span>
                            )}

                            {(currentUserRole === 'owner' || currentUserRole === 'Super Admin') && member.role !== 'owner' && member.role !== 'Super Admin' && (
                              <button 
                                onClick={() => handleRemoveMember(member.id, member.full_name)}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors border border-red-500/20"
                              >
                                Remove
                              </button>
                            )}

                            {member.clerk_id === user.id && member.role !== 'owner' && member.role !== 'Super Admin' && (
                              <button 
                                onClick={handleLeaveTeam}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors border border-red-500/20"
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

                {sentInvitations.length > 0 && (
                  <div className="mt-8 bg-card border border-border rounded-3xl p-8">
                    <h3 className="text-lg font-semibold text-foreground mb-6">Sent Invitations</h3>
                    <div className="space-y-3">
                      {sentInvitations.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-border">
                          <div>
                            <p className="font-medium text-foreground">{inv.email}</p>
                            <p className="text-xs text-gray-400 mt-1">Sent on {new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full ${
                              inv.status === 'pending' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' :
                              inv.status === 'accepted' ? 'bg-green-400/10 text-green-400 border border-green-400/20' :
                              'bg-red-400/10 text-red-400 border border-red-400/20'
                            }`}>
                              {inv.status}
                            </span>
                            {inv.status === 'pending' && currentUserRole === 'owner' && (
                              <button
                                onClick={() => handleDeleteInvitation(inv.id, inv.email)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
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

            {activeTab === "profile" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">Account & Security</h2>
                {/* Personal Info - simplified: name, photo, connected accounts */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-border">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border shrink-0">
                    <img
                      src={user.image || "/logos/ft/logo.png"}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = "/logos/ft/logo.png"; e.currentTarget.onerror = null; }}
                    />
                  </div>
                  <div className="flex-1 flex flex-col items-start gap-1">
                    <h3 className="text-xl font-bold">{user?.name || "No name provided"}</h3>
                    <p className="text-brand-400 font-mono text-sm mb-2">{user?.email || "No email provided"}</p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-border rounded-3xl hover:bg-white/20 transition-colors cursor-pointer text-sm font-semibold text-gray-300 mt-1">
                      <MdUpload className="w-4 h-4" />
                      Change Photo
                      <input type="file" accept="image/jpeg,image/png,image/gif" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Name update */}
                <form onSubmit={handleSave} className="space-y-4 max-w-xl">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Display Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-transparent border border-border focus:border-brand-500 rounded-2xl text-foreground text-sm focus:ring-1 focus:ring-brand-500 transition-colors"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="flex">
                    <button
                      type="submit"
                      disabled={saving || saveSuccess}
                      className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-full transition-colors disabled:opacity-50"
                    >
                      {saveSuccess ? <><MdCheck className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Name"}</>}
                    </button>
                  </div>
                </form>



                {/* App Lock */}
                {(() => {
                  const hasCurrentDevicePasskey = customPasskeys.some((pk: any) => pk.is_current_device);
                  return (
                <div className="pt-6 border-t border-border">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                    <div className="flex-1 pr-4">
                      <h3 className="text-lg font-semibold text-foreground">App Lock</h3>
                      <p className="text-sm text-gray-400 mt-1">Secure your dashboard with your device using a fingerprint, face scan, or screen lock.</p>
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
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-foreground rounded-3xl font-semibold transition-colors text-sm whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {hasCurrentDevicePasskey ? "Register Another Device" : "Enable App Lock on this Device"}
                    </button>
                  </div>

                  {customPasskeys.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Auto-Lock Duration</label>
                      <select
                        value={autoLockDuration}
                        onChange={(e) => setAutoLockDuration(parseInt(e.target.value, 10))}
                        className="w-full sm:w-64 bg-card border border-border hover:border-black/20 dark:border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-brand-500 transition-colors text-sm text-foreground appearance-none"
                      >
                        <option value={60000} className="bg-[#1a1d1a]">After 1 minute</option>
                        <option value={300000} className="bg-[#1a1d1a]">After 5 minutes</option>
                        <option value={600000} className="bg-[#1a1d1a]">After 10 minutes</option>
                        <option value={900000} className="bg-[#1a1d1a]">After 15 minutes</option>
                      </select>
                    </div>
                  )}

                  {customPasskeys.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">High Security Mode</label>
                      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl">
                        <div>
                          <p className="text-foreground font-medium">Require passkey for all actions</p>
                          <p className="text-sm text-gray-400">If disabled, passkey is only required for major actions like workspace deletion.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={highSecurityMode} onChange={(e) => setHighSecurityMode(e.target.checked)} />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {!hasCurrentDevicePasskey && customPasskeys.length > 0 && (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl mb-4">
                        <p className="text-orange-400 font-medium text-sm">App Lock is not enabled on this device.</p>
                      </div>
                    )}
                    {customPasskeys.length === 0 ? (
                      <p className="text-gray-400 text-sm">App Lock is currently disabled.</p>
                    ) : (
                      customPasskeys.map((pk: any) => (
                        <div key={pk.id} className="flex items-center justify-between p-4 bg-card rounded-3xl border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-500/10 rounded-2xl flex items-center justify-center">
                              <MdCheck className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{pk.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-400">Added on {new Date(pk.created_at).toLocaleDateString()}</p>
                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                <p className="text-xs text-gray-400">
                                  {pk.device_type === 'singleDevice' ? 'Single Device' : 'Multi Device'}
                                  {pk.backed_up ? ' (Backed up)' : ''}
                                  {pk.is_current_device ? ' (This Device)' : ''}
                                </p>
                              </div>
                            </div>
                          </div>
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
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-medium transition-colors text-sm"
                        >
                          Remove App Lock
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );})()}

                {currentUserRole !== 'owner' && (
                  <div className="pt-6 border-t border-border mt-8">
                    <h3 className="text-xl font-bold text-foreground mb-4">Leave Workspace</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Leaving this workspace will remove your access to all data and resources. You will need a new invitation to rejoin.
                    </p>
                    <button onClick={async () => {
                      if(confirm("Are you sure you want to leave this workspace? This action cannot be undone.")) {
                        await leaveTeam();
                        window.location.reload();
                      }
                    }} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                      <MdWarning className="w-5 h-5" />
                      Leave Workspace
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "audit_logs" && (
              <AuditLogsTab />
            )}

            {activeTab === "roles" && (
              tenantInfo.plan === 'Pro Plus' ? (
                <RolesConfigurator currentUserRole={currentUserRole} />
              ) : (
                <UpgradeOverlay 
                  title="Granular Team Roles"
                  description="Configure custom, fine-grained access control permissions for your team members. Upgrade to Pro Plus to unlock this feature."
                  requiredPlan="Pro Plus"
                >
                  <div />
                </UpgradeOverlay>
              )
            )}

            {activeTab === "danger" && (
              <DangerZoneView currentUserRole={currentUserRole} teamMembers={teamMembers} />
            )}

            {activeTab === "billing" && (
              <BillingView tenantInfo={tenantInfo} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BillingView({ tenantInfo }: { tenantInfo: { plan: string, name: string, logo_url: string | null, industry: string | null } }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(tenantInfo.plan || "Pro");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (tenantInfo.plan) {
      setSelectedPlan(tenantInfo.plan);
    }
  }, [tenantInfo.plan]);

  const fetchHistoryAndUsage = async () => {
    try {
      setLoading(true);
      const res = await import("../actions/billing").then(m => m.getSubscriptionHistory());
      if (res.success) {
        setHistory(res.history || []);
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

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!slipFile) {
      alert("Please upload a payment slip.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("planName", selectedPlan);
      formData.append("billingCycle", billingCycle);
      const planInfo = plans.find(p => p.name === selectedPlan);
      const amount = planInfo ? (billingCycle === 'monthly' ? planInfo.price.replace(/,/g, '') : planInfo.yearlyPrice.replace(/,/g, '')) : '0';
      formData.append("amount", amount);
      formData.append("slip", slipFile);
      
      const { submitSubscriptionPayment } = await import("../actions/billing");
      const res = await submitSubscriptionPayment(formData);
      
      if (res.success) {
        alert("Payment slip submitted successfully!");
        setSlipFile(null);
        fetchHistoryAndUsage();
      } else {
        alert("Failed to submit payment slip: " + res.error);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while submitting payment.");
    } finally {
      setUploading(false);
    }
  };

  const [paymentMethod, setPaymentMethod] = useState<"slip" | "online">("slip");

  const limits = {
    invoices: 50,
    incomes: 100,
    expenses: 100,
    clients: 50,
    accounts: 2
  };

  const getPercentage = (current: number, max: number) => Math.min(100, (current / max) * 100);

  return (
    <div className="space-y-8">
      {/* Usage View for Free Plan */}
      {tenantInfo.plan === "Free" && usage && (
        <div className="bg-transparent border border-border rounded-3xl p-7 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Current Plan Usage</h2>
          <p className="text-gray-400 text-sm mb-8">You are currently on the <span className="font-bold text-foreground">Free</span> plan. Upgrade to unlock unlimited features.</p>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Invoices</span>
                <span className="text-gray-400">{usage.invoices} / {limits.invoices}</span>
              </div>
              <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.invoices, limits.invoices)}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Income Records</span>
                <span className="text-gray-400">{usage.incomes} / {limits.incomes}</span>
              </div>
              <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.incomes, limits.incomes)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Expense Records</span>
                <span className="text-gray-400">{usage.expenses} / {limits.expenses}</span>
              </div>
              <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.expenses, limits.expenses)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Clients</span>
                <span className="text-gray-400">{usage.clients} / {limits.clients}</span>
              </div>
              <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.clients, limits.clients)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-medium">Bank/Cash Accounts</span>
                <span className="text-gray-400">{usage.accounts} / {limits.accounts}</span>
              </div>
              <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                <div className="bg-orange-500 h-full rounded-full transition-all" style={{ width: `${getPercentage(usage.accounts, limits.accounts)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Comparison */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4 sm:mb-0">Available Plans</h2>
          <div className="flex bg-card p-1 rounded-full w-fit">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${billingCycle === "monthly" ? "bg-brand-500 text-[#161916]" : "text-gray-400 hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${billingCycle === "yearly" ? "bg-brand-500 text-[#161916]" : "text-gray-400 hover:text-foreground"}`}
            >
              Yearly <span className="ml-1 opacity-80 font-normal">- Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-3xl overflow-hidden transition-all flex flex-col ${
                selectedPlan === plan.name 
                ? "ring-2 ring-brand-500 shadow-xl shadow-brand-500/10" 
                : "border border-border"
              }`}
            >
              {/* Header */}
              <div className="p-6 pb-4">
                {plan.popular && (
                  <span className="absolute top-6 right-6 text-[10px] font-bold uppercase bg-brand-500 text-brand-900 px-3 py-1 rounded-full">Popular</span>
                )}
                <h4 className="text-xl font-bold text-foreground mb-2">{plan.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 min-h-[40px] pr-8">{plan.description}</p>
                
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-xl text-foreground font-semibold">LKR</span>
                  <span className="text-4xl font-black text-foreground tracking-tight">
                    {billingCycle === "monthly" ? plan.price : plan.yearlyPrice}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-border"></div>

              {/* Features List */}
              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-6 flex-1 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <feature.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{feature.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground text-right">{feature.value}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setSelectedPlan(plan.name)}
                  className={`w-full py-3.5 rounded-2xl font-bold transition-all text-sm ${
                    selectedPlan === plan.name
                      ? "bg-black text-white dark:bg-white dark:text-black hover:opacity-90"
                      : "bg-[#161916] text-white hover:bg-black/90 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  }`}
                >
                  Buy Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method Toggle */}
      <div className="bg-transparent border border-border rounded-3xl p-7">
        <h3 className="text-xl font-bold text-foreground mb-6">Payment</h3>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setPaymentMethod("slip")}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              paymentMethod === "slip" ? "bg-brand-500 text-[#161916]" : "bg-card text-gray-300 hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            Upload Bank Slip
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("online")}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              paymentMethod === "online" ? "bg-brand-500 text-[#161916]" : "bg-card text-gray-300 hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            Pay Online
          </button>
        </div>

        {paymentMethod === "slip" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Upload Bank Slip</label>
              <div className="w-full flex items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl bg-card">
                <input 
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500/20 file:text-foreground hover:file:bg-brand-500/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !slipFile}
              className="w-full py-3 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#161916] font-bold rounded-full transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? "Uploading..." : "Submit Payment Slip"}
            </button>
          </form>
        ) : (
          <div className="text-center py-8">
            <MdCreditCard className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-foreground mb-2">Online Payment</h4>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Secure online payment via card or bank transfer. You will be redirected to a secure checkout.</p>
            <button className="px-8 py-3 bg-brand-500 hover:bg-brand-400 text-[#161916] font-bold rounded-full transition-colors">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>

      <div className="bg-transparent border border-border rounded-3xl p-6">
        <h3 className="text-xl font-bold text-foreground mb-6">Payment History</h3>
        {loading ? (
          <div className="flex justify-center p-4"><Loader /></div>
        ) : history.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No past payments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-gray-400 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-card transition-colors">
                    <td className="py-3 px-4 text-gray-300">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{row.plan_name}</td>
                    <td className="py-3 px-4">
                      <a href={row.slip_url} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                        View Slip
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        row.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        row.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPreferencesView() {
  const [prefs, setPrefs] = useState({
    currency: "LKR",
    invoicePrefix: "INV",
    autoRefresh: "30",
    maxUploadSize: "5",
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
            setPrefs(data.prefs);
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
      <h2 className="text-2xl font-bold text-foreground mb-6">Admin Preferences</h2>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Invoice Number Prefix</label>
            <input
              type="text"
              value={prefs.invoicePrefix}
              onChange={(e) => setPrefs({ ...prefs, invoicePrefix: e.target.value })}
              className="w-full px-4 py-3 bg-transparent border border-border rounded-3xl text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="INV"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

        <div className="bg-card border border-red-500/20 rounded-3xl p-6">
          <p className="text-gray-400 mb-6">Are you sure you want to proceed? This action is irreversible.</p>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6">
            <p className="text-sm text-red-300/80 mb-4">Please type <span className="font-mono font-bold text-red-400">{requiredText}</span> to confirm.</p>
            <input 
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type ${requiredText}`}
              className="w-full sm:w-64 bg-black/50 border border-red-500/20 rounded-xl px-4 py-2 text-red-300 focus:outline-none focus:border-red-500/50"
            />
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => { setPendingAction(null); setDeleteConfirmText(""); setErrorMsg(""); }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-foreground rounded-xl transition-colors font-medium cursor-pointer"
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
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-foreground font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
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
      <div className="flex items-center gap-2 mb-6 text-red-500">
        <Terminal className="w-5 h-5" />
        <h2 className="text-xl font-bold">Danger Zone</h2>
      </div>
      
      {errorMsg && (
        <div className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-2xl text-sm mb-6">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all">
          <h3 className="font-bold text-foreground mb-2">Reset Workspace</h3>
          <p className="text-sm text-gray-400 mb-6">Delete all invoices, clients, inventory, and transactions, but keep the workspace itself and your team members.</p>
          <button 
            onClick={() => { setPendingAction('reset'); setErrorMsg(""); }}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Reset Data
          </button>
        </div>

        <div className="bg-card border border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all">
          <h3 className="font-bold text-foreground mb-2">Delete Workspace</h3>
          <p className="text-sm text-gray-400 mb-6">Permanently delete this workspace and all associated data. This action is irreversible.</p>
          <button 
            onClick={() => { setPendingAction('delete_workspace'); setErrorMsg(""); }}
            disabled={isDeleting || currentUserRole !== 'owner'}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            Delete Workspace
          </button>
        </div>

        <div className="bg-card border border-red-500/10 hover:border-red-500/30 rounded-3xl p-6 transition-all md:col-span-2">
          <h3 className="font-bold text-foreground mb-2">Transfer Ownership</h3>
          <p className="text-sm text-gray-400 mb-6">Transfer your workspace ownership to another team member. You will lose owner privileges and become an Admin.</p>
          
          {teamMembers.length > 0 ? (
            <div className="flex gap-4 items-center">
              <select 
                value={transferToUserId} 
                onChange={(e) => setTransferToUserId(e.target.value)}
                className="bg-black/50 border border-border rounded-xl px-4 py-2 text-foreground outline-none focus:border-brand-500 text-sm w-full sm:w-auto min-w-[200px]"
              >
                <option value="">Select a team member...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.email}</option>
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
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
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