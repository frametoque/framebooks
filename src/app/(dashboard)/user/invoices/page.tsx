"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo } from "react";
import { Edit2, Send, Loader2, Image as ImageIcon, FileText as FileIcon } from "lucide-react";
import { MdInsertDriveFile, MdCheckCircle, MdAccessTime, MdErrorOutline, MdSearch, MdRemoveRedEye, MdDownload, MdDelete, MdAttachMoney, MdClose, MdUpload } from "react-icons/md";
import Link from "next/link";
import { getInvoices, deleteInvoice, recordInvoicePayment, adminUploadPaymentSlip } from "../actions/actions";
import { useRole } from "../context/RoleContext";
import { getTenantInfo } from "../actions/tenants";
import { useAppLock } from "../components/AppLockProvider";
import AnimatedNumber from "../components/AnimatedNumber";
import { useConfirm } from '@/components/ui/ConfirmProvider';

const filters = ["All", "Fully Paid", "Partially Paid", "On Review", "Overdue", "Advance-Paid", "Unpaid"];

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

export default function InvoicesPage() {
  const { confirm } = useConfirm();
  const [activeFilter, setActiveFilter] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { requireAuth } = useAppLock();
  const { role } = useRole();

  // Payment recording modal states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdvance, setIsAdvance] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Payment slip upload states
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [tenantPlan, setTenantPlan] = useState<string>("Free");
  const [includeSlip, setIncludeSlip] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);

  const openRecordPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaidAmount(invoice.amount.toString());
    setPaymentMethod("Bank Transfer");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsAdvance(false);
    setSlipFile(null);
    setSlipPreview(null);
    setIncludeSlip(false);
    setPaymentModalOpen(true);
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

  const handleSlipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Please select an image or PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Handle PDF conversion
    if (file.type === "application/pdf") {
      setConvertingPdf(true);
      convertPdfToImage(file)
        .then((convertedFile) => {
          setSlipFile(convertedFile);
          setIncludeSlip(true);
          const reader = new FileReader();
          reader.onloadend = () => {
            setSlipPreview(reader.result as string);
          };
          reader.readAsDataURL(convertedFile);
        })
        .catch((err) => {
          console.error(err);
          alert("Failed to convert PDF to image. Please upload a standard image file.");
          setSlipFile(null);
          setSlipPreview(null);
          setIncludeSlip(false);
        })
        .finally(() => {
          setConvertingPdf(false);
        });
      return;
    }

    // Handle image files
    setSlipFile(file);
    setIncludeSlip(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSlipFile = () => {
    setSlipFile(null);
    setSlipPreview(null);
    setIncludeSlip(false);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSavingPayment(true);
    try {
      // Step 1: Record the payment
      await recordInvoicePayment(
        selectedInvoice.id,
        parseFloat(paidAmount) || 0,
        paymentMethod,
        paymentDate,
        isAdvance
      );

      // Step 2: MdUpload slip if included (only for Bank Transfer)
      if (includeSlip && slipFile && paymentMethod === "Bank Transfer") {
        setUploadingSlip(true);
        try {
          // Convert file to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(slipFile);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
          });

          // MdUpload the slip (auto-approved)
          const slipResult = await adminUploadPaymentSlip(
            selectedInvoice.id,
            base64,
            parseFloat(paidAmount) || 0
          );

          if (!slipResult.success) {
            console.warn("Failed to upload slip:", slipResult.error);
          }
        } catch (slipErr) {
          console.warn("Failed to upload payment slip:", slipErr);
        } finally {
          setUploadingSlip(false);
        }
      }

      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      await loadData();
    } catch (err) {
      console.error("Failed to record payment:", err);
      alert("Failed to record payment: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingPayment(false);
    }
  };

  const loadData = async () => {
    try {
      const [res, tInfo] = await Promise.all([getInvoices(), getTenantInfo()]);
      setData(res);
      setTenantPlan(tInfo?.plan || "Free");
    } catch (e) {
      console.error("Failed to load invoices", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [res, tInfo] = await Promise.all([getInvoices(), getTenantInfo()]);
        if (!cancelled) {
          setData(res);
          setTenantPlan(tInfo?.plan || "Free");
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load invoices", e);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    if (await confirm("Are you sure you want to delete this invoice?")) {
      requireAuth(async () => {
        try {
          await deleteInvoice(id);
          await loadData();
        } catch (e) {
          console.error("Failed to delete", e);
        }
      });
    }
  };

  const handleSend = (id: string) => {
    const url = `${window.location.origin}/dashboard/invoice/${id}`;
    navigator.clipboard.writeText(url);
    alert("Invoice link copied to clipboard: " + url);
  };

  const filteredInvoices = useMemo(() => data?.items?.filter((row: any) => {
    let statusMatch = false;
    const rowStatus = row.status?.toLowerCase() || '';
    if (activeFilter === "All") {
      statusMatch = true;
    } else if (activeFilter === "Paid") {
      statusMatch = rowStatus === "paid" || rowStatus === "fully paid";
    } else if (activeFilter === "Fully Paid") {
      statusMatch = rowStatus === "fully paid";
    } else if (activeFilter === "Partially Paid") {
      statusMatch = rowStatus === "partially paid";
    } else if (activeFilter === "On Review") {
      statusMatch = rowStatus === "on review";
    } else {
      statusMatch = rowStatus === activeFilter.toLowerCase();
    }
    const searchMatch =
      row.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.id.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && searchMatch;
  }) ?? [], [data, activeFilter, searchTerm]);

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
    { label: "Total Issued", value: data.totalIssued.toString(), icon: MdInsertDriveFile, color: "text-brand-400", bg: "bg-brand-400/10" },
    { label: "Paid", value: data.paid.toString(), icon: MdCheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Unpaid", value: data.pending.toString(), icon: MdAccessTime, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Total Due", value: formatLKR(data.totalDue), icon: MdErrorOutline, color: "text-red-400", bg: "bg-red-400/10" },
  ];

  return (
    <div className="space-y-4">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: MdSearch & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* MdSearch */}
          <div className="relative w-full sm:w-64">
            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="MdSearch invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border border-border rounded-full pl-11 pr-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-foreground"
            />
          </div>

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
        </div>

        {/* Right Side: Create Button */}
        {role !== 'Viewer' && (
          <Link
            href="/user/invoices/new"
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-3xl font-bold transition-colors w-full sm:w-auto self-end lg:self-auto"
          >
            <MdInsertDriveFile className="w-5 h-5" />
            Create Invoice
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-gray-500 dark:text-gray-400 text-sm">
                <th className="p-4 font-medium">Invoice #</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Service</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>

                <th className="p-4 font-medium">Payment Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredInvoices.map((row: any) => {
                const paymentStatus = row.status?.toLowerCase() || '';
                

                let paymentColor = "text-gray-600 dark:text-gray-400 bg-gray-500/10 border-gray-500/20";
                if (paymentStatus === 'fully paid') paymentColor = "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20";
                else if (paymentStatus === 'on review') paymentColor = "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
                else if (paymentStatus === 'advance-paid') paymentColor = "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20";
                else if (paymentStatus === 'unpaid' || paymentStatus === 'pending') paymentColor = "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
                else if (paymentStatus === 'overdue') paymentColor = "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20";
                else if (paymentStatus === 'partially paid') paymentColor = "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20";



                return (
                  <tr key={row.id} className="hover:bg-card transition-colors">
                    <td className="p-4">
                      <Link href={`/user/invoice/${row.id}`} className="font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                        {row.id}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-foreground">{row.client}</div>
                      {row.clientEmail && (
                        <div className="text-xs text-gray-500 mt-0.5">{row.clientEmail}</div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-300">{row.service}</td>
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{formatLKR(row.amount)}</div>
                      {paymentStatus !== 'fully paid' && (
                        <div className={`text-xs mt-0.5 font-medium ${
                          paymentStatus === 'unpaid' || paymentStatus === 'pending' || paymentStatus === 'overdue'
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          Due: {formatLKR(row.total_due)}
                        </div>
                      )}
                    </td>
                    <td className={`p-4 text-sm ${row.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-300'}`}>
                      {row.due}
                    </td>
                    
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-full border ${paymentColor}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {row.status?.toLowerCase() !== 'fully paid' && role !== 'Viewer' && (
                          <button onClick={() => openRecordPaymentModal(row)} className="p-2 hover:bg-emerald-400/10 rounded-xl transition-colors text-gray-400 hover:text-emerald-400" title="Record Payment">
                            <MdAttachMoney className="w-4 h-4" />
                          </button>
                        )}
                        <Link href={`/user/invoice/${row.id}`} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground" title="View">
                          <MdRemoveRedEye className="w-4 h-4" />
                        </Link>
                        {role !== 'Viewer' && (
                          <>
                            <Link href={`/user/invoices/${row.id}/edit`} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </Link>
                            <button onClick={() => handleSend(row.id)} className="p-2 hover:bg-brand-400/10 rounded-xl transition-colors text-gray-400 hover:text-brand-400" title="Copy Link">
                              <Send className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <Link href={`/user/invoice/${row.id}?download=true`} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-foreground" title="MdDownload PDF">
                          <MdDownload className="w-4 h-4" />
                        </Link>
                        {role !== 'Viewer' && (
                          <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-400/10 rounded-xl transition-colors text-gray-400 hover:text-red-400" title="Delete">
                            <MdDelete className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Create Income from Invoice</h2>
              <button onClick={() => setPaymentModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-foreground">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="text-sm text-gray-400 space-y-1 bg-card p-4 rounded-2xl border border-border">
                <p><span className="font-semibold text-gray-300">Invoice:</span> {selectedInvoice.id}</p>
                <p><span className="font-semibold text-gray-300">Client:</span> {selectedInvoice.client}</p>
                <p><span className="font-semibold text-gray-300">Service:</span> {selectedInvoice.service}</p>
                <p><span className="font-semibold text-gray-300">Total Amount:</span> {formatLKR(selectedInvoice.amount)}</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400 block font-medium">Paid Amount (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400 block font-medium">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400 block font-medium">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground appearance-none"
                >
                  <option value="Bank Transfer" className="bg-black text-foreground">Bank Transfer</option>
                  <option value="Stripe" className="bg-black text-foreground">Stripe</option>
                  <option value="PayPal" className="bg-black text-foreground">PayPal</option>
                  <option value="Cash" className="bg-black text-foreground">Cash</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-2">
                <input
                  type="checkbox"
                  id="isAdvance"
                  checked={isAdvance}
                  onChange={(e) => setIsAdvance(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-card text-foreground focus:ring-brand-500 focus:ring-offset-black"
                />
                <label htmlFor="isAdvance" className="text-sm text-gray-300 font-medium select-none cursor-pointer">
                  Payment is advance
                </label>
              </div>

              {/* Payment Slip MdUpload Section */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                    <MdUpload className="w-4 h-4" />
                    MdUpload Payment Slip (Optional)
                  </label>
                  {includeSlip && (
                    <button
                      type="button"
                      onClick={removeSlipFile}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {convertingPdf ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-brand-500/30 rounded-xl bg-brand-500/5">
                    <Loader size="sm" />
                    <span className="text-sm text-brand-400">Converting PDF to image...</span>
                  </div>
                ) : !includeSlip ? (
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-all relative">
                    <MdUpload className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Click to upload slip image or PDF</span>
                    {tenantPlan !== 'Pro Plus' && (
                      <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-md">Pro Plus</span>
                    )}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSlipFileChange}
                      className="hidden"
                      disabled={tenantPlan !== 'Pro Plus'}
                    />
                  </label>
                ) : slipPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={slipPreview} alt="Slip preview" className="w-full h-40 object-cover" />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-lg text-xs text-foreground flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {slipFile?.name}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-transparent border border-border rounded-xl">
                    <FileIcon className="w-5 h-5 text-foreground" />
                    <span className="text-sm text-gray-300 flex-1 truncate">{slipFile?.name}</span>
                    <span className="text-xs text-gray-500">
                      {slipFile ? (slipFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Max file size: 10MB. Supported: Images, PDF
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border justify-end">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-5 py-2.5 border border-border hover:bg-card text-gray-300 rounded-3xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-900 rounded-3xl text-sm font-bold transition-colors"
                >
                  {savingPayment && <Loader size="sm" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}