"use client";
import { Loader } from "@/components/ui/Loader";
import { useRouter } from "next/navigation";


import { useEffect, useState, useMemo } from "react";
import { Receipt, Edit2, UploadCloud, Loader2, RefreshCw } from "lucide-react";
import { MdCalendarToday, MdCreditCard, MdAdd, MdDelete, MdClose, MdRemoveRedEye } from "react-icons/md";
import { 
  getExpenses, createExpense, deleteExpense, updateExpense, uploadReceipt,
  getScheduledExpenses, deleteScheduledExpense, getLimitStatus
} from "../actions/actions";
import { useRole } from "../context/RoleContext";
import { getAccounts } from "../actions/accounts";
import { getTenantInfo } from "../actions/tenants";
import { getCategories } from "../actions/categories";
import CategoryPicker from "../components/CategoryPicker";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAdminDateRange } from "../context/AdminDateRangeContext";
import { useAppLock } from "../components/AppLockProvider";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import Image from "next/image";


const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

const parseCategories = (catStr: string | null | undefined): string[] => {
  if (!catStr) return [];
  return catStr.split(',').map(s => s.trim()).filter(Boolean);
};

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

export default function ExpensesPage() {
  const { confirm } = useConfirm();
  const router = useRouter();
  const { requireAuth } = useAppLock();
  const [activeFilter, setActiveFilter] = useState("All");
  const [serverCategories, setServerCategories] = useState<string[]>([]);
  const filters = ["All", ...serverCategories];
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Data loading state
  const [data, setData] = useState<any>(null);
  const [scheduledExpenses, setScheduledExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const { role } = useRole();
  
  // Date context
  const { startDate, endDate } = useAdminDateRange();
  
  // Receipt processing state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tenantPlan, setTenantPlan] = useState<string>("Free");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    paymentMethod: 'Corporate Card',
    receiptUrl: '',
    accountId: '',
    isScheduled: false,
    frequency: 'monthly'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, schedRes, accs, tInfo] = await Promise.all([
        getExpenses(startDate, endDate),
        getScheduledExpenses().catch(() => []),
        getAccounts(),
        getTenantInfo()
      ]);
      setAccounts(accs);
      setData(res);
      setScheduledExpenses(schedRes);
      setTenantPlan(tInfo?.plan || "Free");
    } catch (e) {
      console.error("Failed to load expenses data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [res, schedRes, accs, tInfo] = await Promise.all([
          getExpenses(startDate, endDate),
          getScheduledExpenses().catch(() => []),
          getAccounts(),
          getTenantInfo()
        ]);
        setAccounts(accs);
        if (!cancelled) {
          setData(res);
          setScheduledExpenses(schedRes);
          setTenantPlan(tInfo?.plan || "Free");
        }
      } catch (e) {
        console.error("Failed to load expenses data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    getLimitStatus('expenses').then(status => {
      if (!status.allowed) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: status.error }));
      }
    });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  // Handle actual expense save
  const handleSave = async () => {
    setSaving(true);
    try {
      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        const fileData = new FormData();
        fileData.append('file', receiptFile);
        uploadedUrl = await uploadReceipt(fileData, 'expenses');
      }

      const payload = { 
        ...formData, 
        amount: parseFloat(formData.amount) || 0, 
        category: selectedCategories.join(", "),
        receiptUrl: uploadedUrl 
      };
      let res;
      if (editingId) {
        res = await updateExpense(editingId, payload);
      } else {
        res = await createExpense(payload);
      }
      if (res?.error) throw new Error(res.error);
      setIsModalOpen(false);
      setEditingId(null);
      setReceiptFile(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        paymentMethod: 'Corporate Card',
        receiptUrl: '',
        accountId: '',
        isScheduled: false,
        frequency: 'monthly'
      });
      setSelectedCategories([]);
      await loadData();
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("LIMIT_EXCEEDED")) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: e.message }));
      } else {
        alert("Failed to save expense");
      }
    } finally {
      setSaving(false);
    }
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
    setFormData({
      date: formattedDate,
      amount: row.amount.toString(),
      description: row.desc || '',
      paymentMethod: row.paidVia || 'Corporate Card',
      receiptUrl: row.receiptUrl || '',
      accountId: row.accountId || '',
      isScheduled: false,
      frequency: 'monthly'
    });
    setSelectedCategories(parseCategories(row.category).length ? parseCategories(row.category) : []);
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirm("Are you sure you want to delete this record?")) {
      requireAuth(async () => {
        try {
          await deleteExpense(id);
          await loadData();
        } catch (e) {
          console.error("Failed to delete", e);
        }
      });
    }
  };

  const handleDeleteScheduled = async (id: number) => {
    if (await confirm("Stop and delete this recurring expense schedule? Future auto-transactions for this schedule will be disabled.")) {
      requireAuth(async () => {
        try {
          await deleteScheduledExpense(id);
          await loadData();
        } catch (e) {
          console.error("Failed to delete scheduled expense", e);
        }
      });
    }
  };

  const dynamicCategories = useMemo(() => {
    if (!data?.items) return filters.filter(f => f !== "All");
    const all = new Set(filters.filter(f => f !== "All"));
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
    { label: "This Month", value: formatLKR(data.thisMonth), icon: Receipt, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Last Month", value: formatLKR(data.lastMonth), icon: MdCalendarToday, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Year to Date", value: formatLKR(data.ytd), icon: MdCreditCard, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const dynamicFilters = ["All", ...dynamicCategories];

  const filteredExpenses = data.items.filter((row: any) => {
    if (activeFilter === "All") return true;
    return parseCategories(row.category).includes(activeFilter);
  });

  return (
    <div className="space-y-4">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-semibold">
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Recurring Schedules Panel */}
      {scheduledExpenses.length > 0 && (
        <div className="bg-transparent border border-border rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <RefreshCw className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
            <h2 className="text-lg font-semibold text-foreground">Active Recurring Schedules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledExpenses.map((item) => (
              <div key={item.id} className="bg-transparent border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">
                    {formatLKR(item.amount)} • <span className="capitalize">{item.frequency}</span>
                  </p>
                  <p className="text-[10px] text-indigo-300">Next Auto-Pay: {item.next_due_date}</p>
                </div>
                {role !== 'Viewer' && (
                  <button
                    onClick={() => handleDeleteScheduled(item.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer flex-shrink-0"
                    title="Remove Schedule"
                  >
                    <MdDelete className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {dynamicFilters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
                activeFilter === f 
                  ? "bg-brand-500 text-brand-900 border-brand-500 font-bold" 
                  : "bg-card text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {role !== 'Viewer' && (
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({
                date: new Date().toISOString().split('T')[0],
                amount: '',
                description: '',
                paymentMethod: 'Corporate Card',
                receiptUrl: '',
                accountId: accounts.find((a: any) => a.isDefault)?.id?.toString() || '',
                isScheduled: false,
                frequency: 'monthly'
              });
              setSelectedCategories([]);
              setReceiptFile(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors cursor-pointer w-full sm:w-auto"
          >
            <MdAdd className="w-5 h-5" />
            Record Expense
          </button>
        )}
      </div>

      {/* Expenses History Table */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-gray-400 text-sm">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium w-36">Category</th>
                <th className="p-4 font-medium">Paid via</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredExpenses.map((row: any) => (
                <tr key={row.id} className="hover:bg-card transition-colors">
                  <td className="p-4 text-sm">{row.date}</td>
                  <td className="p-4 font-semibold text-red-400">{formatLKR(row.amount)}</td>
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
                  <td className="p-4 text-sm">{row.paidVia}</td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    {row.receiptUrl && (
                      <button onClick={() => setViewingReceipt(row)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-blue-400 hover:text-blue-300 cursor-pointer">
                        <MdRemoveRedEye className="w-4 h-4" />
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
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">No expense records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
             <div className="p-6 space-y-4">
              {/* Recurring / Scheduled Switch Toggle - ONLY show on creating new expense */}
              {!editingId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-transparent border border-border rounded-2xl">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Mark as Scheduled Recurring Expense</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, isScheduled: !formData.isScheduled})}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.isScheduled ? "bg-brand-500" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formData.isScheduled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {formData.isScheduled && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-transparent border border-border rounded-2xl animate-fade-in">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-semibold uppercase">Repeat Interval</label>
                        <select 
                          value={formData.frequency} 
                          onChange={e => setFormData({...formData, frequency: e.target.value})}
                          className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="weekly" className="bg-black">Every Week</option>
                          <option value="monthly" className="bg-black">Every Month</option>
                          <option value="yearly" className="bg-black">Every Year</option>
                        </select>
                      </div>
                      <div className="flex items-end text-xs text-gray-400 pb-2">
                        Next transaction date will calculate from the selected expense date.
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Amount (LKR)</label>
                  <input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Description</label>
                <input type="text" placeholder="What was this expense for?" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Categories</label>
                <CategoryPicker 
                  categories={dynamicCategories} 
                  value={selectedCategories} 
                  onChange={setSelectedCategories} 
                  placeholder="Select categories..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                    <option className="bg-black">Corporate Card</option>
                    <option className="bg-black">Bank Transfer</option>
                    <option className="bg-black">Personal Card</option>
                    <option className="bg-black">Cash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Source Account</label>
                  <select value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                    <option value="" className="bg-black">No Account (Unlinked)</option>
                    {accounts.map(a => <option key={a.id} value={a.id} className="bg-black">{a.name} ({formatLKR(a.currentBalance || 0)})</option>)}
                  </select>
                </div>
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
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-full font-medium hover:bg-card transition-colors cursor-pointer" disabled={saving || convertingPdf}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || convertingPdf} className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-full font-bold transition-colors disabled:opacity-50 cursor-pointer">
                {saving && <Loader size="sm" />}
                {saving ? "Saving..." : (editingId ? "Update Expense" : "Save Expense")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Receipt Image Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
          <div className="relative flex flex-col md:flex-row bg-transparent border border-border rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-foreground transition-colors backdrop-blur-md cursor-pointer" onClick={() => setViewingReceipt(null)}>
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
                  <p className="text-3xl font-bold text-red-400">{formatLKR(viewingReceipt.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-foreground">{viewingReceipt.date}</p>
                </div>
                {viewingReceipt.paidVia && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Paid Via</p>
                    <p className="text-sm font-medium text-foreground">{viewingReceipt.paidVia}</p>
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
              </div>
            </div>

            <div className="w-full md:w-2/3 bg-black/50 flex items-center justify-center p-6 min-h-[300px] overflow-hidden">
              <Image 
                src={viewingReceipt.receiptUrl} 
                alt="Receipt" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-border"
               width={800} height={800} unoptimized={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
