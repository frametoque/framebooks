"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Edit2, Loader2, Image as ImageIcon, FileText as FileIcon, Printer } from "lucide-react";
import { MdInsertDriveFile, MdCheckCircle, MdAccessTime, MdErrorOutline, MdSearch, MdRemoveRedEye, MdDownload, MdDelete, MdAttachMoney, MdClose, MdUpload, MdCancel, MdPointOfSale } from "react-icons/md";
import Link from "next/link";
import { getInvoices, deleteInvoice, recordInvoicePayment, adminUploadPaymentSlip, getInvoiceByIdAdmin, cancelInvoiceAction } from "../actions/actions";
import { getAccounts } from "../actions/accounts";
import { useRole } from "../context/RoleContext";
import { getTenantInfo } from "../actions/tenants";
import { useAppLock } from "../components/AppLockProvider";
import AnimatedNumber from "../components/AnimatedNumber";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { downloadInvoiceWithLayout, printInvoiceWithLayout } from "@/lib/invoice-layout/export-pdf";
import Image from "next/image";

const filters = ["All", "Fully Paid", "Partially Paid", "On Review", "Overdue", "Advance-Paid", "Unpaid", "Cancelled", "Refunded"];

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

function InvoicesPageContent() {
  const { confirm } = useConfirm();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<"all" | "direct" | "pos">("all");

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      if (statusParam.toLowerCase() === "unpaid") {
        setActiveFilter("Unpaid");
      } else {
        const match = filters.find(f => f.toLowerCase() === statusParam.toLowerCase());
        if (match) setActiveFilter(match);
      }
    }
  }, [searchParams]);
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
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Payment slip upload states
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [tenantPlan, setTenantPlan] = useState<string>("Free");
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [includeSlip, setIncludeSlip] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);

  const openRecordPaymentModal = async (invoice: any) => {
    setSelectedInvoice(invoice);
    const due = invoice.total_due != null ? invoice.total_due : invoice.amount;
    setPaidAmount(due > 0 ? due.toString() : (invoice.amount || 0).toString());
    setPaymentMethod("Bank Transfer");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsAdvance(false);
    setSlipFile(null);
    setSlipPreview(null);
    setIncludeSlip(false);

    let currentAccounts = accounts;
    if (!currentAccounts || currentAccounts.length === 0) {
      try {
        const accs = await getAccounts();
        if (accs && accs.length > 0) {
          currentAccounts = accs;
          setAccounts(accs);
        }
      } catch (e) {
        console.error("Failed to fetch accounts:", e);
      }
    }

    let defaultAccId = "";
    if (invoice.bank_account_id) {
      defaultAccId = String(invoice.bank_account_id);
    } else {
      const def = currentAccounts.find((a: any) => a.isDefault || a.is_default);
      defaultAccId = def ? String(def.id) : (currentAccounts[0]?.id ? String(currentAccounts[0].id) : "");
    }
    setSelectedAccountId(defaultAccId);

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
        isAdvance,
        selectedAccountId ? parseInt(selectedAccountId) : null
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
      const [res, tInfo, accs] = await Promise.all([getInvoices(), getTenantInfo(), getAccounts()]);
      setData(res);
      setTenantPlan(tInfo?.plan || "Free");
      setTenantInfo(tInfo);
      setAccounts(accs || []);
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
        const [res, tInfo, accs] = await Promise.all([getInvoices(), getTenantInfo(), getAccounts()]);
        if (!cancelled) {
          setData(res);
          setTenantPlan(tInfo?.plan || "Free");
          setTenantInfo(tInfo);
          setAccounts(accs || []);
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

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      let tInfo = tenantInfo;
      let tPlan = tenantPlan;
      if (!tInfo) {
        tInfo = await getTenantInfo();
        setTenantInfo(tInfo);
        tPlan = tInfo?.plan || "Free";
        setTenantPlan(tPlan);
      }

      const inv = await getInvoiceByIdAdmin(invoiceId);
      if (!inv) {
        alert("Invoice not found");
        return;
      }

      // If this invoice is from POS, download the thermal receipt PDF
      if (inv.is_pos && inv.pos_order) {
        const { downloadPosReceiptPdf } = await import("@/lib/pos/receipt-printer");
        const { getActiveReceiptLayoutAction } = await import("@/app/(dashboard)/user/actions/invoice-layouts");
        const receiptLayoutRes = await getActiveReceiptLayoutAction().catch(() => null);
        await downloadPosReceiptPdf({
          order: inv.pos_order,
          tenantName: tInfo?.name || "Framebooks Store",
          tenantLogoUrl: tInfo?.logo_url || null,
          customLayout: receiptLayoutRes?.layout || null,
          fileName: `Receipt-${inv.pos_order.order_number || invoiceId}.pdf`,
        });
        return;
      }

      await downloadInvoiceWithLayout({
        invoice: inv,
        tenantInfo: tInfo,
        plan: tPlan,
        layoutDef: inv.layout_snapshot || inv.active_layout_definition,
        fileName: `${inv.invoice_number || invoiceId}.pdf`,
      });
    } catch (err: any) {
      console.error("Direct PDF download failed:", err);
      alert("Failed to download PDF: " + (err?.message || String(err)));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrintInvoice = async (invoiceId: string) => {
    setPrintingId(invoiceId);
    try {
      let tInfo = tenantInfo;
      let tPlan = tenantPlan;
      if (!tInfo) {
        tInfo = await getTenantInfo();
        setTenantInfo(tInfo);
        tPlan = tInfo?.plan || "Free";
        setTenantPlan(tPlan);
      }

      const inv = await getInvoiceByIdAdmin(invoiceId);
      if (!inv) {
        alert("Invoice not found");
        return;
      }

      // If this invoice is from POS, print the thermal receipt
      if (inv.is_pos && inv.pos_order) {
        const { printPosReceipt } = await import("@/lib/pos/receipt-printer");
        const { getActiveReceiptLayoutAction } = await import("@/app/(dashboard)/user/actions/invoice-layouts");
        const receiptLayoutRes = await getActiveReceiptLayoutAction().catch(() => null);
        printPosReceipt({
          order: inv.pos_order,
          tenantName: tInfo?.name || "Framebooks Store",
          tenantLogoUrl: tInfo?.logo_url || null,
          customLayout: receiptLayoutRes?.layout || null,
        });
        return;
      }

      await printInvoiceWithLayout({
        invoice: inv,
        tenantInfo: tInfo,
        plan: tPlan,
        layoutDef: inv.layout_snapshot || inv.active_layout_definition || null,
      });
    } catch (err: any) {
      console.error("Direct invoice print failed:", err);
      alert("Failed to print invoice: " + (err?.message || String(err)));
    } finally {
      setPrintingId(null);
    }
  };

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

  const handleCancelInvoice = async (id: string) => {
    if (await confirm(`Are you sure you want to cancel and revoke invoice #${id}? This will remove it from your income ledger and restore any deducted inventory.`)) {
      requireAuth(async () => {
        try {
          const res = await cancelInvoiceAction(id);
          if (res.success) {
            await loadData();
            alert(`Invoice #${id} has been cancelled and removed from income.`);
          } else {
            alert(`Failed to cancel invoice: ${res.error}`);
          }
        } catch (e: any) {
          console.error("Failed to cancel invoice", e);
          alert(`Error cancelling invoice: ${e?.message || String(e)}`);
        }
      });
    }
  };

  const hasPos = Boolean(tenantInfo?.has_pos_addon && tenantInfo?.can_use_pos !== false);
  const directInvoicesCount = useMemo(() => data?.items?.filter((r: any) => !r.isPos).length || 0, [data]);
  const posReceiptsCount = useMemo(() => data?.items?.filter((r: any) => Boolean(r.isPos)).length || 0, [data]);

  const filteredInvoices = useMemo(() => data?.items?.filter((row: any) => {
    // Channel / Source filter (All vs Direct Invoices vs POS Receipts)
    if (sourceFilter === "direct" && row.isPos) return false;
    if (sourceFilter === "pos" && !row.isPos) return false;

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
    } else if (activeFilter === "Unpaid") {
      statusMatch = rowStatus === "unpaid" || rowStatus === "pending";
    } else {
      statusMatch = rowStatus === activeFilter.toLowerCase();
    }
    const search = (searchTerm || '').trim().toLowerCase();
    const searchMatch =
      !search ||
      (row.client || '').toLowerCase().includes(search) ||
      (row.id || '').toLowerCase().includes(search) ||
      (row.posOrderNumber || '').toLowerCase().includes(search) ||
      (row.service || '').toLowerCase().includes(search) ||
      (row.clientEmail || '').toLowerCase().includes(search);
    return statusMatch && searchMatch;
  }) ?? [], [data, activeFilter, sourceFilter, searchTerm]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse shadow-xs">
              <div className="p-3 rounded-2xl bg-black/5 dark:bg-card w-12 h-12" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-black/5 dark:bg-card rounded-full w-24" />
                <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-card border border-border rounded-3xl p-6 animate-pulse space-y-4 shadow-xs">
          <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-48 mb-6" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-border last:border-0">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-black/10 dark:bg-white/10 rounded-full w-1/3" />
                <div className="h-3 bg-black/5 dark:bg-card rounded-full w-1/4" />
              </div>
              <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Total Issued", value: data.totalIssued.toString(), icon: MdInsertDriveFile, color: "text-brand-800 dark:text-brand-400", bg: "bg-brand-500/15 dark:bg-brand-400/10" },
    { label: "Paid", value: data.paid.toString(), icon: MdCheckCircle, color: "text-emerald-700 dark:text-green-400", bg: "bg-emerald-100/70 dark:bg-green-400/10" },
    { label: "Unpaid", value: data.pending.toString(), icon: MdAccessTime, color: "text-amber-800 dark:text-amber-400", bg: "bg-amber-100/70 dark:bg-amber-400/10" },
    { label: "Total Due", value: formatLKR(data.totalDue), icon: MdErrorOutline, color: "text-red-700 dark:text-red-400", bg: "bg-red-100/70 dark:bg-red-400/10" },
  ];

  return (
    <div className="space-y-4">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-3xl p-5 sm:p-6 flex items-center gap-3.5 sm:gap-4 hover:shadow-md transition-all shadow-xs min-w-0">
            <div className={`p-3 rounded-2xl flex-shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium truncate" title={stat.label}>{stat.label}</p>
              <p className="text-lg sm:text-xl 2xl:text-2xl font-bold text-foreground tracking-tight whitespace-nowrap overflow-visible" title={stat.value}>
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Search & Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder={hasPos ? "Search invoices & receipts..." : "Search invoices..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-foreground shadow-2xs placeholder:text-gray-400"
              />
            </div>

            {/* POS vs Direct Invoices Channel Filter (Shown when POS is enabled) */}
            {hasPos && (
              <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 border border-border rounded-full text-xs font-semibold self-start sm:self-auto shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSourceFilter("all")}
                  className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    sourceFilter === "all"
                      ? "bg-brand-500 text-brand-950 font-bold shadow-xs"
                      : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  All ({data?.items?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter("direct")}
                  className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    sourceFilter === "direct"
                      ? "bg-brand-500 text-brand-950 font-bold shadow-xs"
                      : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  Direct Invoices ({directInvoicesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter("pos")}
                  className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    sourceFilter === "pos"
                      ? "bg-brand-500 text-brand-950 font-bold shadow-xs"
                      : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  POS Receipts ({posReceiptsCount})
                </button>
              </div>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  activeFilter === f
                    ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                    : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 shadow-2xs"
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
            prefetch={false}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-3xl font-bold transition-colors w-full sm:w-auto self-end lg:self-auto shadow-xs whitespace-nowrap"
          >
            <MdInsertDriveFile className="w-5 h-5" />
            Create Invoice
          </Link>
        )}
      </div>

      {/* Table & Mobile Cards */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        {/* Desktop / Tablet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4">{hasPos ? "Invoice / Receipt #" : "Invoice #"}</th>
                <th className="p-4">Client</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Date</th>
                <th className="p-4">Payment Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((row: any) => {
                const paymentStatus = row.status?.toLowerCase() || '';

                let paymentColor = "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
                if (paymentStatus === 'fully paid') paymentColor = "text-emerald-700 bg-emerald-100/70 border-emerald-200/60 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/20";
                else if (paymentStatus === 'on review') paymentColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
                else if (paymentStatus === 'advance-paid') paymentColor = "text-blue-700 bg-blue-100/70 border-blue-200/60 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20";
                else if (paymentStatus === 'unpaid' || paymentStatus === 'pending') paymentColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
                else if (paymentStatus === 'overdue') paymentColor = "text-red-700 bg-red-100/70 border-red-200/60 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20";
                else if (paymentStatus === 'partially paid') paymentColor = "text-indigo-700 bg-indigo-100/70 border-indigo-200/60 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20";
                else if (paymentStatus === 'cancelled' || paymentStatus === 'canceled' || paymentStatus === 'voided') paymentColor = "text-rose-700 bg-rose-100/70 border-rose-200/60 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20";
                else if (paymentStatus === 'refunded') paymentColor = "text-purple-700 bg-purple-100/70 border-purple-200/60 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/20";

                return (
                  <tr key={row.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/user/invoice/${row.id}`} prefetch={false} className="font-semibold text-emerald-700 dark:text-brand-400 hover:text-emerald-800 dark:hover:text-brand-300 transition-colors">
                          {row.id}
                        </Link>
                        {row.isPos && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30" title={`POS Receipt: ${row.posOrderNumber || row.id}`}>
                            <MdPointOfSale className="w-3 h-3" />
                            POS
                          </span>
                        )}
                      </div>
                      {row.isPos && row.posOrderNumber && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {row.posOrderNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-foreground">{row.client}</div>
                      {row.clientEmail && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{row.clientEmail}</div>
                      )}
                    </td>
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
                    <td className={`p-4 text-sm ${row.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
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
                          <button onClick={() => openRecordPaymentModal(row)} className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400" title="Record Payment">
                            <MdAttachMoney className="w-4 h-4" />
                          </button>
                        )}
                        <Link href={`/user/invoice/${row.id}`} prefetch={false} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-foreground" title="View">
                          <MdRemoveRedEye className="w-4 h-4" />
                        </Link>
                        {role !== 'Viewer' && (
                          <Link href={`/user/invoices/${row.id}/edit`} prefetch={false} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-foreground" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDownloadInvoice(row.id)}
                          disabled={downloadingId === row.id}
                          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-foreground disabled:opacity-50"
                          title={row.isPos ? "Download POS Receipt" : "Download PDF"}
                        >
                          {downloadingId === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                          ) : (
                            <MdDownload className="w-4 h-4" />
                          )}
                        </button>
                        {tenantPlan === "Pro Plus" && (
                          <button
                            onClick={() => handlePrintInvoice(row.id)}
                            disabled={printingId === row.id}
                            className="p-2 hover:bg-brand-500/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-50"
                            title={row.isPos ? "Print POS Receipt" : "Direct Print Invoice"}
                          >
                            {printingId === row.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {paymentStatus !== 'cancelled' && paymentStatus !== 'canceled' && paymentStatus !== 'refunded' && paymentStatus !== 'voided' && role !== 'Viewer' && (
                          <button
                            onClick={() => handleCancelInvoice(row.id)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-400/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Cancel & Revoke Invoice"
                          >
                            <MdCancel className="w-4 h-4" />
                          </button>
                        )}
                        {role !== 'Viewer' && (
                          <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Delete">
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

        {/* Mobile Cards (Phones & Small Screens) */}
        <div className="md:hidden divide-y divide-border">
          {filteredInvoices.map((row: any) => {
            const paymentStatus = row.status?.toLowerCase() || '';

            let paymentColor = "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20";
            if (paymentStatus === 'fully paid') paymentColor = "text-emerald-700 bg-emerald-100/70 border-emerald-200/60 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/20";
            else if (paymentStatus === 'on review') paymentColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
            else if (paymentStatus === 'advance-paid') paymentColor = "text-blue-700 bg-blue-100/70 border-blue-200/60 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20";
            else if (paymentStatus === 'unpaid' || paymentStatus === 'pending') paymentColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
            else if (paymentStatus === 'overdue') paymentColor = "text-red-700 bg-red-100/70 border-red-200/60 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20";
            else if (paymentStatus === 'partially paid') paymentColor = "text-indigo-700 bg-indigo-100/70 border-indigo-200/60 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20";
            else if (paymentStatus === 'cancelled' || paymentStatus === 'canceled' || paymentStatus === 'voided') paymentColor = "text-rose-700 bg-rose-100/70 border-rose-200/60 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20";
            else if (paymentStatus === 'refunded') paymentColor = "text-purple-700 bg-purple-100/70 border-purple-200/60 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/20";

            return (
              <div key={row.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/user/invoice/${row.id}`} prefetch={false} className="font-bold text-emerald-700 dark:text-brand-400 hover:underline">
                      {row.id}
                    </Link>
                    {row.isPos && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                        <MdPointOfSale className="w-2.5 h-2.5" />
                        POS
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] uppercase font-bold rounded-full border ${paymentColor}`}>
                    {row.status}
                  </span>
                </div>
                {row.isPos && row.posOrderNumber && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono -mt-1">
                    {row.posOrderNumber}
                  </div>
                )}

                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{row.client}</div>
                    {row.clientEmail && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.clientEmail}</div>
                    )}
                    <div className={`text-xs mt-1 ${row.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      Due: {row.due}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">{formatLKR(row.amount)}</div>
                    {paymentStatus !== 'fully paid' && (
                      <div className={`text-xs mt-0.5 font-medium ${
                        paymentStatus === 'unpaid' || paymentStatus === 'pending' || paymentStatus === 'overdue'
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                        Remaining: {formatLKR(row.total_due)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Action Buttons Bar */}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/50">
                  {row.status?.toLowerCase() !== 'fully paid' && role !== 'Viewer' && (
                    <button onClick={() => openRecordPaymentModal(row)} className="p-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 rounded-xl transition-colors text-emerald-600 dark:text-emerald-400" title="Record Payment">
                      <MdAttachMoney className="w-4 h-4" />
                    </button>
                  )}
                  <Link href={`/user/invoice/${row.id}`} prefetch={false} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400" title="View">
                    <MdRemoveRedEye className="w-4 h-4" />
                  </Link>
                  {role !== 'Viewer' && (
                    <Link href={`/user/invoices/${row.id}/edit`} prefetch={false} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Link>
                  )}
                  <button
                    onClick={() => handleDownloadInvoice(row.id)}
                    disabled={downloadingId === row.id}
                    className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 disabled:opacity-50"
                    title={row.isPos ? "Download POS Receipt" : "Download PDF"}
                  >
                    {downloadingId === row.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    ) : (
                      <MdDownload className="w-4 h-4" />
                    )}
                  </button>
                  {tenantPlan === "Pro Plus" && (
                    <button
                      onClick={() => handlePrintInvoice(row.id)}
                      disabled={printingId === row.id}
                      className="p-2.5 hover:bg-brand-500/10 rounded-xl transition-colors text-gray-500 dark:text-gray-400 disabled:opacity-50"
                      title={row.isPos ? "Print POS Receipt" : "Direct Print Invoice"}
                    >
                      {printingId === row.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {paymentStatus !== 'cancelled' && paymentStatus !== 'canceled' && paymentStatus !== 'refunded' && paymentStatus !== 'voided' && role !== 'Viewer' && (
                    <button
                      onClick={() => handleCancelInvoice(row.id)}
                      className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-400/10 rounded-xl transition-colors text-rose-500"
                      title="Cancel & Revoke Invoice"
                    >
                      <MdCancel className="w-4 h-4" />
                    </button>
                  )}
                  {role !== 'Viewer' && (
                    <button onClick={() => handleDelete(row.id)} className="p-2.5 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-xl transition-colors text-red-500" title="Delete">
                      <MdDelete className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredInvoices.length === 0 && (
            <div className="p-6 text-center text-gray-500">No invoices found.</div>
          )}
        </div>
      </div>
      {/* Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-card dark:bg-[#11151f]/95 backdrop-blur-xl border border-border rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-transparent shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">Create Income from Invoice</h2>
              <button onClick={() => setPaymentModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-foreground">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Invoice Summary & Payment Details */}
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 bg-black/[0.02] dark:bg-card p-4 rounded-2xl border border-border">
                    <p><span className="font-semibold text-foreground">Invoice:</span> {selectedInvoice.id}</p>
                    <p><span className="font-semibold text-foreground">Client:</span> {selectedInvoice.client}</p>
                    <p><span className="font-semibold text-foreground">Service:</span> {selectedInvoice.service}</p>
                    <p><span className="font-semibold text-foreground">Total Amount:</span> {formatLKR(selectedInvoice.amount)}</p>
                    {selectedInvoice.total_due != null && (
                      <p><span className="font-semibold text-foreground">Remaining Due:</span> {formatLKR(selectedInvoice.total_due)}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-700 dark:text-gray-300 block font-medium">Paid Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full bg-black/5 dark:bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-700 dark:text-gray-300 block font-medium">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full bg-black/5 dark:bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isAdvance"
                      checked={isAdvance}
                      onChange={(e) => setIsAdvance(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-card text-foreground focus:ring-brand-500 cursor-pointer"
                    />
                    <label htmlFor="isAdvance" className="text-sm text-foreground/90 font-medium select-none cursor-pointer">
                      Payment is advance
                    </label>
                  </div>
                </div>

                {/* Right Column: Account, Payment Method & Slip Upload */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-700 dark:text-gray-300 block font-medium">Account</label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground appearance-none shadow-2xs cursor-pointer"
                    >
                      <option value="" className="bg-card text-foreground">No Account (Unlinked)</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={String(a.id)} className="bg-card text-foreground">
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-700 dark:text-gray-300 block font-medium">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-foreground appearance-none shadow-2xs cursor-pointer"
                    >
                      <option value="Bank Transfer" className="bg-card text-foreground">Bank Transfer</option>
                      <option value="Cash" className="bg-card text-foreground">Cash</option>
                      <option value="PayPal" className="bg-card text-foreground">PayPal</option>
                      <option value="Wise" className="bg-card text-foreground">Wise</option>
                    </select>
                  </div>

                  {/* Payment Slip Upload Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                        <MdUpload className="w-4 h-4" />
                        Upload Payment Slip (Optional)
                      </label>
                      {includeSlip && (
                        <button
                          type="button"
                          onClick={removeSlipFile}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {convertingPdf ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-brand-500/30 rounded-xl bg-brand-500/5">
                        <Loader size="sm" />
                        <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">Converting PDF to image...</span>
                      </div>
                    ) : !includeSlip ? (
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-all relative">
                        <MdUpload className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload slip image or PDF</span>
                        {tenantPlan !== 'Pro Plus' && (
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-brand-700 dark:text-brand-500 bg-brand-500/15 px-2 py-0.5 rounded-md">Pro Plus</span>
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
                        <Image src={slipPreview} alt="Slip preview" className="w-full h-32 object-cover" width={800} height={800} unoptimized={true} />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-lg text-xs text-white flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {slipFile?.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-black/5 dark:bg-card border border-border rounded-xl">
                        <FileIcon className="w-5 h-5 text-foreground" />
                        <span className="text-sm text-foreground/90 flex-1 truncate">{slipFile?.name}</span>
                        <span className="text-xs text-gray-500">
                          {slipFile ? (slipFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Max file size: 10MB. Supported: Images, PDF
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border justify-end bg-transparent">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-5 py-2.5 border border-border hover:bg-black/5 dark:hover:bg-white/10 text-foreground rounded-3xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 rounded-3xl text-sm font-bold transition-colors shadow-xs cursor-pointer"
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

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}