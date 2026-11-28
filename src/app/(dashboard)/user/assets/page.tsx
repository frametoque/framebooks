"use client";
import { Loader } from "@/components/ui/Loader";

import { useEffect, useState, useMemo } from "react";
import { 
  Building2, Edit2, CheckCircle2, Box, ArrowDown, ArrowUp, 
  MapPin, User, ShieldCheck, Tag, Plus, Laptop, Armchair, Wrench, FileText
} from "lucide-react";
import { 
  MdSearch, MdAdd, MdDelete, MdClose, MdInfoOutline, MdDownload, 
  MdInsertDriveFile, MdRemoveRedEye, MdUpload 
} from "react-icons/md";
import { 
  getInventoryItems, createInventoryItem, updateInventoryItem, 
  deleteInventoryItem, uploadInventoryDocument, getExpensesForLinking 
} from "../actions/inventory";
import AnimatedNumber from "../components/AnimatedNumber";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useAppLock } from "../components/AppLockProvider";
import { useRole } from "../context/RoleContext";
import { PlanType } from "@/lib/plans";
import { getTenantPlan } from "../actions/plan";
import { UpgradeOverlay } from "../components/UpgradeOverlay";
import Image from "next/image";
import { parseCategories, deduplicateCategories, categoryMatches } from "@/lib/categoryUtils";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

const DEFAULT_ASSET_CATEGORIES = [
  "IT & Computers",
  "Office Furniture",
  "Electronics & Displays",
  "Machinery & Tools",
  "Office Equipment",
  "Vehicles",
  "Fixtures & Fittings",
];

const emptyForm = { 
  item_name: '', 
  category: '', 
  serial_number: '', 
  sku: '', 
  quantity: 1, 
  status: 'Available', 
  location: '', 
  assigned_to: '', 
  purchase_date: '', 
  purchase_price: '', 
  notes: '', 
  warranty_letter_url: '', 
  expense_id: '' 
};

