import { NextResponse } from "next/server";
import { requirePermission } from "@/app/(dashboard)/user/actions/rbac";
import { sanitizeCsvValue } from "@/lib/security/csv";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  try {
    const rateCheck = checkRateLimit(req, { prefix: "data-export", limit: 5, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return new NextResponse("Rate limit exceeded for data export. Please wait a minute.", {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      });
    }

    const { error: rbacError, context } = await requirePermission('export', 'data');
    
    if (rbacError || !context) {
      return new NextResponse(rbacError || "Unauthorized", { status: 403 });
    }

    const { tenantId, sql } = context;

    // Fetch data for export
    const invoices = await sql`SELECT invoice_number, customer_name, amount, status, due_date FROM admin_invoices WHERE tenant_id = ${tenantId}`;
    const expenses = await sql`SELECT category, amount, date, description FROM admin_expenses WHERE tenant_id = ${tenantId}`;
    const incomes = await sql`SELECT source, amount, date, description FROM admin_incomes WHERE tenant_id = ${tenantId}`;

    // Create a CSV string with formula injection protection
    let csv = "--- INVOICES ---\n";
    csv += "Invoice Number,Customer Name,Amount,Status,Due Date\n";
    invoices.forEach(inv => {
      csv += `${sanitizeCsvValue(inv.invoice_number)},${sanitizeCsvValue(inv.customer_name)},${sanitizeCsvValue(inv.amount)},${sanitizeCsvValue(inv.status)},${sanitizeCsvValue(inv.due_date)}\n`;
    });

    csv += "\n--- EXPENSES ---\n";
    csv += "Category,Amount,Date,Description\n";
    expenses.forEach(exp => {
      csv += `${sanitizeCsvValue(exp.category)},${sanitizeCsvValue(exp.amount)},${sanitizeCsvValue(exp.date)},${sanitizeCsvValue(exp.description)}\n`;
    });

    csv += "\n--- INCOMES ---\n";
    csv += "Source,Amount,Date,Description\n";
    incomes.forEach(inc => {
      csv += `${sanitizeCsvValue(inc.source)},${sanitizeCsvValue(inc.amount)},${sanitizeCsvValue(inc.date)},${sanitizeCsvValue(inc.description)}\n`;
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="business_export.csv"',
      },
    });

  } catch (error) {
    console.error("[EXPORT_DATA]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
