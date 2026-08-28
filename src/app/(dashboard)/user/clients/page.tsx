"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo } from "react";
import { Edit2, Loader2, Crown, Sparkles } from "lucide-react";
import { MdSearch, MdAdd, MdDelete, MdClose, MdKeyboardArrowRight, MdGroup, MdAccessTime } from "react-icons/md";
import Link from "next/link";
import ClientAvatar from "@/components/ClientAvatar";
import { getClients, createClient, updateClient, deleteClient, getLimitStatus } from "../actions/actions";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAppLock } from "../components/AppLockProvider";
import { useRole } from "../context/RoleContext";
import { useConfirm } from '@/components/ui/ConfirmProvider';

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};


const emptyForm = { name: '', email: '', company: '', phone: '', address: '' };

export default function ClientsPage() {
  const { confirm } = useConfirm();
  const { requireAuth } = useAppLock();
  const { role } = useRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getClients();
      setData(res);
    } catch (e) {
      console.error("Failed to load clients", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    getLimitStatus('clients').then(status => {
      if (!status.allowed) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: status.error }));
      }
    });
  }, []);

  useEffect(() => {
    const handleSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSearchTerm(customEvent.detail || "");
    };
    const handleOpenNew = () => {
      setEditingId(null);
      setFormData(emptyForm);
      setIsModalOpen(true);
    };
    window.addEventListener("clients:search", handleSearch);
    window.addEventListener("clients:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("clients:search", handleSearch);
      window.removeEventListener("clients:open-new", handleOpenNew);
    };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (client: any) => {
    setEditingId(client.id);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      company: client.company || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() && !formData.email.trim()) { alert("Please provide either a name or an email."); return; }
    setSaving(true);
    try {
      let res: any;
      if (editingId) {
        res = await updateClient(editingId, {
          name: formData.name,
          email: formData.email,
          company: formData.company || null,
          phone: formData.phone || null,
          address: formData.address || null,
        });
      } else {
        res = await createClient({
          name: formData.name,
          email: formData.email,
          company: formData.company || null,
          phone: formData.phone || null,
          address: formData.address || null,
        });
      }
      if (typeof res === 'object' && res?.error) throw new Error(res.error);
      setIsModalOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("LIMIT_EXCEEDED")) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: e.message }));
      } else {
        alert("Failed to save client.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: any) => {
    if (!await confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    
    requireAuth(async () => {
      setDeletingId(client.id);
      try {
        await deleteClient(client.id);
        await loadData();
      } catch (e) {
        console.error(e);
        alert("Failed to delete client.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-card w-14 h-14" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>
        
        {/* Skeleton List */}
        <div className="bg-transparent border border-border rounded-3xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded-full w-48 mb-6" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-border last:border-0">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded-full w-1/3" />
                <div className="h-3 bg-card rounded-full w-1/4" />
              </div>
              <div className="h-6 bg-white/10 rounded-full w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ----- Derived stats -----
  // Sort by revenue to find top client
  const byRevenue = [...data].sort((a, b) => b.revenue - a.revenue);
  const topClient = byRevenue[0] ?? null;

  // Most recent = first in list (getClients now orders by c.id DESC which encodes Date.now())
  const recentClient = data[0] ?? null;

  const stats = [
    {
      label: "Total Clients",
      value: data.length.toString(),
      sub: null,
      icon: MdGroup,
      color: "text-brand-400",
      bg: "bg-brand-400/10",
    },
    {
      label: "Top by Revenue",
      value: topClient ? topClient.name : "—",
      sub: topClient ? formatLKR(topClient.revenue) : null,
      icon: Crown,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Highest Value",
      value: topClient ? formatLKR(topClient.revenue) : "—",
      sub: topClient ? topClient.name : null,
      icon: Sparkles,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Recent Client",
      value: recentClient ? recentClient.name : "—",
      sub: recentClient ? recentClient.email : null,
      icon: MdAccessTime,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
  ];

  const filteredClients = data.filter((client: any) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // A client is "linked" if it has any invoices, income, or active work
  const isLinked = (c: any) =>
    c.invoices > 0 || c.incomeCount > 0 || c.projectCount > 0;

  return (
    <div className="space-y-4">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors min-w-0">
            <div className={`p-4 rounded-2xl flex-shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-xl font-semibold truncate" title={stat.value}>
                <AnimatedNumber value={stat.value} />
              </p>
              {stat.sub && (
                <p className="text-xs text-gray-500 truncate mt-0.5" title={stat.sub}>
                  <AnimatedNumber value={stat.sub} />
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-gray-400 text-sm">
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium hidden md:table-cell">Company</th>
                <th className="p-4 font-medium hidden sm:table-cell">Phone</th>
                <th className="p-4 font-medium hidden lg:table-cell">Status</th>
                <th className="p-4 font-medium hidden sm:table-cell">Invoices</th>
                <th className="p-4 font-medium">Revenue</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.map((client: any) => {
                const linked = isLinked(client);
                const isDeleting = deletingId === client.id;
                const deleteTitle = linked
                  ? `Cannot delete — this client has linked invoices, income, or active work`
                  : `Delete ${client.name}`;

                return (
                  <tr key={client.id} className="hover:bg-card transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Client avatar removed for cleaner UI */}
                        <div>
                          <p className="font-semibold text-foreground text-sm">{client.name}</p>
                          <p className="text-xs text-gray-400">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300 hidden md:table-cell">
                      {client.company
                        ? <span className="text-brand-400">{client.company}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-4 text-sm text-gray-300 hidden sm:table-cell">
                      {client.phone || <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {client.active
                        ? <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
                        : <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">Inactive</span>}
                    </td>
                    <td className="p-4 text-sm text-gray-300 hidden sm:table-cell">
                      {client.invoices}
                    </td>
                    <td className="p-4 font-semibold text-brand-400 text-sm">
                      {formatLKR(client.revenue)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        {role !== 'Viewer' && (
                          <>
                            {/* Edit */}
                            <button
                              onClick={() => openEdit(client)}
                              title="Edit client"
                              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete — disabled if linked */}
                            <button
                              onClick={() => !linked && !isDeleting && handleDelete(client)}
                              title={deleteTitle}
                              disabled={linked || isDeleting}
                              className={`p-2 rounded-xl transition-colors ${
                                linked
                                  ? "text-gray-700 cursor-not-allowed"
                                  : isDeleting
                                  ? "text-red-400 opacity-50 cursor-wait"
                                  : "text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                              }`}
                            >
                              {isDeleting
                                ? <Loader size="sm" />
                                : <MdDelete className="w-4 h-4" />}
                            </button>
                          </>
                        )}

                        {/* View profile */}
                        <Link
                          href={`/user/clients/${client.id}`}
                          title="View client profile & history"
                          className="p-2 hover:bg-brand-400/10 rounded-xl transition-colors text-gray-400 hover:text-brand-400"
                        >
                          <MdKeyboardArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">
                    {searchTerm ? 'No clients match your search.' : 'No clients yet. Add your first client!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 text-foreground flex shrink-0">
                  <MdGroup className="w-5 h-5 text-foreground" />
                </div>
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Edit Client' : 'Add New Client'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Email change cascade warning — only shown in edit mode */}
              {editingId && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl">
                  <span className="text-amber-400 text-lg leading-none mt-0.5">⚠</span>
                  <p className="text-xs text-amber-300 leading-relaxed">
                    Changing the email will automatically update all linked <strong>invoices</strong> to use the new address.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-sm text-gray-400">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-sm text-gray-400">
                    Email
                    {editingId && <span className="text-amber-400/70 text-xs ml-1">(cascades to all records)</span>}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Company</label>
                  <input
                    type="text"
                    placeholder="(optional)"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Phone</label>
                  <input
                    type="tel"
                    placeholder="(optional)"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Address</label>
                <input
                  type="text"
                  placeholder="(optional)"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-card">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-full font-medium hover:bg-card transition-colors text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-full font-bold transition-colors disabled:opacity-50 text-sm"
              >
                {saving && <Loader size="sm" />}
                {saving ? 'Saving...' : (editingId ? 'Update Client' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}