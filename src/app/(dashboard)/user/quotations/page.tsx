"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo } from "react";
import { Edit2, Loader2, CheckCircle2, FolderOpen } from "lucide-react";
import { MdAccountBalanceWallet, MdTrendingUp, MdAdd, MdDelete, MdRemoveRedEye, MdClose, MdDownload } from "react-icons/md";
import Link from "next/link";
import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { useRouter } from "next/navigation";
import { 
  getQuotations, 
  deleteQuotation, 
  confirmQuotation,
  getBankAccounts,
  getQuotationById
} from "../actions/actions";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAdminDateRange } from "../context/AdminDateRangeContext";
import { useAppLock } from "../components/AppLockProvider";
import { useRole } from "../context/RoleContext";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import Image from "next/image";

const filters = ["All", "Web dev", "Graphic design", "Video editing", "Photography", "Videography"];

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

export default function QuotationsPage() {
  const { confirm } = useConfirm();
  const router = useRouter();
  const { requireAuth } = useAppLock();
  const { role } = useRole();
  const [activeFilter, setActiveFilter] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmingLoading, setConfirmingLoading] = useState(false);
  const { startDate, endDate } = useAdminDateRange();

  // Project name modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [pendingConfirmRow, setPendingConfirmRow] = useState<any | null>(null);
  const [projectNameInput, setProjectNameInput] = useState("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");

  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadPDF = async (row: any) => {
    setDownloadingId(row.id);
    try {
      const q = await getQuotationById(row.id.toString());
      if (!q) {
        alert("Failed to load quotation details");
        return;
      }
      
      // Create a temporary hidden div
      const element = document.createElement("div");
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.top = "-9999px";
      element.style.width = "800px";
      element.style.padding = "40px";
      element.style.background = "#ffffff";
      element.style.color = "#000000";
      element.style.fontFamily = "sans-serif";
      
      // Basic HTML for the quotation
      element.innerHTML = `
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">Quotation QT-${String(q.id).padStart(5, "0")}</h1>
        <p><strong>Project:</strong> ${q.description || "Project"}</p>
        <p><strong>Date:</strong> ${new Date(q.date).toLocaleDateString()}</p>
        <p><strong>Client Name:</strong> ${q.client_name || ""}</p>
        <p><strong>Client Email:</strong> ${q.email || ""}</p>
        <br/><br/>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc; text-align: left;">
              <th style="padding: 8px;">Description</th>
              <th style="padding: 8px;">Qty</th>
              <th style="padding: 8px;">Rate</th>
              <th style="padding: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(q.items || []).map((item: any) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">${item.description}</td>
                <td style="padding: 8px;">${item.quantity}</td>
                <td style="padding: 8px;">${parseFloat(item.price).toFixed(2)}</td>
                <td style="padding: 8px;">${parseFloat(item.total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <br/>
        <div style="text-align: right;">
          <p><strong>Amount:</strong> ${parseFloat(String(q.amount || 0)).toFixed(2)}</p>
          <p><strong>Discount:</strong> ${parseFloat(String(q.discount || 0)).toFixed(2)}</p>
          <p><strong>Total Due:</strong> ${parseFloat(String(q.total_due || q.amount || 0)).toFixed(2)}</p>
        </div>
      `;
      
      document.body.appendChild(element);
      
      const imgData = await domtoimage.toJpeg(element, {
        bgcolor: '#ffffff',
        quality: 1.0,
        width: 800 * 2,
        height: element.offsetHeight * 2,
        style: {
          transform: 'scale(2)',
          transformOrigin: 'top left',
          width: '800px',
          height: element.offsetHeight + 'px'
        }
      });
      document.body.removeChild(element);
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * 2 * pdfWidth) / (800 * 2);
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`QT-${String(q.id).padStart(5, "0")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getQuotations(startDate, endDate);
      setData(res);
    } catch (e) {
      console.error("Failed to load quotations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await getQuotations(startDate, endDate);
        if (!cancelled) setData(res);
      } catch (e) {
        console.error("Failed to load quotations", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  useEffect(() => {
    async function loadBanks() {
      try {
        const banks = await getBankAccounts();
        setBankAccounts(banks);
        if (banks.length > 0) {
          const def = banks.find((a: any) => a.is_default === 1) || banks[0];
          setSelectedBankAccountId(def.id.toString());
        }
      } catch (e) {
        console.error("Failed to load bank accounts", e);
      }
    }
    loadBanks();
  }, []);

  // Step 1: open modal to ask for project name
  const handleConfirmProject = (quotationId: number, quotationData: any) => {
    setPendingConfirmRow({ id: quotationId, ...quotationData });
    setProjectNameInput(quotationData.desc || "");
    setShowProjectModal(true);
  };

  // Step 2: submit after admin enters project name
  const handleConfirmSubmit = async () => {
    if (!pendingConfirmRow) return;
    if (!projectNameInput.trim()) {
      alert("Please enter a project name.");
      return;
    }
    setConfirmingId(pendingConfirmRow.id);
    setConfirmingLoading(true);
    setShowProjectModal(false);
    try {
      const bankId = selectedBankAccountId ? parseInt(selectedBankAccountId) : null;
      await confirmQuotation(pendingConfirmRow.id, pendingConfirmRow, projectNameInput.trim(), bankId);
      await loadData();
      alert("Quotation confirmed! Invoice has been created.");
    } catch (e) {
      console.error("Failed to confirm quotation", e);
      alert("Failed to confirm quotation");
    } finally {
      setConfirmingLoading(false);
      setConfirmingId(null);
      setPendingConfirmRow(null);
      setProjectNameInput("");
    }
  };

const handleDelete = async (id: number) => {
  const quotation = data.items.find((q: any) => q.id === id);
  const isConfirmed = quotation?.status === 'confirmed';
  const message = isConfirmed
    ? "This quotation has a linked invoice. Deleting it will also delete the invoice. Are you sure?"
    : "Are you sure you want to delete this quotation?";

  if (await confirm(message)) {
    requireAuth(async () => {
      try {
        await deleteQuotation(id);
        await loadData();
      } catch (e) {
        console.error("Failed to delete", e);
        alert("Failed to delete quotation");
      }
    });
  }
};

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
    { label: "Total Quotations", value: data.items.length.toString(), icon: MdAccountBalanceWallet, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Confirmed", value: data.confirmedCount.toString(), icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Value", value: formatLKR(data.totalValue), icon: MdTrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const filteredQuotations = data.items.filter((row: any) => 
    activeFilter === "All" || row.category === activeFilter
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'sent': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'draft': return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
      default: return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
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
          <Link
            href="/user/quotations/new"
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors w-full sm:w-auto"
          >
            <MdAdd className="w-5 h-5" />
            New Quotation
          </Link>
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
                <th className="p-4 font-medium">Project</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredQuotations.map((row: any) => (
                <tr key={row.id} className="hover:bg-card transition-colors">
                  <td className="p-4 text-sm">{row.date}</td>
                  <td className="p-4 font-semibold text-blue-400">{formatLKR(row.amount)}</td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-foreground">{row.client || '-'}</div>
                    {row.clientEmail && (
                      <div className="text-xs text-gray-500 mt-0.5">{row.clientEmail}</div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-300">{row.desc}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 border border-border">
                      {row.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border capitalize ${getStatusColor(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    {role !== 'Viewer' && row.status !== 'confirmed' && (
                      <button 
                        onClick={() => handleConfirmProject(row.id, row)}
                        className="p-2 hover:bg-green-400/10 rounded-xl transition-colors text-gray-400 hover:text-green-400 disabled:opacity-50"
                        title="Confirm project & create invoice"
                      >
                        {confirmingLoading && confirmingId === row.id ? (
                          <Loader size="sm" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {row.status === 'confirmed' && (
                      <span className="p-2 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                    {row.receiptUrl && (
                      <button onClick={() => setViewingReceipt(row)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-blue-400 hover:text-blue-300">
                        <MdRemoveRedEye className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDownloadPDF(row)}
                      disabled={downloadingId === row.id}
                      className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground disabled:opacity-50"
                      title="MdDownload PDF"
                    >
                      {downloadingId === row.id ? (
                        <Loader size="sm" />
                      ) : (
                        <MdDownload className="w-4 h-4" />
                      )}
                    </button>
                    {role !== 'Viewer' && (
                      <>
                        <button 
                          onClick={() => router.push(`/user/quotations/${row.id}/edit`)}
                          className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed" 
                          disabled={row.status === 'confirmed'}
                          title={row.status === 'confirmed' ? 'Confirmed quotations cannot be edited' : 'Edit quotation'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(row.id)} 
                          className="p-2 hover:bg-red-400/10 rounded-xl transition-colors text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                          disabled={row.status === 'confirmed'}
                          title={row.status === 'confirmed' ? 'Confirmed quotations cannot be deleted' : 'Delete quotation'}
                        >
                          <MdDelete className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">No quotations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
          <div className="relative flex flex-col md:flex-row bg-transparent border border-border rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-foreground transition-colors backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
              ✕
            </button>
            
            <div className="w-full md:w-1/3 bg-card p-6 sm:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">Quotation Details</h3>
                <p className="text-sm text-gray-400">Quote Information</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Amount</p>
                  <p className="text-3xl font-bold text-blue-400">{formatLKR(viewingReceipt.amount)}</p>
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
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Category</p>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/10 border border-border inline-block">
                    {viewingReceipt.category}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border capitalize inline-block ${getStatusColor(viewingReceipt.status)}`}>
                    {viewingReceipt.status}
                  </span>
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
                alt="Quotation Attachment" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-border"
               width={800} height={800} unoptimized={true} />
            </div>
          </div>
        </div>
      )}

      {/* Project Name Modal */}
      {showProjectModal && pendingConfirmRow && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowProjectModal(false)}
        >
          <div
            className="relative bg-transparent border border-border rounded-3xl p-8 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowProjectModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-foreground transition-colors"
            >
              <MdClose className="w-4 h-4" />
            </button>

            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-6">
              <div className="text-foreground flex shrink-0">
                <FolderOpen className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Confirm Quotation</h2>
                <p className="text-sm text-gray-400 mt-0.5">Enter a project name to proceed</p>
              </div>
            </div>

            {/* Quotation summary */}
            <div className="mb-6 p-4 rounded-2xl bg-transparent border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Client</span>
                <span className="text-foreground font-medium">{pendingConfirmRow.client || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Quotation</span>
                <span className="text-foreground font-medium">{pendingConfirmRow.desc || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Amount</span>
                <span className="text-blue-400 font-semibold">{formatLKR(pendingConfirmRow.amount)}</span>
              </div>
            </div>

            {/* Project name input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="e.g. Company Website Redesign"
                autoFocus
                className="w-full bg-transparent border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-500 outline-none focus:border-brand-500 focus:bg-white/8 transition-colors text-sm"
              />
            </div>



            {/* Bank account select */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bank Account
              </label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-border rounded-xl px-4 py-3 text-foreground outline-none focus:border-brand-500 transition-colors text-sm"
              >
                <option value="" className="bg-[#0d0d0d] text-gray-400">Select Bank Account</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-[#0d0d0d] text-foreground">
                    {acc.name} - {acc.number} ({acc.bank})
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowProjectModal(false)}
                className="flex-1 py-3 rounded-xl border border-border text-gray-300 hover:bg-card transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={!projectNameInput.trim()}
                className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-brand-900 transition-colors text-sm font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}