export default function AssetsInventoryPage() {
  const { confirm } = useConfirm();
  const { requireAuth } = useAppLock();
  const { role } = useRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; title: string } | null>(null);
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [viewingItemTab, setViewingItemTab] = useState<'invoice' | 'warranty'>('invoice');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [plan, setPlan] = useState<PlanType>('Free');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeCategory, setActiveCategory] = useState("All");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadData = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [res, exp, currentPlan] = await Promise.all([getInventoryItems(), getExpensesForLinking(), getTenantPlan()]);
      setData(res);
      setExpenses(exp);
      setPlan(currentPlan);
    } catch (e) {
      console.error("Failed to load business assets", e);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [res, exp, currentPlan] = await Promise.all([getInventoryItems(), getExpensesForLinking(), getTenantPlan()]);
        if (!cancelled) { setData(res); setExpenses(exp); setPlan(currentPlan); }
      } catch (e) {
        console.error("Failed to load business assets", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
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
    window.addEventListener("assets:search", handleSearch);
    window.addEventListener("assets:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("assets:search", handleSearch);
      window.removeEventListener("assets:open-new", handleOpenNew);
    };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      item_name: item.item_name || '',
      category: item.category || '',
      sku: item.sku || '',
      serial_number: item.serial_number || '',
      quantity: item.quantity || 1,
      status: item.status || 'Available',
      location: item.location || '',
      assigned_to: item.assigned_to || '',
      purchase_date: item.purchase_date ? new Date(item.purchase_date).toISOString().split('T')[0] : '',
      purchase_price: item.purchase_price !== null && item.purchase_price !== undefined ? String(item.purchase_price) : '',
      notes: item.notes || '',
      warranty_letter_url: item.warranty_letter_url || '',
      expense_id: item.expense_id ? String(item.expense_id) : ''
    });
    setIsModalOpen(true);
  };

  const [uploadingWarranty, setUploadingWarranty] = useState(false);

  const handleUploadWarranty = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWarranty(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = await uploadInventoryDocument(fd);
      setFormData(prev => ({ ...prev, warranty_letter_url: url }));
    } catch (err) {
      console.error(err);
      alert('Failed to upload warranty document');
    } finally {
      setUploadingWarranty(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name.trim()) {
      alert("Please enter an asset name.");
      return;
    }
    setSaving(true);
    try {
      const payload = { 
        ...formData, 
        quantity: parseInt(formData.quantity.toString()) || 1, 
        purchase_price: formData.purchase_price !== '' ? (parseFloat(formData.purchase_price) || 0) : null,
      };
      if (editingId) {
        await updateInventoryItem(editingId, payload);
      } else {
        await createInventoryItem(payload);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save asset.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!await confirm(`Delete asset "${item.item_name}"? This record cannot be undone.`)) return;
    setDeletingId(item.id);
    try {
      await deleteInventoryItem(item.id, item.item_name);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete asset.");
    } finally {
      setDeletingId(null);
    }
  };

  const dynamicCategories = useMemo(() => {
    const raw: string[] = [];
    data.forEach((item) => {
      const parsed = parseCategories(item.category);
      if (parsed.length > 0) {
        parsed.forEach(c => raw.push(c));
      } else if (item.category && item.category.trim()) {
        raw.push(item.category.trim());
      }
    });
    const unique = deduplicateCategories(raw).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return ["All", ...unique];
  }, [data]);

  const filteredData = useMemo(() => {
    let list = data;
    if (activeCategory !== "All") {
      list = list.filter(d => categoryMatches(d.category, activeCategory));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(d => 
        (d.item_name || '').toLowerCase().includes(lower) ||
        (d.category || '').toLowerCase().includes(lower) ||
        (d.serial_number || '').toLowerCase().includes(lower) ||
        (d.location || '').toLowerCase().includes(lower) ||
        (d.assigned_to || '').toLowerCase().includes(lower) ||
        (d.sku || '').toLowerCase().includes(lower)
      );
    }
    return [...list].sort((a, b) => {
      const timeA = a.purchase_date ? new Date(a.purchase_date).getTime() : null;
      const timeB = b.purchase_date ? new Date(b.purchase_date).getTime() : null;

      if (timeA === null && timeB === null) {
        const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return cB - cA;
      }
      if (timeA === null) return 1;
      if (timeB === null) return -1;

      if (timeA !== timeB) {
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
      const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cB - cA;
    });
  }, [data, activeCategory, searchTerm, sortOrder]);

  const totalAssets = data.length;
  const inUseOrAvailable = data.filter(d => {
    const s = (d.status || '').toLowerCase();
    return s === 'available' || s === 'in use';
  }).length;
  const totalAssetValue = data
    .filter(d => {
      const s = (d.status || '').toLowerCase();
      return s !== 'disposed' && s !== 'sold';
    })
    .reduce((acc, curr) => acc + (parseFloat(curr.purchase_price) || 0), 0);
  const categoriesCount = new Set(data.map(d => d.category).filter(Boolean)).size;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-card w-12 h-12" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-transparent border border-border rounded-3xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded-full w-48 mb-6" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-border last:border-0">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded-full w-1/3" />
                <div className="h-3 bg-card rounded-full w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-6 animate-fade-in relative">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-foreground flex shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Assets</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              <AnimatedNumber value={totalAssets} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-emerald-100/70 text-emerald-700 dark:bg-green-500/10 dark:text-green-400 flex shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Active / In Use</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-green-400">
              <AnimatedNumber value={inUseOrAvailable} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-purple-100/70 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 flex shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Asset Categories</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              <AnimatedNumber value={categoriesCount} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 shadow-xs hover:shadow-md transition-all">
          <div className="p-3.5 rounded-2xl bg-blue-100/70 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 flex shrink-0">
            <MdInfoOutline className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Asset Value</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {formatLKR(totalAssetValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      {dynamicCategories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
                activeCategory.trim().toLowerCase() === cat.trim().toLowerCase()
                  ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                  : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Assets Table / Empty State */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        {filteredData.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {activeCategory !== "All"
                ? `No assets found in "${activeCategory}"`
                : "No Business Assets Recorded"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              {activeCategory !== "All"
                ? "Try clearing the category filter or searching with a different term."
                : "Record internal company property, IT equipment, furniture, and office appliances with serial numbers, warranties, and expense receipts."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {activeCategory !== "All" ? (
                <button
                  onClick={() => setActiveCategory("All")}
                  className="px-4 py-2 text-xs font-semibold text-brand-500 bg-brand-500/10 hover:bg-brand-500/20 rounded-xl transition-colors cursor-pointer"
                >
                  Clear category filter
                </button>
              ) : (
                role !== 'Viewer' && (
                  <button
                    onClick={openNew}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-sm transition-all active:scale-95 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Business Asset</span>
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm">Asset Details</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm">Category</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm">Status</th>
                  <th
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm hidden sm:table-cell cursor-pointer select-none hover:text-foreground transition-colors group"
                    title={`Sort by Purchase Date (${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'})`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Purchase Cost</span>
                      {sortOrder === 'desc' ? (
                        <ArrowDown className="w-3.5 h-3.5 text-brand-500" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 text-brand-500" />
                      )}
                    </div>
                  </th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm hidden lg:table-cell">Expense & Receipts</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-600 dark:text-gray-400 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredData.map((item) => {
                  let statusColor = "bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20";
                  const st = (item.status || '').toLowerCase();
                  if (st === 'available') statusColor = "bg-emerald-100/70 text-emerald-700 border-emerald-200/60 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/20";
                  if (st === 'in use') statusColor = "bg-blue-100/70 text-blue-700 border-blue-200/60 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/20";
                  if (st === 'maintenance') statusColor = "bg-amber-100/70 text-amber-700 border-amber-200/60 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/20";
                  if (st === 'damaged' || st === 'broken' || st === 'lost') statusColor = "bg-red-100/70 text-red-700 border-red-200/60 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/20";
                  if (st === 'disposed' || st === 'sold') statusColor = "bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20";
                  
                  const hasDocs = item.expense_receipt_url || item.warranty_letter_url;

                  return (
                    <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-card transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                          <span>{item.item_name}</span>
                          {item.quantity > 1 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-normal">
                              Qty: {item.quantity}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.sku && (
                            <span className="font-mono text-brand-600 dark:text-brand-400 font-semibold">{item.sku}</span>
                          )}
                          {item.serial_number && (
                            <span className="font-mono">SN: {item.serial_number}</span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              {item.location}
                            </span>
                          )}
                          {item.assigned_to && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <User className="w-3 h-3 text-gray-400" />
                              {item.assigned_to}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-black/5 dark:bg-white/5 border border-border">
                          {item.category || "General"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                          {item.status || "Available"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {item.purchase_price !== null && item.purchase_price !== undefined ? (
                          <div className="font-bold text-foreground">{formatLKR(item.purchase_price)}</div>
                        ) : (
                          <div className="text-gray-400 text-xs">—</div>
                        )}
                        {item.purchase_date && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Purchased: {new Date(item.purchase_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 hidden lg:table-cell">
                        {item.expense_id ? (
                          <div className="flex flex-col gap-1">
                            {item.expense_desc && (
                              <span className="text-xs text-gray-600 dark:text-gray-300 max-w-[180px] truncate" title={item.expense_desc}>
                                {item.expense_desc}
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-white/10 dark:text-foreground">
                                EXP-{item.expense_id}
                              </span>
                              {item.expense_receipt_url && (
                                <button
                                  type="button"
                                  onClick={() => setViewingDoc({ url: item.expense_receipt_url, title: `Receipt for ${item.item_name}` })}
                                  className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                                >
                                  <MdRemoveRedEye className="w-3 h-3" />
                                  <span>Receipt</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : item.warranty_letter_url ? (
                          <button
                            type="button"
                            onClick={() => setViewingDoc({ url: item.warranty_letter_url, title: `Warranty - ${item.item_name}` })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-emerald-600 dark:text-green-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Warranty File</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDocs && (
                            <button
                              onClick={() => { 
                                setViewingItem(item); 
                                setViewingItemTab(item.expense_receipt_url ? 'invoice' : 'warranty'); 
                              }}
                              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground rounded-xl transition-colors"
                              title="View Asset Details & Documents"
                            >
                              <MdRemoveRedEye className="w-4 h-4" />
                            </button>
                          )}
                          {role !== 'Viewer' && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground rounded-xl transition-colors"
                                title="Edit Asset"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                disabled={deletingId === item.id}
                                className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-xl transition-colors disabled:opacity-50"
                                title="Delete Asset"
                              >
                                {deletingId === item.id ? <Loader size="sm" /> : <MdDelete className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Asset Modal (Landscape Layout) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <h3 className="text-lg font-bold text-foreground">
                {editingId ? "Edit Business Asset" : "Add Business Asset"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Basic Details & Cost */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.item_name}
                      onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <input
                        type="text"
                        list="asset-categories"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                      />
                      <datalist id="asset-categories">
                        {DEFAULT_ASSET_CATEGORIES.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-foreground shadow-2xs"
                      >
                        <option value="Available">Available</option>
                        <option value="In Use">In Use</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Disposed">Disposed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number / Asset Tag</label>
                      <input
                        type="text"
                        value={formData.serial_number}
                        onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location / Room</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Staff</label>
                      <input
                        type="text"
                        value={formData.assigned_to}
                        onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        value={formData.purchase_date}
                        onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase / Asset Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchase_price}
                        onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Notes, Linked Expense, & Warranty Documents */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes & Specifications</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 min-h-[95px] shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link to Business Expense
                    </label>
                    <select
                      value={formData.expense_id}
                      onChange={e => setFormData(prev => ({ ...prev, expense_id: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500 shadow-2xs"
                    >
                      <option value="" className="bg-card text-gray-400">— None —</option>
                      {expenses.map(exp => (
                        <option key={exp.id} value={String(exp.id)} className="bg-card text-foreground">
                          {exp.date} · {exp.description} · {formatLKR(exp.amount)}
                        </option>
                      ))}
                    </select>
                    {formData.expense_id && (() => {
                      const linked = expenses.find(e => String(e.id) === formData.expense_id);
                      return linked?.receipt_url ? (
                        <div className="mt-2 flex items-center gap-2">
                          <button 
                            type="button" 
                            onClick={() => setViewingDoc({ url: linked.receipt_url, title: 'Purchase Receipt' })} 
                            className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors font-medium cursor-pointer"
                          >
                            <MdRemoveRedEye className="w-3.5 h-3.5" /> View Linked Receipt
                          </button>
                          <a 
                            href={linked.receipt_url} 
                            download 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-gray-500 hover:text-foreground transition-colors" 
                            title="Download Receipt"
                          >
                            <MdDownload className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : linked ? (
                        <p className="mt-1 text-xs text-gray-500">No receipt file uploaded on this expense.</p>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Warranty Document or Manual
                    </label>
                    {formData.warranty_letter_url ? (
                      <div className="flex items-center gap-2 bg-black/[0.02] dark:bg-card border border-border rounded-xl px-3 py-2">
                        <MdInsertDriveFile className="w-4 h-4 text-emerald-600 dark:text-green-400 shrink-0" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">Warranty Document Uploaded</span>
                        <button 
                          type="button" 
                          onClick={() => setViewingDoc({ url: formData.warranty_letter_url, title: 'Warranty Document' })} 
                          className="p-1 text-gray-400 hover:text-foreground transition-colors cursor-pointer" 
                          title="View"
                        >
                          <MdRemoveRedEye className="w-3.5 h-3.5" />
                        </button>
                        <a 
                          href={formData.warranty_letter_url} 
                          download 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-1 text-gray-400 hover:text-foreground transition-colors" 
                          title="Download"
                        >
                          <MdDownload className="w-3.5 h-3.5" />
                        </a>
                        <button 
                          type="button" 
                          onClick={() => setFormData(prev => ({ ...prev, warranty_letter_url: '' }))} 
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" 
                          title="Remove"
                        >
                          <MdClose className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex items-center gap-2 bg-card hover:bg-black/5 dark:hover:bg-white/10 border border-dashed border-border px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-gray-500 dark:text-gray-400 shadow-2xs">
                        {uploadingWarranty ? <Loader size="sm" /> : <MdUpload className="w-4 h-4" />}
                        {uploadingWarranty ? 'Uploading...' : 'Upload Warranty Document'}
                        {plan !== 'Pro Plus' && (
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-brand-600 dark:text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-md">Pro Plus</span>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*,application/pdf" 
                          onChange={handleUploadWarranty} 
                          disabled={uploadingWarranty || plan !== 'Pro Plus'} 
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 mt-6 border-t border-border flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-card transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {saving && <Loader size="sm" />}
                  {editingId ? 'Update Asset' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingItem(null)}>
          <div className="bg-card border border-border rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
            
            {/* Left Panel — Asset Info */}
            <div className="w-full md:w-80 shrink-0 bg-black/[0.02] dark:bg-card border-b md:border-b-0 md:border-r border-border p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-tight">{viewingItem.item_name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Asset Specifications</p>
                </div>
                <button onClick={() => setViewingItem(null)} className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-card transition-colors shrink-0 mt-0.5">
                  <MdClose className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {viewingItem.category && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Category</p>
                    <p className="text-sm text-foreground font-medium">{viewingItem.category}</p>
                  </div>
                )}
                {viewingItem.serial_number && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Serial / Tag Number</p>
                    <p className="text-sm text-foreground font-mono">{viewingItem.serial_number}</p>
                  </div>
                )}
                {viewingItem.location && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Location</p>
                    <p className="text-sm text-foreground font-medium">{viewingItem.location}</p>
                  </div>
                )}
                {viewingItem.assigned_to && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Assigned Staff</p>
                    <p className="text-sm text-foreground font-medium">{viewingItem.assigned_to}</p>
                  </div>
                )}
                {viewingItem.status && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Status</p>
                    <p className="text-sm text-foreground font-medium">{viewingItem.status}</p>
                  </div>
                )}
                {viewingItem.purchase_price !== null && viewingItem.purchase_price !== undefined && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Purchase Cost</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-brand-400">{formatLKR(viewingItem.purchase_price)}</p>
                  </div>
                )}
                {viewingItem.purchase_date && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Purchase Date</p>
                    <p className="text-sm text-foreground">{new Date(viewingItem.purchase_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                )}
                {viewingItem.expense_desc && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Linked Expense</p>
                    <p className="text-sm text-foreground">{viewingItem.expense_desc}</p>
                    {viewingItem.expense_amount && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatLKR(viewingItem.expense_amount)}</p>}
                  </div>
                )}
                {viewingItem.notes && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{viewingItem.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel — Tabs for Invoice / Warranty */}
            <div className="flex-1 flex flex-col overflow-hidden bg-card">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-6 pt-5 border-b border-border shrink-0">
                {viewingItem.expense_receipt_url && (
                  <button
                    onClick={() => setViewingItemTab('invoice')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                      viewingItemTab === 'invoice' 
                        ? 'border-brand-500 text-foreground font-bold' 
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-foreground'
                    }`}
                  >
                    Purchase Receipt
                  </button>
                )}
                {viewingItem.warranty_letter_url && (
                  <button
                    onClick={() => setViewingItemTab('warranty')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                      viewingItemTab === 'warranty' 
                        ? 'border-brand-500 text-foreground font-bold' 
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-foreground'
                    }`}
                  >
                    Warranty Document
                  </button>
                )}
                <div className="flex-1" />
                {viewingItemTab === 'invoice' && viewingItem.expense_receipt_url && (
                  <a href={viewingItem.expense_receipt_url} download target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-black/5 dark:hover:bg-white/10 border border-border rounded-xl transition-colors text-foreground shadow-2xs">
                    <MdDownload className="w-3.5 h-3.5" /> Download
                  </a>
                )}
                {viewingItemTab === 'warranty' && viewingItem.warranty_letter_url && (
                  <a href={viewingItem.warranty_letter_url} download target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-black/5 dark:hover:bg-white/10 border border-border rounded-xl transition-colors text-foreground shadow-2xs">
                    <MdDownload className="w-3.5 h-3.5" /> Download
                  </a>
                )}
              </div>

              {/* Document viewer */}
              <div className="flex-1 overflow-auto bg-black/5 dark:bg-black/40 p-4 flex items-center justify-center">
                {viewingItemTab === 'invoice' && viewingItem.expense_receipt_url && (
                  viewingItem.expense_receipt_url.match(/\.pdf/i)
                    ? <iframe src={viewingItem.expense_receipt_url} className="w-full h-full min-h-[60vh] rounded-xl border border-border bg-white" title="Purchase Receipt" />
                    : <Image src={viewingItem.expense_receipt_url} alt="Purchase Receipt" className="max-w-full max-h-[70vh] object-contain rounded-xl" width={800} height={800} unoptimized={true} />
                )}
                {viewingItemTab === 'warranty' && viewingItem.warranty_letter_url && (
                  viewingItem.warranty_letter_url.match(/\.pdf/i)
                    ? <iframe src={viewingItem.warranty_letter_url} className="w-full h-full min-h-[60vh] rounded-xl border border-border bg-white" title="Warranty Document" />
                    : <Image src={viewingItem.warranty_letter_url} alt="Warranty Document" className="max-w-full max-h-[70vh] object-contain rounded-xl" width={800} height={800} unoptimized={true} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingDoc(null)}>
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{viewingDoc.title}</h3>
              <div className="flex items-center gap-2">
                <a href={viewingDoc.url} download target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-card transition-colors" title="Download">
                  <MdDownload className="w-5 h-5" />
                </a>
                <button onClick={() => setViewingDoc(null)} className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-card transition-colors">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 dark:bg-black/50">
              {viewingDoc.url.match(/\.pdf/i) ? (
                <iframe src={viewingDoc.url} className="w-full h-[75vh] rounded-xl border border-border bg-white" title={viewingDoc.title} />
              ) : (
                <Image src={viewingDoc.url} alt={viewingDoc.title} className="max-w-full max-h-[75vh] object-contain rounded-xl" width={800} height={800} unoptimized={true} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (plan !== 'Pro Plus') {
    return (
      <UpgradeOverlay
        title="Business Assets Management"
        description="Track internal company property, equipment, furniture, warranties, and link purchases to expense receipts. Upgrade to Pro Plus to unlock this feature."
        requiredPlan="Pro Plus"
      >
        {content}
      </UpgradeOverlay>
    );
  }

  return content;
}
