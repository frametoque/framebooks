"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo } from "react";
import { Edit2, Loader2, CheckCircle2, Box, Link2 } from "lucide-react";
import { MdSearch, MdAdd, MdDelete, MdClose, MdInventory2, MdInfoOutline, MdDownload, MdInsertDriveFile, MdRemoveRedEye, MdUpload } from "react-icons/md";
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, uploadInventoryDocument, getExpensesForLinking } from "../actions/inventory";
import AnimatedNumber from "../components/AnimatedNumber";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useAppLock } from "../components/AppLockProvider";
import { useRole } from "../context/RoleContext";
import { PlanType } from "@/lib/plans";
import { getTenantPlan } from "../actions/plan";
import { UpgradeOverlay } from "../components/UpgradeOverlay";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

const emptyForm = { item_name: '', category: '', serial_number: '', quantity: 1, status: 'Available', purchase_date: '', purchase_price: '', notes: '', warranty_letter_url: '', expense_id: '' };

export default function InventoryPage() {
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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, exp, currentPlan] = await Promise.all([getInventoryItems(), getExpensesForLinking(), getTenantPlan()]);
      setData(res);
      setExpenses(exp);
      setPlan(currentPlan);
    } catch (e) {
      console.error("Failed to load inventory", e);
    } finally {
      setLoading(false);
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
        console.error("Failed to load inventory", e);
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
    window.addEventListener("inventory:search", handleSearch);
    window.addEventListener("inventory:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("inventory:search", handleSearch);
      window.removeEventListener("inventory:open-new", handleOpenNew);
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
      serial_number: item.serial_number || '',
      quantity: item.quantity || 1,
      status: item.status || 'Available',
      purchase_date: item.purchase_date ? new Date(item.purchase_date).toISOString().split('T')[0] : '',
      purchase_price: item.purchase_price || '',
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
      alert('Failed to upload warranty letter');
    } finally {
      setUploadingWarranty(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, quantity: parseInt(formData.quantity.toString()) || 1, purchase_price: parseFloat(formData.purchase_price) || null };
      if (editingId) {
        await updateInventoryItem(editingId, payload);
      } else {
        await createInventoryItem(payload);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!await confirm(`Delete "${item.item_name}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    try {
      await deleteInventoryItem(item.id, item.item_name);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete item.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter(d => 
      (d.item_name || '').toLowerCase().includes(lower) ||
      (d.category || '').toLowerCase().includes(lower) ||
      (d.serial_number || '').toLowerCase().includes(lower)
    );
  }, [data, searchTerm]);

  const totalItems = data.length;
  const availableItems = data.filter(d => d.status === 'Available').length;
  const totalValue = data.reduce((acc, curr) => acc + (parseFloat(curr.purchase_price) || 0), 0);
  const categories = new Set(data.map(d => d.category)).size;

  if (loading) {
    return (
      <div className="space-y-4">
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
        <div className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
          <div className="text-foreground flex shrink-0">
            <MdInventory2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Total Items</p>
            <p className="text-2xl font-bold mt-1">
              <AnimatedNumber value={totalItems} />
            </p>
          </div>
        </div>
        <div className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
          <div className="text-foreground flex shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Available</p>
            <p className="text-2xl font-bold mt-1">
              <AnimatedNumber value={availableItems} />
            </p>
          </div>
        </div>
        <div className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Categories</p>
            <p className="text-2xl font-bold mt-1">
              <AnimatedNumber value={categories} />
            </p>
          </div>
        </div>
        <div className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
          <div className="text-foreground flex shrink-0">
            <MdInfoOutline className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Est. Value</p>
            <p className="text-2xl font-bold mt-1">
              {formatLKR(totalValue)}
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden backdrop-blur-xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Inventory List</h2>
        </div>
        
        {filteredData.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <MdInventory2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No inventory items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm">Item</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm">Category</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm">Status</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm hidden sm:table-cell">Purchase Info</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm hidden lg:table-cell">Expense</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-400 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  let statusColor = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                  if (item.status === 'Available') statusColor = "bg-white/10 text-foreground border-green-500/20";
                  if (item.status === 'Maintenance') statusColor = "bg-white/10 text-foreground border-amber-500/20";
                  if (item.status === 'Lost') statusColor = "bg-white/10 text-foreground border-red-500/20";
                  if (item.status === 'Broken') statusColor = "bg-white/10 text-foreground border-red-500/20";
                  const hasDocs = item.expense_receipt_url || item.warranty_letter_url;

                  return (
                    <tr key={item.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-foreground">{item.item_name}</div>
                        {item.serial_number && <div className="text-xs text-gray-400 mt-1">SN: {item.serial_number}</div>}
                        {item.quantity > 1 && <div className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</div>}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-300">{item.category}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-400 hidden sm:table-cell">
                        {item.purchase_date && <div>{new Date(item.purchase_date).toLocaleDateString()}</div>}
                        {item.purchase_price && <div className="text-gray-300">{formatLKR(item.purchase_price)}</div>}
                      </td>
                      <td className="py-4 px-6 hidden lg:table-cell">
                        {item.expense_id ? (
                          <div className="flex flex-col gap-1">
                            {item.expense_desc && (
                              <span className="text-xs text-gray-400 max-w-[160px] truncate">{item.expense_desc}</span>
                            )}
                            <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono bg-white/10 text-foreground border border-amber-500/20">
                              EXP-{item.expense_id}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasDocs && (
                            <button
                              onClick={() => { setViewingItem(item); setViewingItemTab(item.expense_receipt_url ? 'invoice' : 'warranty'); }}
                              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-foreground rounded-xl transition-colors"
                              title="View Details"
                            >
                              <MdRemoveRedEye className="w-4 h-4" />
                            </button>
                          )}
                          {role !== 'Viewer' && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                className="p-2 hover:bg-brand-500/20 text-gray-400 hover:text-brand-400 rounded-xl transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                disabled={deletingId === item.id}
                                className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors"
                                title="Delete"
                              >
                                {deletingId === item.id ? <Loader size="sm" /> : <MdDelete className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Item' : 'Add Item'}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-card transition-colors"
              >
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Item Name *</label>
                <input
                  required
                  type="text"
                  value={formData.item_name}
                  onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="e.g. Sony A7IV"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
                  <input
                    required
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    placeholder="e.g. Camera"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-foreground"
                  >
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Lost">Lost</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Purchase Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 min-h-[100px]"
                  placeholder="Additional details..."
                />
              </div>

              <div className="border-t border-border pt-4 mt-2 space-y-3">
                {/* Linked Expense */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Link to Expense</label>
                  <select
                    value={formData.expense_id}
                    onChange={e => setFormData(prev => ({ ...prev, expense_id: e.target.value }))}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— None —</option>
                    {expenses.map(exp => (
                      <option key={exp.id} value={String(exp.id)}>
                        {exp.date} · {exp.description} · {formatLKR(exp.amount)}
                      </option>
                    ))}
                  </select>
                  {formData.expense_id && (() => {
                    const linked = expenses.find(e => String(e.id) === formData.expense_id);
                    return linked?.receipt_url ? (
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => setViewingDoc({ url: linked.receipt_url, title: 'Purchase Invoice' })} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                          <MdRemoveRedEye className="w-3.5 h-3.5" /> View Invoice
                        </button>
                        <a href={linked.receipt_url} download target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-foreground transition-colors" title="MdDownload Invoice">
                          <MdDownload className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : linked ? (
                      <p className="mt-1 text-xs text-gray-500">No invoice uploaded on this expense.</p>
                    ) : null;
                  })()}
                </div>

                {/* Warranty MdUpload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Warranty Letter</label>
                  {formData.warranty_letter_url ? (
                    <div className="flex items-center gap-2 bg-transparent border border-border rounded-xl px-3 py-2">
                      <MdInsertDriveFile className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-xs text-gray-300 truncate flex-1">Uploaded</span>
                      <button type="button" onClick={() => setViewingDoc({ url: formData.warranty_letter_url, title: 'Warranty Letter' })} className="p-1 text-gray-400 hover:text-foreground transition-colors" title="View">
                        <MdRemoveRedEye className="w-3.5 h-3.5" />
                      </button>
                      <a href={formData.warranty_letter_url} download target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-foreground transition-colors" title="MdDownload">
                        <MdDownload className="w-3.5 h-3.5" />
                      </a>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, warranty_letter_url: '' }))} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Remove">
                        <MdClose className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center gap-2 bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-dashed border-black/20 dark:border-white/20 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-gray-400">
                      {uploadingWarranty ? <Loader size="sm" /> : <MdUpload className="w-4 h-4" />}
                      {uploadingWarranty ? 'Uploading...' : 'MdUpload Warranty Letter'}
                      {plan !== 'Pro Plus' && (
                        <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-md">Pro Plus</span>
                      )}
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadWarranty} disabled={uploadingWarranty || plan !== 'Pro Plus'} />
                    </label>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-400 text-brand-900 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader size="sm" />}
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingItem(null)}>
          <div className="bg-[#0c0c0e] border border-border rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
            
            {/* Left Panel — Item MdInfoOutline */}
            <div className="w-full md:w-72 shrink-0 bg-[#111111] border-b md:border-b-0 md:border-r border-border p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-tight">{viewingItem.item_name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Item Information</p>
                </div>
                <button onClick={() => setViewingItem(null)} className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-card transition-colors shrink-0 mt-0.5">
                  <MdClose className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {viewingItem.category && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Category</p>
                    <p className="text-sm text-foreground">{viewingItem.category}</p>
                  </div>
                )}
                {viewingItem.serial_number && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Serial Number</p>
                    <p className="text-sm text-foreground font-mono">{viewingItem.serial_number}</p>
                  </div>
                )}
                {viewingItem.status && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Status</p>
                    <p className="text-sm text-foreground">{viewingItem.status}</p>
                  </div>
                )}
                {viewingItem.purchase_price && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Purchase Cost</p>
                    <p className="text-2xl font-bold text-brand-400">{formatLKR(viewingItem.purchase_price)}</p>
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
                    {viewingItem.expense_amount && <p className="text-xs text-gray-400 mt-0.5">{formatLKR(viewingItem.expense_amount)}</p>}
                  </div>
                )}
                {viewingItem.notes && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-0.5">Notes</p>
                    <p className="text-sm text-gray-300 whitespace-pre-line">{viewingItem.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel — Tabs for Invoice / Warranty */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-6 pt-5 border-b border-border shrink-0">
                {viewingItem.expense_receipt_url && (
                  <button
                    onClick={() => setViewingItemTab('invoice')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${viewingItemTab === 'invoice' ? 'border-brand-500 text-foreground' : 'border-transparent text-gray-400 hover:text-foreground'}`}
                  >
                    Purchase Invoice
                  </button>
                )}
                {viewingItem.warranty_letter_url && (
                  <button
                    onClick={() => setViewingItemTab('warranty')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${viewingItemTab === 'warranty' ? 'border-green-500 text-foreground' : 'border-transparent text-gray-400 hover:text-foreground'}`}
                  >
                    Warranty Letter
                  </button>
                )}
                <div className="flex-1" />
                {/* MdDownload button for active tab */}
                {viewingItemTab === 'invoice' && viewingItem.expense_receipt_url && (
                  <a href={viewingItem.expense_receipt_url} download target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-border rounded-xl transition-colors text-gray-300">
                    <MdDownload className="w-3.5 h-3.5" /> MdDownload
                  </a>
                )}
                {viewingItemTab === 'warranty' && viewingItem.warranty_letter_url && (
                  <a href={viewingItem.warranty_letter_url} download target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-border rounded-xl transition-colors text-gray-300">
                    <MdDownload className="w-3.5 h-3.5" /> MdDownload
                  </a>
                )}
              </div>

              {/* Document viewer */}
              <div className="flex-1 overflow-auto bg-black/40 p-4 flex items-center justify-center">
                {viewingItemTab === 'invoice' && viewingItem.expense_receipt_url && (
                  viewingItem.expense_receipt_url.match(/\.pdf/i)
                    ? <iframe src={viewingItem.expense_receipt_url} className="w-full h-full min-h-[60vh] rounded-xl border border-border" title="Purchase Invoice" />
                    : <img src={viewingItem.expense_receipt_url} alt="Purchase Invoice" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
                )}
                {viewingItemTab === 'warranty' && viewingItem.warranty_letter_url && (
                  viewingItem.warranty_letter_url.match(/\.pdf/i)
                    ? <iframe src={viewingItem.warranty_letter_url} className="w-full h-full min-h-[60vh] rounded-xl border border-border" title="Warranty Letter" />
                    : <img src={viewingItem.warranty_letter_url} alt="Warranty Letter" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingDoc(null)}>
          <div className="bg-[#111111] border border-border rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="text-sm font-semibold truncate">{viewingDoc.title}</h3>
              <div className="flex items-center gap-2">
                <a href={viewingDoc.url} download target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-card transition-colors" title="MdDownload">
                  <MdDownload className="w-5 h-5" />
                </a>
                <button onClick={() => setViewingDoc(null)} className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-card transition-colors">
                  <MdClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
              {viewingDoc.url.match(/\.pdf/i) ? (
                <iframe src={viewingDoc.url} className="w-full h-[75vh] rounded-xl border border-border" title={viewingDoc.title} />
              ) : (
                <img src={viewingDoc.url} alt={viewingDoc.title} className="max-w-full max-h-[75vh] object-contain rounded-xl" />
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
        title="Inventory Management"
        description="Track physical assets, manage warranties, and link purchases to expenses. Upgrade to Pro Plus to unlock this feature."
        requiredPlan="Pro Plus"
      >
        {content}
      </UpgradeOverlay>
    );
  }

  return content;
}
