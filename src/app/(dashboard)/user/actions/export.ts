"use server";

import sql from "@/lib/db";
import { auth } from '@/lib/auth';
import { requirePermission } from "./rbac";

function jsonToCsv(items: any[]) {
  if (!items || items.length === 0) return "";
  
  const header = Object.keys(items[0]).join(",");
  const rows = items.map(item => {
    return Object.values(item).map(val => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      if (str.search(/("|,|\n)/g) >= 0) {
        return `"${str}"`;
      }
      return str;
    }).join(",");
  });

  return [header, ...rows].join("\n");
}

export async function exportData(type: "invoices" | "incomes" | "expenses" | "clients") {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const userRows = await sql`SELECT tenant_id, role FROM admin_users WHERE clerk_id = ${userId}`;
  if (!userRows || userRows.length === 0) return { success: false, error: "User not found" };
  const { tenant_id: tenantId, role } = userRows[0];

  if (role !== 'owner') return { success: false, error: "Only the workspace owner can export data." };

  const tenantRows = await sql`SELECT plan FROM tenants WHERE id = ${tenantId}`;
  const plan = tenantRows[0]?.plan || 'Free';
  if (plan !== 'Pro' && plan !== 'Pro Plus') {
    return { success: false, error: "Data export is only available on Pro and Pro Plus plans." };
  }

  let data = [];
  try {
    switch (type) {
      case "invoices":
        data = await sql`SELECT invoice_id, user_email, project_name, date, subtotal, tax_rate, discount, total, advance, total_due, payment_status, work_status, currency, category FROM invoices WHERE tenant_id = ${tenantId} ORDER BY date DESC`;
        break;
      case "incomes":
        data = await sql`SELECT id, date, amount, category, description, payment_method, invoice_id FROM admin_incomes WHERE tenant_id = ${tenantId} ORDER BY date DESC`;
        break;
      case "expenses":
        data = await sql`SELECT id, date, amount, category, description, payment_method FROM admin_expenses WHERE tenant_id = ${tenantId} ORDER BY date DESC`;
        break;
      case "clients":
        data = await sql`SELECT id, full_name, email, phone, company, address FROM admin_clients WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
        break;
      default:
        return { success: false, error: "Invalid export type" };
    }

    const csv = jsonToCsv(data);
    return { success: true, csv };
  } catch (error: any) {
    console.error("Export error:", error);
    return { success: false, error: "Failed to export data" };
  }
}

export async function exportReport(reportType: "profit_loss" | "cash_flow" | "balance_sheet", startDate?: string, endDate?: string) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const userRows = await sql`SELECT tenant_id, role FROM admin_users WHERE clerk_id = ${userId}`;
  if (!userRows || userRows.length === 0) return { success: false, error: "User not found" };
  const { tenant_id: tenantId, role } = userRows[0];

  if (role !== 'owner') return { success: false, error: "Only the workspace owner can export reports." };

  const tenantRows = await sql`SELECT plan FROM tenants WHERE id = ${tenantId}`;
  const plan = tenantRows[0]?.plan || 'Free';
  if (plan !== 'Pro' && plan !== 'Pro Plus') {
    return { success: false, error: "Report export is only available on Pro and Pro Plus plans." };
  }

  try {
    const { getReports } = await import('./actions');
    const reports = await getReports(startDate, endDate);
    
    let csv = "";
    
    if (reportType === 'profit_loss') {
      csv = `Category,Amount\nIncome,\n`;
      reports.incomeByService.forEach((i: any) => csv += `"${i.name}",${i.value}\n`);
      csv += `Total Income,${reports.totalIncome}\n\nExpenses,\n`;
      reports.expensesBreakdown.forEach((e: any) => csv += `"${e.name}",${e.value}\n`);
      csv += `Total Expenses,${reports.totalExpenses}\n\n`;
      csv += `Net Profit,${reports.netProfit}\n`;
    }
    
    if (reportType === 'balance_sheet') {
      csv = `Category,Amount\nAssets,\nBank Balance,${reports.advanced.assets.bankBalance}\nAccounts Receivable,${reports.advanced.assets.accountsReceivable}\nTotal Assets,${reports.advanced.assets.total}\n\n`;
      csv += `Liabilities,\nAccounts Payable,0\nTotal Liabilities,0\n\n`;
      csv += `Equity,\nRetained Earnings,${reports.advanced.assets.total}\nTotal Equity,${reports.advanced.assets.total}\n`;
    }
    
    if (reportType === 'cash_flow') {
      csv = `Date,Type,Description,Category,Amount\n`;
      reports.journalEntries.forEach((j: any) => {
        csv += `${j.date},${j.type},"${j.description.replace(/"/g, '""')}","${j.category}",${j.amount}\n`;
      });
    }

    return { success: true, csv };
  } catch (error: any) {
    console.error("Export report error:", error);
    return { success: false, error: "Failed to export report" };
  }
}
