"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo } from "react";
import { Edit2, Loader2, FilePlus, Trash } from "lucide-react";
import { MdAccountBalanceWallet, MdTrendingUp, MdCalendarToday, MdAdd, MdDelete, MdInsertDriveFile, MdClose, MdRemoveRedEye } from "react-icons/md";
import ClientCombobox from "../components/ClientCombobox";
import Link from "next/link";
import { getIncomes, createIncome, deleteIncome, updateIncome, uploadReceipt, getClients, createClient, createInvoice, getInvoices, getLimitStatus } from "../actions/actions";
import { getAccounts } from "../actions/accounts";
import { getTenantInfo } from "../actions/tenants";
import { useRole } from "../context/RoleContext";
import { getCategories } from "../actions/categories";
import CategoryPicker from "../components/CategoryPicker";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAdminDateRange } from "../context/AdminDateRangeContext";
import { useAppLock } from "../components/AppLockProvider";
import { useConfirm } from '@/components/ui/ConfirmProvider';

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

// Helper: parse stored comma-separated category string → array
const parseCategories = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

// Helper: array → comma-separated string for storage
const joinCategories = (cats: string[]): string => cats.join(", ");

interface LineItem {
  name: string;
  qty: number;
  rate: number;
}

const convertPdfToImage = async (file: File): Promise<File> => {
  if (file.type !== "application/pdf") return file;

  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load PDF.js"));
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create canvas context");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to convert PDF canvas to blob"));
        return;
      }
      const newFilename = file.name.replace(/\.[^/.]+$/, "") + ".png";
      const convertedFile = new File([blob], newFilename, { type: "image/png" });
      resolve(convertedFile);
    }, "image/png");
  });
};

