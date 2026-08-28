import { NextResponse } from "next/server";
import { requirePermission } from "@/app/(dashboard)/user/actions/rbac";

export async function GET() {
  try {
    const { error: rbacError, context } = await requirePermission('export', 'data');
    
    if (rbacError || !context) {
      return new NextResponse(rbacError || "Unauthorized", { status: 403 });
    }

    const { tenantId, sql } = context;

    // Fetch data for export
    const invoices = await sql`SELECT invoice_number, customer_name, amount, status, due_date FROM admin_invoices WHERE tenant_id = ${tenantId}`;
    const expenses = await sql`SELECT category, amount, date, description FROM admin_expenses WHERE tenant_id = ${tenantId}`;
    const incomes = await sql`SELECT source, amount, date, description FROM admin_incomes WHERE tenant_id = ${tenantId}`;

    // Create a CSV string
    let csv = "--- INVOICES ---\n";
    csv += "Invoice Number,Customer Name,Amount,Status,Due Date\n";
    invoices.forEach(inv => {
      csv += `${inv.invoice_number},"${inv.customer_name}",${inv.amount},${inv.status},${inv.due_date}\n`;
    });

    csv += "\n--- EXPENSES ---\n";
    csv += "Category,Amount,Date,Description\n";
    expenses.forEach(exp => {
      csv += `"${exp.category}",${exp.amount},${exp.date},"${exp.description || ''}"\n`;
    });

    csv += "\n--- INCOMES ---\n";
    csv += "Source,Amount,Date,Description\n";
    incomes.forEach(inc => {
      csv += `"${inc.source}",${inc.amount},${inc.date},"${inc.description || ''}"\n`;
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
