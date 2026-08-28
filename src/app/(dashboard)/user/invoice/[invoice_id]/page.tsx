"use client";
import { Loader } from "@/components/ui/Loader";


import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, ShieldCheck, Image as ImageIcon, FileText as FileIcon } from "lucide-react";
import { MdDownload, MdArrowBack, MdInsertDriveFile, MdCalendarToday, MdLocalOffer, MdWorkOutline, MdImage, MdCancel, MdAttachMoney, MdClose, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdDelete, MdUpload } from "react-icons/md";
import Link from "next/link";
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { getInvoiceByIdAdmin, approveBankSlip, declineBankSlip, undoApprovedBankSlipPayment, recordInvoicePayment, deleteIncome, adminUploadPaymentSlip } from "../../actions/actions";
import { getTenantInfo } from "../../actions/tenants";
import { useConfirm } from '@/components/ui/ConfirmProvider';
import Image from "next/image";



const paymentStatusStyles = {
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  "fully paid": "bg-green-500/20 text-green-400 border-green-500/30",
  unpaid: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "advance-paid": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "partially paid": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "on review": "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric", month: "short", day: "numeric",
  });
};

const formatDateTime = (dateString: string | Date | null | undefined) => {
  if (!dateString) return "N/A";
  let str = String(dateString);
  if (typeof dateString === 'string' && !str.endsWith('Z') && !str.includes('+') && !str.includes('Z')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatMoney = (value: any, currency = "LKR") => {
  if (!value || isNaN(parseFloat(value))) return "N/A";
  const currencySymbol = currency === "LKR" ? "Rs." : currency;
  return `${currencySymbol} ${parseFloat(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : rgb(0, 0, 0);
}

export const formatMoneySlash = (value: any, currency = "LKR") => {
  if (value == null || isNaN(Number(value))) return "-";
  return `${currency === "LKR" ? "Rs." : currency} ${parseFloat(value).toFixed(2)}`;
}

export const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
  if (!text) return [];
  text = String(text);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

export async function generateInvoicePDF(invoice: any, tenantPlan: string = "Free", tenantInfo: any = null): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.276, 841.89]); // A4 Size

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const {
    invoice_id, date, currency, subtotal, discount, advance, total, total_due,
    payment_status, tax_rate, items: rawItems, legal_name, billing_address,
    bank_acc_name, bank_acc_number, bank_acc_bank, bank_acc_branch
  } = invoice;

  const items = Array.isArray(rawItems) ? rawItems : (typeof rawItems === 'string' ? JSON.parse(rawItems) : []);

  const width = 595.276;
  const height = 841.89;

  // Colors
  const primaryColor = hexToRgb("#1a3a4a");
  const textColor = hexToRgb("#222222");
  const lightGray = hexToRgb("#f3f4f6");
  const borderGray = hexToRgb("#e5e7eb");

  let currentY = height - 50;

  // Top Section: Logo & Business Name
  if (tenantInfo?.logo_url) {
    try {
      const logoRes = await fetch(tenantInfo.logo_url);
      if (logoRes.ok) {
        const logoBytes = await logoRes.arrayBuffer();
        let logoImage;
        const lowerUrl = tenantInfo.logo_url.toLowerCase();
        if (lowerUrl.includes('.png')) {
          logoImage = await pdfDoc.embedPng(logoBytes);
        } else {
          logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        
        const logoDims = logoImage.scaleToFit(120, 50);
        page.drawImage(logoImage, {
          x: 40,
          y: currentY - logoDims.height + 15,
          width: logoDims.width,
          height: logoDims.height
        });
      }
    } catch (e) {
      console.error("Failed to load logo", e);
    }
  }

  // Draw Business Name
  page.drawText(tenantInfo?.name || "Business", {
    x: 40,
    y: currentY - 60,
    size: 20,
    font: helveticaBold,
    color: primaryColor,
  });

  // Invoice Title & Details (Right side)
  page.drawText("INVOICE", {
    x: width - 180,
    y: currentY - 20,
    size: 32,
    font: helveticaBold,
    color: primaryColor,
  });
  
  page.drawText(`Invoice No: ${invoice_id}`, {
    x: width - 180,
    y: currentY - 45,
    size: 10,
    font: helvetica,
    color: textColor,
  });
  page.drawText(`Date: ${formatDate(date)}`, {
    x: width - 180,
    y: currentY - 60,
    size: 10,
    font: helvetica,
    color: textColor,
  });

  currentY -= 110;

  // Bill To
  page.drawText("Bill To:", {
    x: 40,
    y: currentY,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  
  currentY -= 20;
  if (legal_name) {
    page.drawText(legal_name, { x: 40, y: currentY, size: 10, font: helveticaBold, color: textColor });
    currentY -= 15;
  }
  if (billing_address) {
    const addressLines = wrapText(billing_address, helvetica, 10, 250);
    for (const line of addressLines) {
      page.drawText(line, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor });
      currentY -= 15;
    }
  }

  // Total Due on right
  const calculatedTotalDue = total_due !== undefined && total_due !== null
    ? parseFloat(total_due)
    : Math.max(0, parseFloat(total || 0) - parseFloat(advance || 0));

  page.drawText("Amount Due", {
    x: width - 180,
    y: currentY + 35, // Align with Bill To
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  });
  page.drawText(formatMoney(calculatedTotalDue, currency), {
    x: width - 180,
    y: currentY + 10,
    size: 22,
    font: helveticaBold,
    color: primaryColor,
  });

  currentY -= 30;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: currentY - 15,
    width: width - 80,
    height: 25,
    color: lightGray,
  });
  
  page.drawText("Description", { x: 50, y: currentY - 5, size: 10, font: helveticaBold, color: primaryColor });
  page.drawText("Price", { x: 350, y: currentY - 5, size: 10, font: helveticaBold, color: primaryColor });
  page.drawText("Amount", { x: width - 100, y: currentY - 5, size: 10, font: helveticaBold, color: primaryColor });

  currentY -= 30;

  // Items
  items.forEach((item: any) => {
    if (!item || !item.description) return;
    const descLines = wrapText(item.description, helvetica, 10, 280);
    let itemY = currentY;

    descLines.forEach(line => {
      page.drawText(line, { x: 50, y: itemY, size: 10, font: helvetica, color: textColor });
      itemY -= 15;
    });

    if (item.price) {
      const qty = Number(item.quantity || item.qty) || 1;
      const priceText = `${qty} x ${currency === "LKR" ? "Rs." : currency} ${item.price}`;
      page.drawText(priceText, { x: 350, y: currentY, size: 10, font: helvetica, color: textColor });
    }

    page.drawText(formatMoney(item.total, currency), { x: width - 100, y: currentY, size: 10, font: helvetica, color: textColor });

    currentY = itemY - 10;
    
    // Draw row separator
    page.drawLine({
      start: { x: 40, y: currentY + 5 },
      end: { x: width - 40, y: currentY + 5 },
      color: borderGray,
      thickness: 1,
    });
    currentY -= 10;
  });

  // Summary
  currentY -= 20;
  const summaryX = width - 220;
  const summaryValX = width - 40;

  const drawSummaryLine = (label: string, value: string, font: any = helvetica, color: any = textColor) => {
    page.drawText(label, { x: summaryX, y: currentY, size: 10, font: helveticaBold, color: primaryColor });
    const textW = font.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: summaryValX - textW, y: currentY, size: 10, font, color });
    currentY -= 20;
  };

  drawSummaryLine("Subtotal", formatMoneySlash(subtotal, currency));
  if (parseFloat(discount || 0) > 0) drawSummaryLine("Discount", formatMoneySlash(discount, currency));
  if (parseFloat(tax_rate || 0) > 0) {
    const taxAmount = parseFloat(subtotal || 0) * (parseFloat(tax_rate) / 100);
    drawSummaryLine(`Tax (${tax_rate}%)`, formatMoneySlash(taxAmount, currency));
  }
  if (parseFloat(advance || 0) > 0) drawSummaryLine("Advance", formatMoneySlash(advance, currency));

  page.drawLine({
    start: { x: summaryX, y: currentY + 10 },
    end: { x: summaryValX, y: currentY + 10 },
    color: borderGray,
    thickness: 1,
  });

  page.drawText("Total", { x: summaryX, y: currentY - 5, size: 14, font: helveticaBold, color: primaryColor });
  const totalStr = formatMoney(total, currency);
  const totalW = helveticaBold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: summaryValX - totalW, y: currentY - 5, size: 14, font: helveticaBold, color: primaryColor });

  // Bank Details
  currentY -= 40;
  if (bank_acc_name || bank_acc_bank || bank_acc_number || bank_acc_branch) {
    page.drawText("Bank Details", { x: 40, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
    currentY -= 15;
    if (bank_acc_name) { page.drawText(`Account Name: ${bank_acc_name}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_bank) { page.drawText(`Bank: ${bank_acc_bank}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_number) { page.drawText(`Account No: ${bank_acc_number}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_branch) { page.drawText(`Branch: ${bank_acc_branch}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
  }

  // Watermark
  if (tenantPlan === "Free" || tenantPlan === "Pro") {
    const watermarkLine1 = "Generated from Framebook Business Management Service by FrameToque Digital Media.";
    const watermarkLine2 = "https://frametoque.com";
    
    const textWidth1 = helvetica.widthOfTextAtSize(watermarkLine1, 9);
    const textWidth2 = helvetica.widthOfTextAtSize(watermarkLine2, 9);
    
    page.drawText(watermarkLine1, {
      x: (width - textWidth1) / 2,
      y: 35,
      size: 9,
      font: helvetica,
      color: hexToRgb("#9ca3af"), 
    });
    
    page.drawText(watermarkLine2, {
      x: (width - textWidth2) / 2,
      y: 22,
      size: 9,
      font: helvetica,
      color: hexToRgb("#3b82f6"), // blue for link 
    });
  }

  // Paid Stamp
  if (payment_status === "fully paid") {
    try {
      const stampResponse = await fetch("/paid-stamp.png");
      if (stampResponse.ok) {
        const stampBytes = await stampResponse.arrayBuffer();
        const stampImage = await pdfDoc.embedPng(stampBytes);
        page.drawImage(stampImage, {
          x: width - 160,
          y: currentY + 30, // Place near bottom summary
          width: 120,
          height: 120,
          rotate: degrees(-12),
          opacity: 0.7,
        });
      }
    } catch (e) {
      console.error("Failed to load paid stamp", e);
    }
  }

  return await pdfDoc.save();
}

export default function AdminInvoicePage() {
  const { confirm } = useConfirm();
  const { invoice_id } = useParams();
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [undoingApprovedPayment, setUndoingApprovedPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [activeSlipIndex, setActiveSlipIndex] = useState(-1);
  const downloadTriggeredRef = useRef(false);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdvance, setIsAdvance] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);

  // Payment slip upload states
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [includeSlip, setIncludeSlip] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);
  const [tenantPlan, setTenantPlan] = useState<string>("Free");
  const [tenantInfo, setTenantInfo] = useState<any>(null);

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

  useEffect(() => {
    if (!invoice_id) return;
    const fetchInvoice = async () => {
      try {
        const [data, tInfo] = await Promise.all([getInvoiceByIdAdmin(invoice_id as string), getTenantInfo()]);
        if (!data) throw new Error("Invoice not found");
        setInvoice(data);
        setTenantPlan(tInfo?.plan || "Free");
        setTenantInfo(tInfo);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoice_id]);

  // Reset active payment-slip index when the invoice changes
  useEffect(() => {
    setActiveSlipIndex(-1);
  }, [invoice_id]);

  // Auto-download if ?download=true
  useEffect(() => {
    if (invoice && searchParams.get("download") === "true" && !downloadTriggeredRef.current) {
      downloadTriggeredRef.current = true;
      setAutoDownloaded(true);
      handleDownload();
    }
  }, [invoice, searchParams]);

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const pdfBytes = await generateInvoicePDF(invoice, tenantPlan, tenantInfo);
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.\nError: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloading(false);
    }
  };

  const openIncomeModal = () => {
    const due = parseFloat(invoice?.total_due != null ? invoice.total_due : invoice?.total || 0);
    setPaidAmount(due > 0 ? due.toString() : (invoice?.total || '0').toString());
    setPaymentMethod("Bank Transfer");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsAdvance(false);
    setSlipFile(null);
    setSlipPreview(null);
    setIncludeSlip(false);
    setIncomeModalOpen(true);
  };

  useEffect(() => {
    const handleCreateIncomeEvent = () => openIncomeModal();
    const handleDownloadEvent = () => handleDownload();
    window.addEventListener("invoice:create-income", handleCreateIncomeEvent);
    window.addEventListener("invoice:download-pdf", handleDownloadEvent);
    return () => {
      window.removeEventListener("invoice:create-income", handleCreateIncomeEvent);
      window.removeEventListener("invoice:download-pdf", handleDownloadEvent);
    };
  }, [invoice]);

  const handleDeleteAndReversePayment = async (incomeId: number, amount: number) => {
    if (!await confirm(`Are you sure you want to delete and reverse this payment of ${formatMoney(amount, invoice?.currency)}? This will restore the due balance on the invoice.`)) {
      return;
    }
    setDeletingPaymentId(incomeId);
    try {
      await deleteIncome(incomeId);
      const updated = await getInvoiceByIdAdmin(invoice.invoice_id);
      setInvoice(updated);
      alert("Payment deleted and reversed successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to reverse payment: " + (err?.message || String(err)));
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleDeleteAndReverseActiveSlip = async () => {
    if (!activeSlip || !invoice) return;
    if (!await confirm('Are you sure you want to delete and reverse this payment slip? This will reverse the payment and restore the due balance on the invoice.')) {
      return;
    }
    setUndoingApprovedPayment(true);
    try {
      const rawId = String(activeSlip.id);
      if (rawId.startsWith('income-')) {
        const parsed = parseInt(rawId.replace('income-p-', '').replace('income-', ''), 10);
        if (!isNaN(parsed)) {
          await deleteIncome(parsed);
        }
      } else {
        const slipId = parseInt(rawId, 10);
        if (!isNaN(slipId)) {
          const res = await undoApprovedBankSlipPayment(invoice.invoice_id, slipId);
          if (!res.success) {
            throw new Error(res.error || 'Failed to undo payment');
          }
        }
      }
      const updated = await getInvoiceByIdAdmin(invoice.invoice_id);
      setInvoice(updated);
      alert('Payment slip deleted and reversed successfully.');
    } catch (err: any) {
      console.error(err);
      alert('Error reversing payment slip: ' + (err?.message || String(err)));
    } finally {
      setUndoingApprovedPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader size="sm" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-center">
        <p className="text-red-400">{error || "Invoice not found"}</p>
        <Link href="/user/invoices" className="text-brand-400 text-sm mt-3 inline-block">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const lineItems = invoice.items || [];
  const currencyLabel = invoice.currency === "LKR" ? "Rs." : invoice.currency;
  const subtotal = parseFloat(invoice.subtotal || 0);
  const discount = parseFloat(invoice.discount || 0);
  const advance = parseFloat(invoice.advance || 0);
  const taxRate = parseFloat(invoice.tax_rate || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = parseFloat(invoice.total || subtotal + taxAmount - discount);

  const paymentsList = Array.isArray(invoice.payments) ? invoice.payments : [];
  const totalPayments = paymentsList
    .filter((p: any) => !String(p.description || '').toLowerCase().startsWith('advance'))
    .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

  const totalDue = Math.max(0, total - advance - totalPayments);

  const rawSlips = Array.isArray(invoice.payment_slips) ? invoice.payment_slips : [];
  const paymentSlips = [...rawSlips];

  if (Array.isArray(invoice.payments)) {
    for (const p of invoice.payments) {
      if (p.receipt_url && !paymentSlips.some((s: any) => s.url === p.receipt_url)) {
        paymentSlips.push({
          id: `income-p-${p.id || Date.now()}`,
          url: p.receipt_url,
          amount: parseFloat(p.amount || 0),
          status: 'approved',
          uploaded_at: p.created_at || p.date || null,
          review_note: p.description || 'Income Receipt'
        });
      }
    }
  }

  if (invoice.bank_slip && !paymentSlips.some((s: any) => s.url === invoice.bank_slip)) {
    paymentSlips.push({
      id: 'legacy',
      url: invoice.bank_slip,
      amount: advance > 0 ? advance : total,
      status: invoice.payment_status === 'on review' ? 'pending' : (invoice.payment_status === 'fully paid' || invoice.payment_status === 'advance-paid' ? 'approved' : 'pending'),
      uploaded_at: invoice.date || null,
      review_note: 'Bank Slip'
    });
  }

  // Sort slips in ASCENDING order (oldest slip is index 0 -> Slip #1)
  paymentSlips.sort((a: any, b: any) => {
    const timeA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
    const timeB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return timeA - timeB;
  });

  const hasSlipRecords = paymentSlips.length > 0;

  // Default active slip to newest (last item) if not set or out of bounds
  const currentActiveIdx = activeSlipIndex >= 0 && activeSlipIndex < paymentSlips.length 
    ? activeSlipIndex 
    : (paymentSlips.length > 0 ? paymentSlips.length - 1 : 0);

  const activeSlip = paymentSlips[currentActiveIdx] || null;
  const activeSlipUrl = activeSlip?.url || null;
  const activeSlipAmount = activeSlip?.amount ?? totalDue;
  const activeSlipIsImage = !!activeSlipUrl && (
    activeSlipUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(activeSlipUrl)
  );
  const activeSlipIsPdf = !!activeSlipUrl && (
    activeSlipUrl.startsWith('data:application/pdf') ||
    activeSlipUrl.toLowerCase().endsWith('.pdf')
  );

  const handleCreateIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setSavingIncome(true);
    try {
      // Step 1: Record the payment
      await recordInvoicePayment(
        invoice.invoice_id,
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
            invoice.invoice_id,
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

      setIncomeModalOpen(false);
      const updated = await getInvoiceByIdAdmin(invoice_id as string);
      setInvoice(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to create income from invoice: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingIncome(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Main Layout */}
      <div id="invoice-content" className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 space-y-4 w-full">


          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-transparent border border-border rounded-2xl p-5 flex flex-col gap-2">
              <div className="text-gray-400 text-xs flex items-center gap-2">
                <MdInsertDriveFile className="w-4 h-4" /> Invoice ID
              </div>
              <p className="text-foreground font-semibold text-sm">{invoice.invoice_id}</p>
            </div>

            <div className="bg-transparent border border-border rounded-2xl p-5 flex flex-col gap-2">
              <div className="text-gray-400 text-xs flex items-center gap-2">
                <MdCalendarToday className="w-4 h-4" /> Date
              </div>
              <p className="text-foreground font-semibold text-sm">{formatDate(invoice.date)}</p>
            </div>

            <div className="bg-transparent border border-border rounded-2xl p-5 flex flex-col gap-2">
              <div className="text-gray-400 text-xs flex items-center gap-2">
                <MdLocalOffer className="w-4 h-4" /> Payment Status
              </div>
              <span className={`w-fit px-3 py-1 text-xs font-medium rounded-full border ${paymentStatusStyles[invoice.payment_status as keyof typeof paymentStatusStyles] || paymentStatusStyles.unpaid}`}>
                {invoice.payment_status || "unpaid"}
              </span>
            </div>

            <div className="bg-transparent border border-border rounded-2xl p-5 flex flex-col gap-2">
              <div className="text-gray-400 text-xs flex items-center gap-2">
                <MdWorkOutline className="w-4 h-4" /> Bill To
              </div>
              <p className="text-foreground font-semibold text-sm">{invoice.legal_name || invoice.client_name || "Unknown Client"}</p>
              {invoice.billing_address && (
                <p className="text-gray-400 text-xs line-clamp-2">{invoice.billing_address}</p>
              )}
            </div>
          </div>

          {/* Line Items & Billing Summary */}
          <div className="bg-transparent border border-border rounded-2xl overflow-hidden mt-4">
            {lineItems.length > 0 ? (
              <>
                <div className="grid grid-cols-3 px-5 py-3 border-b border-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Description</span>
                  <span className="text-center">Price</span>
                  <span className="text-right">Total</span>
                </div>
                {lineItems.map((item: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 px-5 py-4 border-b border-border last:border-0">
                    <span className="text-foreground text-sm">{item.description}</span>
                    <span className="text-gray-300 text-sm text-center">
                      {item.price ? `${currencyLabel} ${item.price}` : "-"}
                    </span>
                    <span className="text-foreground text-sm text-right font-medium">
                      {!isNaN(parseFloat(item.total))
                        ? `${currencyLabel} ${parseFloat(item.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : "-"}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="px-5 py-8 text-center text-gray-500 text-sm border-b border-border">
                No line items found.
              </div>
            )}

            {/* Billing Summary */}
            <div className="px-5 py-4 space-y-3 bg-card border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-foreground font-semibold">{formatMoney(subtotal, invoice.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-red-400">− {formatMoney(discount, invoice.currency)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tax ({taxRate}%)</span>
                  <span className="text-foreground font-semibold">+ {formatMoney(taxAmount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-gray-300">Total</span>
                <span className="text-foreground font-semibold">{formatMoney(total, invoice.currency)}</span>
              </div>
              {advance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Advance Paid</span>
                  <span className="text-green-400">− {formatMoney(advance, invoice.currency)}</span>
                </div>
              )}
              {totalPayments > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Payments</span>
                  <span className="text-green-400">− {formatMoney(totalPayments, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-foreground font-semibold">Total Due</span>
                <span className="text-foreground font-bold text-lg">{formatMoney(totalDue, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="bg-transparent border border-border rounded-2xl p-6 mt-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-foreground">Payment History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm text-gray-300">
                  <thead>
                    <tr className="border-b border-border text-gray-400 text-xs uppercase tracking-wider">
                      <th className="py-2">Date</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.payments.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-card transition-colors">
                        <td className="py-3 font-medium text-foreground">{p.date}</td>
                        <td className="py-3 text-green-400 font-semibold">{formatMoney(p.amount, invoice.currency)}</td>
                        <td className="py-3">{p.method}</td>
                        <td className="py-3 text-gray-400">{p.description}</td>
                        <td className="py-3 text-right">
                          {p.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAndReversePayment(p.id, p.amount)}
                              disabled={deletingPaymentId === p.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                              title="Delete & Reverse Payment"
                            >
                              {deletingPaymentId === p.id ? (
                                <Loader size="sm" />
                              ) : (
                                <MdDelete className="w-3.5 h-3.5" />
                              )}
                              <span>Delete & Reverse</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bank Slip Review Section */}
          {hasSlipRecords && (
            <div className="bg-transparent border border-border rounded-2xl p-4 sm:p-6 mt-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Bank Transfer Slip</h3>
                    <p className="text-xs text-gray-400">
                      {paymentSlips.length > 1
                        ? `Slip ${currentActiveIdx + 1} of ${paymentSlips.length}`
                        : 'Uploaded for payment verification'}
                    </p>
                  </div>
                </div>

                {paymentSlips.length > 1 && (
                  <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-black/40 p-1">
                    <button
                      type="button"
                      disabled={currentActiveIdx === 0}
                      onClick={() => setActiveSlipIndex(Math.max(0, currentActiveIdx - 1))}
                      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <MdKeyboardArrowLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>
                    <span className="px-2 text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
                      {currentActiveIdx + 1} / {paymentSlips.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentActiveIdx === paymentSlips.length - 1}
                      onClick={() => setActiveSlipIndex(Math.min(paymentSlips.length - 1, currentActiveIdx + 1))}
                      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <span>Next</span>
                      <MdKeyboardArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col lg:flex-row gap-3 mt-4">
                <div className="lg:flex-[1.15] min-w-0">
                  <div className="relative border border-border rounded-2xl overflow-hidden bg-zinc-950/80 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] group">
                    {paymentSlips.length > 1 && (
                      <>
                        <button
                          type="button"
                          disabled={currentActiveIdx === 0}
                          onClick={() => setActiveSlipIndex(Math.max(0, currentActiveIdx - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-black/20 dark:border-white/20 backdrop-blur-md shadow-xl z-20 cursor-pointer"
                          title="Previous Slip"
                        >
                          <MdKeyboardArrowLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          disabled={currentActiveIdx === paymentSlips.length - 1}
                          onClick={() => setActiveSlipIndex(Math.min(paymentSlips.length - 1, currentActiveIdx + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-black/20 dark:border-white/20 backdrop-blur-md shadow-xl z-20 cursor-pointer"
                          title="Next Slip"
                        >
                          <MdKeyboardArrowRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {activeSlipIsImage ? (
                      <Image
                        src={activeSlipUrl!}
                        alt="Bank Transfer Slip"
                        className="w-full max-h-[720px] object-contain rounded-xl"
                       width={800} height={800} unoptimized={true} />
                    ) : activeSlipIsPdf ? (
                      <div className="w-full min-h-[540px] rounded-xl overflow-hidden">
                        <object
                          data={activeSlipUrl!}
                          type="application/pdf"
                          className="w-full h-[540px] rounded-xl"
                        >
                          <div className="p-6 text-center text-gray-300">
                            <p>PDF preview unavailable.</p>
                            <a href={activeSlipUrl!} download={`bank-slip-${invoice.invoice_id}.pdf`} className="text-brand-400 underline">
                              MdDownload bank slip
                            </a>
                          </div>
                        </object>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-300">
                        <p>Slip preview not available for this file type.</p>
                        {activeSlipUrl ? (
                          <a href={activeSlipUrl} download={`bank-slip-${invoice.invoice_id}`} className="text-brand-400 underline">
                            MdDownload bank slip
                          </a>
                        ) : (
                          <p>No slip data found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0 space-y-4">
                  <div className="rounded-2xl border border-border bg-black/20 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Review status</p>
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {activeSlip?.status === 'approved'
                            ? 'Approved'
                            : activeSlip?.status === 'declined'
                              ? 'Declined'
                              : invoice.payment_status === 'on review'
                                ? 'Awaiting review'
                                : invoice.payment_status || 'Pending'}
                        </p>
                      </div>
                      {activeSlip?.status === 'approved' ? (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-semibold rounded-full">
                          Approved
                        </span>
                      ) : activeSlip?.status === 'declined' ? (
                        <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-full">
                          Declined
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-full">
                          Awaiting Review
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 divide-y divide-white/10">
                      <div className="flex items-center justify-between pt-0">
                        <span className="text-sm text-gray-400">Amount submitted</span>
                        <span className="text-sm font-semibold text-foreground">{formatMoney(activeSlipAmount, invoice.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-sm text-gray-400">Invoice</span>
                        <span className="text-sm font-semibold text-foreground">#{invoice.invoice_id}</span>
                      </div>
                      {activeSlip?.uploaded_at && (
                        <div className="flex items-center justify-between pt-3">
                          <span className="text-sm text-gray-400">Uploaded</span>
                          <span className="text-xs text-gray-300">
                            {formatDateTime(activeSlip.uploaded_at)}
                          </span>
                        </div>
                      )}
                      {activeSlip?.review_note === 'Added by admin' && (
                        <div className="flex items-center justify-between pt-3">
                          <span className="text-sm text-gray-400">Uploaded by</span>
                          <span className="text-xs font-semibold text-brand-400 bg-white/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                            Admin
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeSlip?.status === 'pending' ? (
                    <div className="grid gap-3">
                      <button
                        onClick={async () => {
                          if (!await confirm('Are you sure you want to approve this bank slip and apply the submitted amount?')) return;
                          setApproving(true);
                          try {
                            const res = await approveBankSlip(invoice.invoice_id, activeSlip.id);
                            if (res.success) {
                              alert('Bank slip approved and payment applied.');
                              window.location.reload();
                            } else {
                              alert('Failed to approve: ' + res.error);
                            }
                          } catch (err) {
                            alert('Error approving slip');
                          } finally {
                            setApproving(false);
                          }
                        }}
                        disabled={approving || declining}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-sm font-semibold text-foreground transition hover:opacity-90 disabled:opacity-50"
                      >
                        {approving ? (
                          <><Loader size="sm" /> Approving...</>
                        ) : (
                          <><ShieldCheck className="w-5 h-5" /> Approve Slip</>
                        )}
                      </button>

                      <button
                        onClick={async () => {
                          if (!await confirm('Are you sure you want to decline this bank slip?')) return;
                          setDeclining(true);
                          try {
                            const res = await declineBankSlip(invoice.invoice_id, activeSlip.id);
                            if (res.success) {
                              alert('Bank slip declined.');
                              window.location.reload();
                            } else {
                              alert('Failed to decline: ' + res.error);
                            }
                          } catch (err) {
                            alert('Error declining slip');
                          } finally {
                            setDeclining(false);
                          }
                        }}
                        disabled={approving || declining}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {declining ? (
                          <><Loader size="sm" /> Declining...</>
                        ) : (
                          <><MdCancel className="w-5 h-5" /> Decline Slip</>
                        )}
                      </button>
                    </div>
                  ) : activeSlip?.status === 'approved' ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                        This slip has already been approved and applied to the invoice balance.
                      </div>
                      <button
                        onClick={handleDeleteAndReverseActiveSlip}
                        disabled={undoingApprovedPayment}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        {undoingApprovedPayment ? (
                          <><Loader size="sm" /> Deleting & Reversing...</>
                        ) : (
                          <><MdDelete className="w-5 h-5" /> Delete & Reverse Payment</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                      This slip has been declined and will not affect the invoice balance.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Income Modal */}
      {incomeModalOpen && invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Create Income from Invoice</h2>
              <button onClick={() => setIncomeModalOpen(false)} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-foreground">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateIncomeSubmit} className="p-6 space-y-4">
              <div className="text-sm text-gray-400 space-y-1 bg-card p-4 rounded-2xl border border-border">
                <p><span className="font-semibold text-gray-300">Invoice ID:</span> {invoice.invoice_id}</p>
                <p><span className="font-semibold text-gray-300">Client:</span> {invoice.user_email}</p>
                <p><span className="font-semibold text-gray-300">Due Amount:</span> {formatMoney(totalDue, invoice.currency)}</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400 block font-medium">Income Amount ({invoice.currency || 'LKR'})</label>
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
                <label className="text-sm text-gray-400 block font-medium">Date Received</label>
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
                    <Image src={slipPreview} alt="Slip preview" className="w-full h-40 object-cover"  width={800} height={800} unoptimized={true} />
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
                  onClick={() => setIncomeModalOpen(false)}
                  className="px-5 py-2.5 border border-border hover:bg-card text-gray-300 rounded-3xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIncome}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-900 rounded-3xl text-sm font-bold transition-colors cursor-pointer"
                >
                  {savingIncome && <Loader size="sm" />}
                  Save Income
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}