export default function IncomePage() {
  const { confirm } = useConfirm();
  const { requireAuth } = useAppLock();
  const [activeFilter, setActiveFilter] = useState("All");
  const [serverCategories, setServerCategories] = useState<string[]>([]);
  const filters = ["All", ...serverCategories];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { role } = useRole();
  const { startDate, endDate } = useAdminDateRange();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [tenantPlan, setTenantPlan] = useState<string>("Free");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    clientId: '',
    description: '',
    paymentMethod: 'Bank Transfer',
    accountId: '',
    invoiceId: '',
    receiptUrl: '',
  });

  const filteredInvoicesList = useMemo(() => {
    const unpaidInvoices = invoicesList.filter((inv: any) => {
      const status = (inv.status || '').toLowerCase();
      return status !== 'paid' && status !== 'fully paid';
    });

    if (!formData.clientId || formData.clientId === 'new') {
      return unpaidInvoices;
    }
    const clientObj = clients.find((c: any) => c.id === formData.clientId);
    if (!clientObj?.email) return unpaidInvoices;
    const clientEmail = clientObj.email.toLowerCase();
    return unpaidInvoices.filter((inv: any) => {
      const email = (inv.clientEmail || inv.client_email || '').toLowerCase();
      return email === clientEmail;
    });
  }, [invoicesList, formData.clientId, clients]);

  // --- Create Invoice from Income ---
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSourceRow, setInvoiceSourceRow] = useState<any>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ name: '', qty: 1, rate: 0 }]);
  const [invoiceFormData, setInvoiceFormData] = useState({
    clientName: '',
    userEmail: '',
    projectName: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'LKR',
    discount: 0,
    advance: 0,
    bankAccountId: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, cls, accs, invsData, cats, tInfo] = await Promise.all([getIncomes(startDate, endDate), getClients(), getAccounts(), getInvoices(), getCategories(), getTenantInfo()]);
      setServerCategories(cats);
      setData(res);
      setClients(cls);
      setBankAccounts(accs);
      setInvoicesList(invsData?.items || []);
      setTenantPlan(tInfo?.plan || "Free");
    } catch (e) {
      console.error("Failed to load incomes", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    getLimitStatus('incomes').then(status => {
      if (!status.allowed) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: status.error }));
      }
    });
  }, [startDate, endDate]);

  const openNew = () => {
    setEditingId(null);
    const defaultAcc = bankAccounts.find((a: any) => a.isDefault) ;
    setFormData({ date: new Date().toISOString().split('T')[0], amount: '', clientId: '', description: '', paymentMethod: 'Bank Transfer',
    accountId: defaultAcc ? String(defaultAcc.id) : '', invoiceId: '', receiptUrl: '' });
    setSelectedCategories([]);
    setNewClientName(''); setNewClientEmail(''); setNewClientCompany(''); setNewClientPhone('');
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleEdit = (row: any) => {
    let formattedDate = row.rawDate || '';
    if (!formattedDate && row.date) {
      if (typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.date)) {
        formattedDate = row.date.split('T')[0];
      } else {
        const dt = new Date(row.date);
        if (!isNaN(dt.getTime())) {
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const d = String(dt.getDate()).padStart(2, '0');
          formattedDate = `${y}-${m}-${d}`;
        }
      }
    }
    if (!formattedDate) {
      formattedDate = new Date().toISOString().split('T')[0];
    }
    setEditingId(row.id);
    setFormData({ date: formattedDate, amount: row.amount.toString(), clientId: row.clientId || '', description: row.desc || '', paymentMethod: row.paymentMethod || 'Bank Transfer',
    accountId: row.accountId || row.bank_account_id || '', invoiceId: row.invoice || '', receiptUrl: row.receiptUrl || '' });
    setSelectedCategories(parseCategories(row.category));
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) { alert("Please select at least one category."); return; }
    setSaving(true);
    try {
      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        const fileData = new FormData();
        fileData.append('file', receiptFile);
        uploadedUrl = await uploadReceipt(fileData, 'income');
      }

      let clientId = formData.clientId;
      if (clientId === 'new') {
        const clientRes = await createClient({ name: newClientName, email: newClientEmail, company: newClientCompany || null, phone: newClientPhone || null });
        if (typeof clientRes === 'object' && clientRes?.error) throw new Error(clientRes.error);
        clientId = clientRes;
      }

      const payload = {
        ...formData,
        clientId,
        amount: parseFloat(formData.amount) || 0,
        category: joinCategories(selectedCategories),
        receiptUrl: uploadedUrl,
      };

      let res;
      if (editingId) { res = await updateIncome(editingId, payload); } 
      else { res = await createIncome(payload); }
      if (res?.error) throw new Error(res.error);

      setIsModalOpen(false);
      setEditingId(null);
      setReceiptFile(null);
      await loadData();
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("LIMIT_EXCEEDED")) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: e.message }));
      } else {
        alert('Failed to save income');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (await confirm("Are you sure you want to delete this record?")) {
      requireAuth(async () => {
        try { await deleteIncome(id); await loadData(); } catch (e) { console.error("Failed to delete", e); }
      });
    }
  };

  // --- Invoice Modal Helpers ---
  const openInvoiceModal = (row: any) => {
    setInvoiceSourceRow(row);

    // Find matching client email
    const matchedClient = clients.find(c => c.id === row.clientId);

    const defBank = bankAccounts.find((a: any) => a.is_default === 1);
    setInvoiceFormData({
      clientName: row.client || matchedClient?.name || '',
      userEmail: matchedClient?.email || '',
      projectName: row.desc || '',
      date: new Date().toISOString().split('T')[0],
      currency: 'LKR',
      discount: 0,
      advance: 0,
      bankAccountId: defBank ? String(defBank.id) : '',
    });

    // Pre-populate a single line item from the income row
    setLineItems([{
      name: row.desc || 'Service',
      qty: 1,
      rate: parseFloat(row.amount) || 0,
    }]);

    setInvoiceModalOpen(true);
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { name: '', qty: 1, rate: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const lineItemsSubtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  const invoiceTotal = lineItemsSubtotal - (invoiceFormData.discount || 0);
  const invoiceDue = invoiceTotal - (invoiceFormData.advance || 0);

  const handleCreateInvoice = async () => {
    if (!invoiceFormData.userEmail) {
      alert('Please enter a client email.');
      return;
    }
    if (lineItems.every(item => !item.name)) {
      alert('Please add at least one line item.');
      return;
    }

    setCreatingInvoice(true);
    try {
      const invoiceData = {
        userEmail: invoiceFormData.userEmail,
        clientName: invoiceFormData.clientName,
        projectName: invoiceFormData.projectName,
        date: invoiceFormData.date,
        subtotal: lineItemsSubtotal,
        discount: invoiceFormData.discount || 0,
        total: invoiceTotal,
        advance: invoiceFormData.advance || 0,
        totalDue: invoiceDue,
        workStatus: 'completed',
        paymentStatus: 'paid',
        currency: invoiceFormData.currency,
        category: invoiceSourceRow?.category || null,
        bankAccountId: invoiceFormData.bankAccountId || null,
      };

      const mappedLineItems = lineItems
        .filter(item => item.name)
        .map(item => ({
          description: item.name,
          quantity: item.qty,
          rate: item.rate,
        }));

      const result = await createInvoice(invoiceData, mappedLineItems);

      // Link the created invoice back to the income record
      if (result?.invoiceId && invoiceSourceRow?.id) {
        const incomePayload = {
          date: invoiceSourceRow.date,
          amount: invoiceSourceRow.amount,
          clientId: invoiceSourceRow.clientId || '',
          description: invoiceSourceRow.desc || '',
          paymentMethod: invoiceSourceRow.paymentMethod || 'Bank Transfer',
          invoiceId: result.invoiceId,
          receiptUrl: invoiceSourceRow.receiptUrl || '',
          category: invoiceSourceRow.category || '',
        };
        await updateIncome(invoiceSourceRow.id, incomePayload);
      }

      setInvoiceModalOpen(false);
      setInvoiceSourceRow(null);
      await loadData();
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("LIMIT_EXCEEDED")) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: e.message }));
      } else {
        alert('Failed to create invoice');
      }
    } finally {
      setCreatingInvoice(false);
    }
  };

  const dynamicCategories = useMemo(() => {
    if (!data?.items) return serverCategories;
    const all = new Set(serverCategories);
    data.items.forEach((item: any) => {
      parseCategories(item.category).forEach(c => all.add(c));
    });
    return Array.from(all);
  }, [data?.items]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse">
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
              <div className="h-6 bg-white/10 rounded-full w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "This Month", value: formatLKR(data.thisMonth), icon: MdAccountBalanceWallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Last Month", value: formatLKR(data.lastMonth), icon: MdCalendarToday, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Year to Date", value: formatLKR(data.ytd), icon: MdTrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];



  const dynamicFilters = ["All", ...dynamicCategories];

  // Filter: match if any of the row's categories includes the active filter
  const filteredIncome = data.items.filter((row: any) => {
    if (activeFilter === "All") return true;
    return parseCategories(row.category).includes(activeFilter);
  });

  return (
    <div className="space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-semibold"><AnimatedNumber value={stat.value} /></p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {dynamicFilters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${activeFilter === f ? "bg-brand-500 text-brand-900 border-brand-500 font-bold" : "bg-card text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"}`}>
              {f}
            </button>
          ))}
        </div>

        {role !== 'Viewer' && (
          <button onClick={openNew} className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors w-full sm:w-auto justify-center">
            <MdAdd className="w-5 h-5" /> Record Income
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-gray-400 text-sm">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium w-36">Categories</th>
                <th className="p-4 font-medium">Invoice</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredIncome.map((row: any) => (
                <tr key={row.id} className="hover:bg-card transition-colors">
                  <td className="p-4 text-sm">{row.date}</td>
                  <td className="p-4 font-semibold text-green-400">{formatLKR(row.amount)}</td>
                  <td className="p-4 text-sm">{row.client || '-'}</td>
                  <td className="p-4 text-sm text-gray-300">{row.desc}</td>
                  <td className="p-4 w-36">
                    <div className="flex flex-wrap gap-1 max-w-[144px]">
                      {parseCategories(row.category).map((cat) => (
                        <span key={cat} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/10 border border-border whitespace-nowrap">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    {row.invoice ? (
                      <Link href={`/user/invoice/${row.invoice}`} className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                        <MdInsertDriveFile className="w-4 h-4" />{row.invoice}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Receipt button (always takes up space) */}
                      {row.receiptUrl ? (
                        <button 
                          onClick={() => setViewingReceipt(row)} 
                          title="View Receipt"
                          className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                          <MdRemoveRedEye className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="w-8 h-8" /> // Keeps alignment
                      )}

                      {/* Create Invoice button */}
                      {role !== 'Viewer' && (
                        <button
                          onClick={() => openInvoiceModal(row)}
                          disabled={row.hasValidInvoice}
                          title={row.hasValidInvoice ? "Invoice already exists" : "Create Invoice"}
                          className={`p-2 rounded-xl transition-colors ${
                            row.hasValidInvoice 
                            ? "text-gray-600 opacity-40 cursor-not-allowed" 
                            : "text-gray-400 hover:text-brand-400 hover:bg-brand-400/10 cursor-pointer"
                        }`}
                      >
                        <FilePlus className="w-4 h-4" />
                        </button>
                      )}

                      {role !== 'Viewer' && (
                        <>
                          <button onClick={() => handleEdit(row)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground cursor-pointer">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-400/10 rounded-xl transition-colors text-gray-400 hover:text-red-400 cursor-pointer">
                            <MdDelete className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIncome.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">No income records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Income Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Income' : 'Record Income'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"><MdClose className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Amount (LKR)</label>
                  <input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Client</label>
                <ClientCombobox name="clientId" value={String(formData.clientId || "")} onChange={e => setFormData({ ...formData, clientId: e.target.value })} clients={clients} />
              </div>

              {formData.clientId === 'new' && (
                <div className="p-4 bg-card rounded-xl border border-border space-y-3">
                  <input type="text" placeholder="Client Name" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm" />
                  <input type="email" placeholder="Client Email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Company (Optional)" value={newClientCompany} onChange={e => setNewClientCompany(e.target.value)} className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm" />
                    <input type="text" placeholder="Phone (Optional)" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Description</label>
                <input type="text" placeholder="What was this for?" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Categories</label>
                <CategoryPicker categories={dynamicCategories} value={selectedCategories} onChange={setSelectedCategories} placeholder="Select categories..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                    <option className="bg-black">Bank Transfer</option>
                    <option className="bg-black">Stripe</option>
                    <option className="bg-black">PayPal</option>
                    <option className="bg-black">Cash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Account</label>
                  <select value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                    <option value="" className="bg-black">No Account (Unlinked)</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id} className="bg-black">{a.name} ({formatLKR(a.currentBalance || 0)})</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Linked Invoice (Optional)</label>
                <select
                  value={formData.invoiceId}
                  onChange={e => {
                    const invId = e.target.value;
                    const inv = invoicesList.find((i: any) => i.id === invId);
                    if (inv) {
                      const dueAmount = inv.total_due != null ? inv.total_due : inv.amount;
                      const clientMatch = clients.find((c: any) => c.email?.toLowerCase() === inv.client_email?.toLowerCase());
                      setFormData(prev => ({
                        ...prev,
                        invoiceId: inv.id,
                        amount: dueAmount > 0 ? dueAmount.toString() : inv.amount.toString(),
                        description: `Invoice #${inv.id} - ${inv.service || 'Payment'}`,
                        clientId: clientMatch ? clientMatch.id : prev.clientId
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, invoiceId: invId }));
                    }
                  }}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none text-foreground"
                >
                  <option value="" className="bg-black text-foreground">None / Select Invoice</option>
                  {filteredInvoicesList.map((inv: any) => (
                    <option key={inv.id} value={inv.id} className="bg-black text-foreground">
                      {inv.id} - {inv.service || 'Invoice'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">
                  {convertingPdf ? "Processing PDF..." : "Receipt Image / PDF"}
                  {tenantPlan !== 'Pro Plus' && (
                    <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-md">Pro Plus</span>
                  )}
                </label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  disabled={convertingPdf || tenantPlan !== 'Pro Plus'}
                  onChange={async (e) => {
                    const selected = e.target.files?.[0];
                    if (!selected) {
                      setReceiptFile(null);
                      return;
                    }
                    if (selected.type === "application/pdf") {
                      setConvertingPdf(true);
                      try {
                        const imgFile = await convertPdfToImage(selected);
                        setReceiptFile(imgFile);
                      } catch (err) {
                        console.error(err);
                        alert("Failed to convert PDF to image. Please upload a normal image.");
                      } finally {
                        setConvertingPdf(false);
                      }
                    } else {
                      setReceiptFile(selected);
                    }
                  }}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm disabled:opacity-50" 
                />
                {convertingPdf && (
                  <p className="text-xs text-brand-400 animate-pulse px-2">Converting PDF to Image...</p>
                )}
                {formData.receiptUrl && !receiptFile && (
                  <div className="flex items-center gap-3 mt-1 px-2">
                    <a href={formData.receiptUrl} target="_blank" className="text-xs text-blue-400 underline">View current receipt</a>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, receiptUrl: '' })}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      Delete current image
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-card">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-full font-medium hover:bg-card transition-colors" disabled={saving || convertingPdf}>Cancel</button>
              <button onClick={handleSave} disabled={saving || convertingPdf} className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-full font-bold transition-colors disabled:opacity-50">
                {saving && <Loader size="sm" />}
                {saving ? "Saving..." : (editingId ? "Update Income" : "Save Income")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/20">
                  <FilePlus className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Create Invoice</h2>
                </div>
              </div>
              <button onClick={() => setInvoiceModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                <MdClose className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Client Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Client Name</label>
                  <input
                    type="text"
                    placeholder="Client name"
                    value={invoiceFormData.clientName}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, clientName: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Client Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    placeholder="client@email.com"
                    value={invoiceFormData.userEmail}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, userEmail: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Project / Service Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Website Redesign"
                    value={invoiceFormData.projectName}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, projectName: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Date</label>
                  <input
                    type="date"
                    value={invoiceFormData.date}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, date: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Line Items</label>
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-500/20 hover:bg-brand-400/30 text-brand-400 rounded-lg transition-colors"
                  >
                    <MdAdd className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[1fr_80px_110px_80px] gap-2 px-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Name / Description</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Qty</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-right">Rate (LKR)</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-right">Total</span>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_110px_80px] gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={e => updateLineItem(index, 'name', e.target.value)}
                        className="bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={e => updateLineItem(index, 'qty', parseInt(e.target.value) || 1)}
                        className="bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors text-sm text-center"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={item.rate}
                        onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors text-sm text-right"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-sm font-medium text-green-400 text-right flex-1">
                          {formatLKR(item.qty * item.rate)}
                        </span>
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-1 hover:bg-red-400/10 rounded-lg transition-colors text-gray-600 hover:text-red-400"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Adjustments */}
              <div className="bg-transparent border border-border rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Discount (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={invoiceFormData.discount}
                      onChange={e => setInvoiceFormData({ ...invoiceFormData, discount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Advance Paid (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={invoiceFormData.advance}
                      onChange={e => setInvoiceFormData({ ...invoiceFormData, advance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border border-border rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span>{formatLKR(lineItemsSubtotal)}</span>
                  </div>
                  {invoiceFormData.discount > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Discount</span>
                      <span className="text-red-400">- {formatLKR(invoiceFormData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>Total</span>
                    <span className="text-foreground font-semibold">{formatLKR(invoiceTotal)}</span>
                  </div>
                  {invoiceFormData.advance > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Advance Paid</span>
                      <span className="text-blue-400">- {formatLKR(invoiceFormData.advance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                    <span>Total Due</span>
                    <span className="text-green-400">{formatLKR(invoiceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Bank Account — PDF only */}
              {bankAccounts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Payment Bank Account
                  </label>
                  <select
                    value={invoiceFormData.bankAccountId}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, bankAccountId: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none text-sm"
                  >
                    <option value="" className="bg-black">— No bank account —</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={String(acc.id)} className="bg-black">
                        {acc.name} · {acc.bank} · {acc.number}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-card">
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="px-6 py-2.5 rounded-full font-medium hover:bg-card transition-colors"
                disabled={creatingInvoice}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creatingInvoice}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-full font-bold transition-colors disabled:opacity-50"
              >
                {creatingInvoice ? <Loader size="sm" /> : <FilePlus className="w-4 h-4" />}
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
          <div className="relative flex flex-col md:flex-row bg-transparent border border-border rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-foreground transition-colors backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
              <MdClose className="w-5 h-5" />
            </button>
            <div className="w-full md:w-1/3 bg-card p-6 sm:p-8 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Receipt Details</h3>
                <p className="text-sm text-gray-400">Transaction Information</p>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Amount</p>
                  <p className="text-3xl font-bold text-green-400">{formatLKR(viewingReceipt.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-foreground">{viewingReceipt.date}</p>
                </div>
                {viewingReceipt.client && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Client</p>
                    <p className="text-sm font-medium text-foreground">{viewingReceipt.client}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseCategories(viewingReceipt.category).map((cat) => (
                      <span key={cat} className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 border border-border">{cat}</span>
                    ))}
                  </div>
                </div>
                {viewingReceipt.desc && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Description</p>
                    <p className="text-sm font-medium text-gray-300">{viewingReceipt.desc}</p>
                  </div>
                )}
                {viewingReceipt.invoice && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Linked Invoice</p>
                    <Link href={`/user/invoice/${viewingReceipt.invoice}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">
                      <MdInsertDriveFile className="w-4 h-4" />{viewingReceipt.invoice}
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full md:w-2/3 bg-black/50 flex items-center justify-center p-6 min-h-[300px] overflow-hidden">
              {viewingReceipt.receiptUrl?.toLowerCase().includes('.pdf') || viewingReceipt.receiptUrl?.startsWith('data:application/pdf') ? (
                <div className="w-full h-full min-h-[450px] rounded-xl overflow-hidden">
                  <object
                    data={viewingReceipt.receiptUrl}
                    type="application/pdf"
                    className="w-full h-full min-h-[450px] rounded-xl"
                  >
                    <div className="p-6 text-center text-gray-300">
                      <p className="mb-2">PDF preview unavailable.</p>
                      <a href={viewingReceipt.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">
                        Open PDF in new tab
                      </a>
                    </div>
                  </object>
                </div>
              ) : (
                <img src={viewingReceipt.receiptUrl} alt="Receipt" className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-border" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}