import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

export const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric", month: "short", day: "numeric",
  });
};

export const formatMoney = (value: any, currency = "LKR") => {
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
};

export const formatMoneySlash = (value: any, currency = "LKR") => {
  if (value == null || isNaN(Number(value))) return "-";
  return `${currency === "LKR" ? "Rs." : currency} ${parseFloat(value).toFixed(2)}`;
};

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
};

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

  // Bank Details & Custom Fields
  currentY -= 40;

  const customFields = invoice.custom_field_values && typeof invoice.custom_field_values === 'object'
    ? Object.entries(invoice.custom_field_values).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    : [];

  if (customFields.length > 0) {
    page.drawText("Additional Details", { x: 40, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
    currentY -= 15;
    for (const [key, val] of customFields) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      page.drawText(`${label}: ${String(val)}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor });
      currentY -= 15;
    }
    currentY -= 15;
  }

  if (bank_acc_name || bank_acc_bank || bank_acc_number || bank_acc_branch) {
    page.drawText("Bank Details", { x: 40, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
    currentY -= 15;
    if (bank_acc_name) { page.drawText(`Account Name: ${bank_acc_name}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_bank) { page.drawText(`Bank: ${bank_acc_bank}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_number) { page.drawText(`Account No: ${bank_acc_number}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
    if (bank_acc_branch) { page.drawText(`Branch: ${bank_acc_branch}`, { x: 40, y: currentY, size: 10, font: helvetica, color: textColor }); currentY -= 15; }
  }

  // System Footer for Free Plan (Pro and Pro Plus have NO footer)
  if (tenantPlan === "Free") {
    const footerText = "Generated by Framebooks • framebooks.com";
    const textWidth = helvetica.widthOfTextAtSize(footerText, 8.5);
    
    page.drawText(footerText, {
      x: (width - textWidth) / 2,
      y: 25,
      size: 8.5,
      font: helvetica,
      color: hexToRgb("#9ca3af"),
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
