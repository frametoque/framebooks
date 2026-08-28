"use server";
import { checkLimit } from "@/lib/plans";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import {  auth, clerkClient  } from '@/lib/auth';
import { put, del } from '@vercel/blob';
import { logSystemAction } from "@/lib/logger";
import { getGravatarUrl } from "@/lib/gravatar";

export async function getTenantId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
  if (!userRows || userRows.length === 0 || !userRows[0].tenant_id) {
    return null;
  }
  
  return userRows[0].tenant_id as string;
}

export async function uploadReceipt(formData: FormData, type: 'income' | 'expenses'): Promise<string> {
  const file = formData.get('file') as File;
  if (!file) {
    await logSystemAction(`Upload Error: No file provided for ${type} receipt`);
    throw new Error("No file uploaded");
  }

  try {
    const filename = `admin/receipts/${type}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const blob = await put(filename, file, {
      access: 'public',
    });
    
    await logSystemAction(`Uploaded ${type} receipt: "${file.name}"`);
    return blob.url;
  } catch (err: any) {
    await logSystemAction(`Upload Error: Failed to upload ${type} receipt: "${file.name}" - ${err.message || String(err)}`);
    throw err;
  }
}

import { unstable_cache } from 'next/cache';

// -- DASHBOARD --
export async function getDashboardData(startDate?: string, endDate?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';
  const tenantId = await getTenantId();
  if (!tenantId) return null;

  return unstable_cache(
    async () => _getDashboardData(tenantId, start, end),
    [`dashboard-data-${tenantId}-${start}-${end}`],
    { tags: [`dashboard-${tenantId}`], revalidate: 3600 }
  )();
}

async function _getDashboardData(tenantId: string, start: string, end: string) {
    const [
      incomes,
      expenses,
      unpaid,
      invoiceAging,
      chartDataRaw,
      recentInvoicesRaw,
      recentQuotationsRaw,
      recentTransactionsRaw,
      incomeByYear,
      expenseByYear,
      expenseBreakdownRange,
      incomeBreakdownRange,
      thisMonthIncome,
      lastMonthIncome,
      thisMonthExpenses,
      lastMonthExpenses,
      clientsCountRows,
      accounts
    ] = await Promise.all([
      sql`SELECT SUM(amount) as total FROM admin_incomes WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp`,
      sql`SELECT SUM(amount) as total FROM admin_expenses WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp`,
      sql`SELECT COUNT(*) as count, SUM(COALESCE(total_due, total)) as total_amount FROM invoices WHERE tenant_id = ${tenantId} AND LOWER(payment_status) IN ('unpaid', 'pending', 'partially paid')`,
    sql`
      SELECT 
        LOWER(payment_status) as status,
        SUM(COALESCE(total_due, total)) as amount_sum,
        COUNT(*) as count
      FROM invoices
      WHERE tenant_id = ${tenantId}
      GROUP BY LOWER(payment_status)
    `,
    sql`
      SELECT 
        TO_CHAR(date, 'Mon') as name,
        EXTRACT(MONTH FROM date) as month_num,
        EXTRACT(YEAR FROM date) as year_num,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM (
        SELECT date, amount, 'income' as type FROM admin_incomes WHERE tenant_id = ${tenantId}
        UNION ALL
        SELECT date, amount, 'expense' as type FROM admin_expenses WHERE tenant_id = ${tenantId}
      ) as combined
      WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      GROUP BY TO_CHAR(date, 'Mon'), EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
      ORDER BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
    `,
    sql`
      SELECT 
        i.invoice_id as id, 
        COALESCE((SELECT full_name FROM admin_clients c WHERE LOWER(c.email) = LOWER(i.user_email) AND c.tenant_id = ${tenantId} LIMIT 1), i.user_email) as client, 
        COALESCE((SELECT description FROM invoice_items WHERE invoice_id = i.invoice_id LIMIT 1), 'Project') as service,
        i.total as amount, 
        i.payment_status as status
      FROM invoices i
      WHERE i.tenant_id = ${tenantId} AND i.date >= ${start}::timestamp AND i.date <= (${end} || ' 23:59:59.999')::timestamp
      ORDER BY i.date DESC, i.created_at DESC
      LIMIT 4
    `,
    sql`
      SELECT q.id, COALESCE(q.description, 'Untitled') as project, COALESCE(c.full_name, 'Unknown') as client, q.amount as amount, q.status
      FROM admin_quotations q
      LEFT JOIN admin_clients c ON q.client_id = c.id AND c.tenant_id = ${tenantId}
      WHERE q.tenant_id = ${tenantId} AND q.date >= ${start}::timestamp AND q.date <= (${end} || ' 23:59:59.999')::timestamp
      ORDER BY q.date DESC, q.created_at DESC
      LIMIT 4
    `,
    sql`
      SELECT id, 'income' as type, description as name, date, created_at, amount FROM admin_incomes WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      UNION ALL
      SELECT id, 'expense' as type, description as name, date, created_at, amount FROM admin_expenses WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      ORDER BY date DESC, created_at DESC
      LIMIT 5
    `,
    sql`
      SELECT 
        EXTRACT(YEAR FROM date) as year,
        SUM(amount) as total
      FROM admin_incomes
      WHERE tenant_id = ${tenantId} AND EXTRACT(YEAR FROM date) IN (EXTRACT(YEAR FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE) - 1)
      GROUP BY EXTRACT(YEAR FROM date)
    `,
    sql`
      SELECT 
        EXTRACT(YEAR FROM date) as year,
        SUM(amount) as total
      FROM admin_expenses
      WHERE tenant_id = ${tenantId} AND EXTRACT(YEAR FROM date) IN (EXTRACT(YEAR FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE) - 1)
      GROUP BY EXTRACT(YEAR FROM date)
    `,
    sql`
      SELECT 
        category as name,
        SUM(amount) as value
      FROM admin_expenses
      WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      GROUP BY category
      ORDER BY value DESC
    `,
    sql`
      SELECT 
        category as name,
        SUM(amount) as value
      FROM admin_incomes
      WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      GROUP BY category
      ORDER BY value DESC
    `,
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE tenant_id = ${tenantId} AND date_trunc('month', date) = date_trunc('month', current_date)`,
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE tenant_id = ${tenantId} AND date_trunc('month', date) = date_trunc('month', current_date - interval '1 month')`,
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE tenant_id = ${tenantId} AND date_trunc('month', date) = date_trunc('month', current_date)`,
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE tenant_id = ${tenantId} AND date_trunc('month', date) = date_trunc('month', current_date - interval '1 month')`,
    sql`SELECT COUNT(*) as count FROM admin_clients WHERE tenant_id = ${tenantId}`,
    import('./accounts').then(m => m.getAccounts(start, end, tenantId))
  ]);

  const totalAssets = accounts.reduce((sum: number, a: any) => sum + (a.currentBalance || 0), 0);
  const totalAfterDebts = totalAssets;
  const totalCapital = 0;

  const totalIncome = incomes[0]?.total ? parseFloat(incomes[0].total) : 0;
  const totalExpenses = expenses[0]?.total ? parseFloat(expenses[0].total) : 0;
  const netProfit = totalIncome - totalExpenses;

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const previousIncome = parseFloat(incomeByYear.find((r: any) => Math.round(parseFloat(r.year)) === previousYear)?.total || 0);
  const currentIncome = parseFloat(incomeByYear.find((r: any) => Math.round(parseFloat(r.year)) === currentYear)?.total || 0);

  const previousExpense = parseFloat(expenseByYear.find((r: any) => Math.round(parseFloat(r.year)) === previousYear)?.total || 0);
  const currentExpense = parseFloat(expenseByYear.find((r: any) => Math.round(parseFloat(r.year)) === currentYear)?.total || 0);

  const previousNet = previousIncome - previousExpense;
  const currentNet = currentIncome - currentExpense;

  const totalExpenseRange = expenseBreakdownRange.reduce((sum, r) => sum + parseFloat(r.value), 0);
  const totalIncomeRange = incomeBreakdownRange.reduce((sum, r) => sum + parseFloat(r.value), 0);

  const expenseBreakdown = expenseBreakdownRange.map(r => {
    const val = parseFloat(r.value);
    return {
      name: r.name || 'Other',
      value: val,
      percentage: totalExpenseRange > 0 ? parseFloat(((val / totalExpenseRange) * 100).toFixed(1)) : 0
    };
  });

  const incomeBreakdown = incomeBreakdownRange.map(r => {
    const val = parseFloat(r.value);
    return {
      name: r.name || 'Other',
      value: val,
      percentage: totalIncomeRange > 0 ? parseFloat(((val / totalIncomeRange) * 100).toFixed(1)) : 0
    };
  });

  return {
    totalIncome,
    totalExpenses,
    totalAssets,
    totalAfterDebts,
    totalCapital,
    netProfit,
    incomeBreakdown,
    totalClients: parseInt(clientsCountRows[0]?.count || 0, 10),
    unpaidCount: unpaid[0]?.count || 0,
    unpaidAmount: parseFloat(unpaid[0]?.total_amount || 0),
    currentMonthStats: {
      income: parseFloat(thisMonthIncome[0]?.total || 0),
      expenses: parseFloat(thisMonthExpenses[0]?.total || 0),
      lastMonthIncome: parseFloat(lastMonthIncome[0]?.total || 0),
      lastMonthExpenses: parseFloat(lastMonthExpenses[0]?.total || 0),
    },
    invoiceAging: invoiceAging.map(row => ({
      status: row.status,
      amount: parseFloat(row.amount_sum || 0),
      count: parseInt(row.count || 0)
    })),
    chartData: chartDataRaw.map(row => ({
      name: row.name,
      income: parseFloat(row.income),
      expenses: parseFloat(row.expenses),
      year: parseInt(row.year_num, 10)
    })),
    recentInvoices: recentInvoicesRaw.map(row => ({
      id: row.id,
      service: row.service,
      client: row.client,
      amount: parseFloat(row.amount),
      status: row.status,
    })),
    recentQuotations: recentQuotationsRaw.map(row => ({
      id: row.id,
      project: row.project,
      client: row.client,
      amount: parseFloat(row.amount),
      status: row.status,
    })),
    recentTransactions: recentTransactionsRaw.map((row, index) => ({
      id: index,
      type: row.type,
      name: row.name,
      date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(row.amount)
    })),
    netIncomeComparison: {
      previousIncome,
      currentIncome,
      previousExpense,
      currentExpense,
      previousNet,
      currentNet
    },
    expenseBreakdown
  };
}

function getCutoffDate(range: string) {
  const d = new Date();
  if (range === 'this year') return new Date(d.getFullYear(), 0, 1).toISOString();
  if (range === '6 months') { d.setMonth(d.getMonth() - 6); return d.toISOString(); }
  if (range === 'three months') { d.setMonth(d.getMonth() - 3); return d.toISOString(); }
  if (range === 'one month') { d.setMonth(d.getMonth() - 1); return d.toISOString(); }
  return new Date(0).toISOString();
}

// -- INCOMES --
export async function getIncomes(startDate?: string, endDate?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';

  const tenantId = await getTenantId();
  const [statsThisMonth, statsLastMonth, statsYtd, rows] = await Promise.all([
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('month', date) = date_trunc('month', current_date) AND tenant_id = ${tenantId}`,
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('month', date) = date_trunc('month', current_date - interval '1 month') AND tenant_id = ${tenantId}`,
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('year', date) = date_trunc('year', current_date) AND tenant_id = ${tenantId}`,
    sql`
      SELECT 
        i.id, i.date, TO_CHAR(i.date, 'YYYY-MM-DD') as "rawDate", i.amount, c.full_name as client, i.client_id as "clientId", 
        i.description as desc, i.category, i.invoice_id as invoice, i.account_id as "accountId", i.payment_method as "paymentMethod",
        COALESCE(
          i.receipt_url,
          (SELECT slip_url FROM invoice_payment_slips ips WHERE ips.invoice_id = i.invoice_id ORDER BY ips.id DESC LIMIT 1),
          inv.bank_slip
        ) as "receiptUrl",
        CASE WHEN inv.invoice_id IS NOT NULL THEN true ELSE false END as "hasValidInvoice",
        i.created_at
      FROM admin_incomes i
      LEFT JOIN admin_clients c ON i.client_id = c.id AND c.tenant_id = ${tenantId}
      LEFT JOIN invoices inv ON i.invoice_id = inv.invoice_id AND inv.tenant_id = ${tenantId}
      WHERE i.date >= ${start}::timestamp AND i.date <= (${end} || ' 23:59:59.999')::timestamp AND i.tenant_id = ${tenantId}
      ORDER BY i.date DESC, i.created_at DESC, i.id DESC
    `
  ]);

  return {
    thisMonth: parseFloat(statsThisMonth[0]?.total || 0),
    lastMonth: parseFloat(statsLastMonth[0]?.total || 0),
    ytd: parseFloat(statsYtd[0]?.total || 0),
    items: rows.map(r => ({
      ...r,
      rawDate: r.rawDate,
      created_at: r.created_at,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount)
    }))
  };
}

export async function createIncome(data: any) {
  const { error: rbacError } = await requirePermission('incomes', 'insert');
  if (rbacError) throw new Error(rbacError);

  const limitCheck = await checkLimit('incomes');
  // Limit check removed
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const tenantId = await getTenantId();
  // If payment method is bank transfer and no account_id is provided, try to fetch the invoice's bank account
  let accountId = data.accountId || null;
  if (!accountId && data.paymentMethod === 'Bank Transfer') {
    const def = await sql`SELECT id FROM accounts WHERE type = 'Bank Account' AND tenant_id = ${tenantId} LIMIT 1`;
    if (def.length > 0) accountId = def[0].id;
  }

  await sql`
    INSERT INTO admin_incomes (date, amount, description, category, payment_method, invoice_id, client_id, receipt_url, account_id, tenant_id)
    VALUES (${data.date}, ${data.amount}, ${data.description}, ${data.category}, ${data.paymentMethod}, ${data.invoiceId || null}, ${data.clientId || null}, ${data.receiptUrl || null}, ${accountId}, ${tenantId})
  `;

  if (data.invoiceId) {
    if (data.receiptUrl) {
      try {
        const existing = await sql`SELECT id FROM invoice_payment_slips WHERE invoice_id = ${data.invoiceId} AND slip_url = ${data.receiptUrl}`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO invoice_payment_slips (invoice_id, slip_url, amount, status, reviewed_at, review_note)
            VALUES (${data.invoiceId}, ${data.receiptUrl}, ${data.amount}, 'approved', CURRENT_TIMESTAMP, ${data.description || 'Income Receipt'})
          `;
        }
      } catch (err) {
        console.warn("Failed to sync slip to invoice_payment_slips:", err);
      }
    }

    try {
      const invRows = await sql`SELECT total, advance, total_due, payment_status FROM invoices WHERE invoice_id = ${data.invoiceId} AND tenant_id = ${tenantId}`;
      if (invRows.length > 0) {
        const inv = invRows[0];
        const currentDue = parseFloat(inv.total_due != null ? inv.total_due : inv.total);
        const paidAmt = parseFloat(data.amount || '0');
        const newDue = Math.max(0, currentDue - paidAmt);
        const newStatus = newDue < 0.01 ? 'fully paid' : 'partially paid';
        await sql`
          UPDATE invoices
          SET payment_status = ${newStatus},
              total_due = ${newDue}
          WHERE invoice_id = ${data.invoiceId} AND tenant_id = ${tenantId}
        `;
      }
    } catch (err) {
      console.warn("Failed to update invoice status on income creation:", err);
    }
  }

  await logSystemAction(`Created income: Recorded LKR ${data.amount} for "${data.description}"`);
}

export async function createClient(data: { name: string; email: string; company?: string | null; phone?: string | null; address?: string | null; legal_name?: string | null }): Promise<any> {
  const { error: rbacError } = await requirePermission('incomes', 'read');
  if (rbacError) throw new Error(rbacError);

  const limitCheck = await checkLimit('clients');
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const tenantId = await getTenantId();
  const clientId = 'C-' + Date.now();
  await sql`
    INSERT INTO admin_clients (id, full_name, email, company, phone, address, active, legal_name, tenant_id)
    VALUES (${clientId}, ${data.name}, ${data.email}, ${data.company || null}, ${data.phone || null}, ${data.address || null}, true, ${data.legal_name || null}, ${tenantId})
  `;
  await logSystemAction(`Created client: "${data.name}" (${data.email})`);
  return clientId;
}

export async function updateClient(clientId: string, data: { name?: string; email?: string; company?: string | null; phone?: string | null; address?: string | null; legal_name?: string | null }) {
  const { error: rbacError } = await requirePermission('clients', 'insert');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  // Fetch current email first so we can cascade if it changes
  const existing = await sql`SELECT email, full_name FROM admin_clients WHERE id = ${clientId} AND tenant_id = ${tenantId}`;
  if (existing.length === 0) throw new Error("Client not found");
  const oldEmail = existing[0].email as string;
  const clientName = existing[0].full_name || clientId;
  const newEmail = data.email?.trim() || oldEmail;
  const emailChanged = newEmail.toLowerCase() !== oldEmail.toLowerCase();

  // Update admin_clients row
  await sql`
    UPDATE admin_clients
    SET 
      full_name = COALESCE(${data.name  || null}, full_name),
      email   = ${newEmail},
      company = ${data.company ?? null},
      phone   = ${data.phone   ?? null},
      address = ${data.address ?? null},
      legal_name = ${data.legal_name ?? null}
    WHERE id = ${clientId} AND tenant_id = ${tenantId}
  `;

  // Cascade email change to every table that stores user_email
  if (emailChanged) {
    await sql`UPDATE invoices SET user_email = ${newEmail} WHERE LOWER(user_email) = LOWER(${oldEmail}) AND tenant_id = ${tenantId}`;
  }
  await logSystemAction(`Updated client details for "${clientName}" (${clientId})`);
}

export async function deleteClient(clientId: string) {
  const { error: rbacError } = await requirePermission('clients', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  const existing = await sql`SELECT full_name FROM admin_clients WHERE id = ${clientId} AND tenant_id = ${tenantId}`;
  const clientName = existing[0]?.full_name || clientId;
  await sql`DELETE FROM admin_clients WHERE id = ${clientId} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Deleted client: "${clientName}" (${clientId})`);
}

export async function updateIncome(id: number, data: any) {
  const { error: rbacError } = await requirePermission('clients', 'delete');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  let accountId = data.accountId || null;
  if (!accountId && data.paymentMethod === 'Bank Transfer') {
    const def = await sql`SELECT id FROM accounts WHERE type = 'Bank Account' AND tenant_id = ${tenantId} LIMIT 1`;
    if (def.length > 0) accountId = def[0].id;
  }

  await sql`
    UPDATE admin_incomes 
    SET date = ${data.date}, amount = ${data.amount}, description = ${data.description}, category = ${data.category}, payment_method = ${data.paymentMethod}, invoice_id = ${data.invoiceId || null}, client_id = ${data.clientId || null}, receipt_url = ${data.receiptUrl || null}, account_id = ${accountId}
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `;

  if (data.invoiceId && data.receiptUrl) {
    try {
      const existingSlip = await sql`SELECT id FROM invoice_payment_slips WHERE invoice_id = ${data.invoiceId} AND slip_url = ${data.receiptUrl}`;
      if (existingSlip.length === 0) {
        await sql`
          INSERT INTO invoice_payment_slips (invoice_id, slip_url, amount, status, reviewed_at, review_note)
          VALUES (${data.invoiceId}, ${data.receiptUrl}, ${data.amount}, 'approved', CURRENT_TIMESTAMP, ${data.description || 'Income Receipt'})
        `;
      }
    } catch (err) {
      console.warn("Failed to sync slip on updateIncome:", err);
    }
  }

  await logSystemAction(`Updated income ID ${id}: recorded LKR ${data.amount} for "${data.description}"`);
}

export async function deleteIncome(id: number) {
  const { error: rbacError } = await requirePermission('incomes', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  let incomeDesc = "";
  let incomeAmount = 0;
  try {
    // 1. Fetch the income record details before deleting
    const incomeRows = await sql`
      SELECT invoice_id, amount, description
      FROM admin_incomes
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    
    if (incomeRows.length > 0) {
      incomeDesc = incomeRows[0].description || "";
      incomeAmount = parseFloat(incomeRows[0].amount || "0");
    }

    if (incomeRows.length > 0 && incomeRows[0].invoice_id) {
      const income = incomeRows[0];
      const invoiceId = income.invoice_id;
      const deletedAmount = parseFloat(income.amount);
      const isAdvance = income.description?.toLowerCase().includes("advance");

      // 2. Fetch the corresponding invoice
      const invoiceRows = await sql`
        SELECT total, advance, total_due
        FROM invoices
        WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
      `;

      if (invoiceRows.length > 0) {
        const invoice = invoiceRows[0];
        const totalAmount = parseFloat(invoice.total);
        const currentAdvance = parseFloat(invoice.advance || '0');
        const currentTotalDue = parseFloat(invoice.total_due != null ? invoice.total_due : invoice.total);

        let newAdvance = currentAdvance;
        let newTotalDue = currentTotalDue;

        if (isAdvance) {
          newAdvance = Math.max(0, currentAdvance - deletedAmount);
          newTotalDue = Math.max(0, totalAmount - newAdvance);
        } else {
          newTotalDue = Math.min(totalAmount, currentTotalDue + deletedAmount);
        }

        // Determine new status
        let newStatus = 'unpaid';
        if (newTotalDue < 0.01) {
          newStatus = 'fully paid';
        } else if (newTotalDue < totalAmount) {
          if (newAdvance > 0) {
            newStatus = 'advance-paid';
          } else {
            newStatus = 'partially paid';
          }
        }

        // Update invoice fields
        await sql`
          UPDATE invoices
          SET payment_status = ${newStatus},
              advance = ${newAdvance},
              total_due = ${newTotalDue}
          WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
        `;
      }
    }
  } catch (e) {
    console.error("Failed to update invoice balance upon income deletion:", e);
  }

  // 3. Delete the income record
  await sql`DELETE FROM admin_incomes WHERE id = ${id} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Deleted income record: "LKR ${incomeAmount}" for "${incomeDesc}" (ID: ${id})`);
}

// -- EXPENSES --
export async function getExpenses(startDate?: string, endDate?: string) {
  await processRecurringExpenses();
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';

  const [statsThisMonth, statsLastMonth, statsYtd, rows] = await Promise.all([
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('month', date) = date_trunc('month', current_date)`,
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('month', date) = date_trunc('month', current_date - interval '1 month')`,
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('year', date) = date_trunc('year', current_date)`,
    sql`
      SELECT id, date, TO_CHAR(date, 'YYYY-MM-DD') as "rawDate", amount, description as desc, category, payment_method as "paidVia", receipt_url as "receiptUrl", account_id as "accountId", created_at
      FROM admin_expenses
      WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      ORDER BY date DESC, created_at DESC, id DESC
    `
  ]);

  return {
    thisMonth: parseFloat(statsThisMonth[0]?.total || 0),
    lastMonth: parseFloat(statsLastMonth[0]?.total || 0),
    ytd: parseFloat(statsYtd[0]?.total || 0),
    items: rows.map(r => ({
      ...r,
      rawDate: r.rawDate,
      created_at: r.created_at,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount)
    }))
  };
}

export async function createExpense(data: any) {
  const { error: rbacError } = await requirePermission('incomes', 'delete');
  if (rbacError) throw new Error(rbacError);

  const limitCheck = await checkLimit('expenses');
  if (!limitCheck.allowed) return { error: limitCheck.error };

  let accountId = data.accountId || null;
  if (!accountId && data.paymentMethod === 'Bank Transfer') {
    const def = await sql`SELECT id FROM accounts WHERE type = 'Bank Account' LIMIT 1`;
    if (def.length > 0) accountId = def[0].id;
  }
  await sql`
    INSERT INTO admin_expenses (date, amount, description, category, payment_method, receipt_url, account_id)
    VALUES (${data.date}, ${data.amount}, ${data.description}, ${data.category}, ${data.paymentMethod}, ${data.receiptUrl || null}, ${accountId})
  `;

  if (data.isScheduled) {
    let nextDate = new Date(data.date);
    if (data.frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (data.frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (data.frequency === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    await sql`
      INSERT INTO admin_scheduled_expenses (title, amount, category, frequency, next_due_date, payment_method, status)
      VALUES (${data.description}, ${data.amount}, ${data.category}, ${data.frequency}, ${nextDate.toISOString().split('T')[0]}, ${data.paymentMethod}, 'active')
    `;
  }
  await logSystemAction(`Created expense: Recorded LKR ${data.amount} for "${data.description}"`);
}

export async function updateExpense(id: number, data: any) {
  const { error: rbacError } = await requirePermission('expenses', 'insert');
  if (rbacError) throw new Error(rbacError);

  let accountId = data.accountId || null;
  if (!accountId && data.paymentMethod === 'Bank Transfer') {
    const def = await sql`SELECT id FROM accounts WHERE type = 'Bank Account' LIMIT 1`;
    if (def.length > 0) accountId = def[0].id;
  }
  await sql`
    UPDATE admin_expenses 
    SET date = ${data.date}, amount = ${data.amount}, description = ${data.description}, category = ${data.category}, payment_method = ${data.paymentMethod}, receipt_url = ${data.receiptUrl || null}, account_id = ${accountId}
    WHERE id = ${id}
  `;
  await logSystemAction(`Updated expense ID ${id}: recorded LKR ${data.amount} for "${data.description}"`);
}

export async function deleteExpense(id: number) {
  const { error: rbacError } = await requirePermission('expenses', 'update');
  if (rbacError) throw new Error(rbacError);

  let expDesc = "";
  let expAmount = 0;
  try {
    const existing = await sql`SELECT description, amount FROM admin_expenses WHERE id = ${id}`;
    if (existing.length > 0) {
      expDesc = existing[0].description || "";
      expAmount = parseFloat(existing[0].amount || "0");
    }
  } catch (e) {}

  await sql`DELETE FROM admin_expenses WHERE id = ${id}`;
  await logSystemAction(`Deleted expense record: "LKR ${expAmount}" for "${expDesc}" (ID: ${id})`);
}

async function ensureScheduledExpensesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_scheduled_expenses (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      category VARCHAR(255) NOT NULL,
      frequency VARCHAR(50) NOT NULL,
      next_due_date DATE NOT NULL,
      payment_method VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active'
    )
  `;
}

export async function processRecurringExpenses() {
  const { error: rbacError } = await requirePermission('expenses', 'delete');
  if (rbacError) return; // Skip automatic processing if user lacks write access

  await ensureScheduledExpensesTable();
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const rows = await sql`
      SELECT id, title, amount, category, frequency, next_due_date, payment_method
      FROM admin_scheduled_expenses
      WHERE status = 'active' AND next_due_date <= ${todayStr}
    `;

    for (const item of rows) {
      let nextDate = new Date(item.next_due_date);
      while (nextDate.toISOString().split('T')[0] <= todayStr) {
        const occurrenceDate = nextDate.toISOString().split('T')[0];

        // 1. Insert into actual expenses
        await sql`
          INSERT INTO admin_expenses (date, amount, description, category, payment_method)
          VALUES (${occurrenceDate}, ${item.amount}, ${item.title + ' (Recurring)'}, ${item.category}, ${item.payment_method})
        `;

        // 2. Roll date forward
        if (item.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (item.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (item.frequency === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          break;
        }
      }

      // 3. Update next due date in db
      await sql`
        UPDATE admin_scheduled_expenses
        SET next_due_date = ${nextDate.toISOString().split('T')[0]}
        WHERE id = ${item.id}
      `;
    }
  } catch (e) {
    console.error("Failed to process recurring expenses:", e);
  }
}

export async function getScheduledExpenses() {
  await ensureScheduledExpensesTable();
  try {
    const rows = await sql`
      SELECT id, title, amount, category, frequency, next_due_date, payment_method as "paymentMethod", status
      FROM admin_scheduled_expenses
      ORDER BY next_due_date ASC
    `;
    return rows.map((r: any) => {
      let dueStr = '';
      if (r.next_due_date) {
        if (typeof r.next_due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.next_due_date)) {
          dueStr = r.next_due_date;
        } else {
          const dObj = new Date(r.next_due_date);
          if (!isNaN(dObj.getTime())) {
            dueStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
          }
        }
      }
      return {
        ...r,
        amount: parseFloat(r.amount),
        next_due_date: dueStr
      };
    });
  } catch (error) {
    console.error("Failed to get scheduled expenses:", error);
    throw new Error("Failed to retrieve scheduled expenses.");
  }
}

export async function createScheduledExpense(data: any) {
  const { error: rbacError } = await requirePermission('expenses', 'read');
  if (rbacError) throw new Error(rbacError);

  await ensureScheduledExpensesTable();
  await sql`
    INSERT INTO admin_scheduled_expenses (title, amount, category, frequency, next_due_date, payment_method, status)
    VALUES (${data.title}, ${data.amount}, ${data.category}, ${data.frequency}, ${data.next_due_date}, ${data.paymentMethod}, 'active')
  `;
}

export async function updateScheduledExpense(id: number, data: any) {
  const { error: rbacError } = await requirePermission('expenses', 'update');
  if (rbacError) throw new Error(rbacError);

  await ensureScheduledExpensesTable();
  await sql`
    UPDATE admin_scheduled_expenses
    SET title = ${data.title}, amount = ${data.amount}, category = ${data.category}, frequency = ${data.frequency}, next_due_date = ${data.next_due_date}, payment_method = ${data.paymentMethod}, status = ${data.status}
    WHERE id = ${id}
  `;
}

export async function deleteScheduledExpense(id: number) {
  const { error: rbacError } = await requirePermission('expenses', 'delete');
  if (rbacError) throw new Error(rbacError);

  await ensureScheduledExpensesTable();
  await sql`DELETE FROM admin_scheduled_expenses WHERE id = ${id}`;
}

export async function payScheduledExpense(id: number) {
  const { error: rbacError } = await requirePermission('expenses', 'insert');
  if (rbacError) throw new Error(rbacError);

  await ensureScheduledExpensesTable();
  const rows = await sql`
    SELECT * FROM admin_scheduled_expenses WHERE id = ${id}
  `;
  if (rows.length === 0) return;
  const item = rows[0];

  // 1. Insert into actual expenses
  await sql`
    INSERT INTO admin_expenses (date, amount, description, category, payment_method)
    VALUES (CURRENT_DATE, ${item.amount}, ${item.title + ' (Scheduled Payment)'}, ${item.category}, ${item.payment_method})
  `;

  // 2. Roll date forward
  let nextDate = new Date(item.next_due_date);
  if (item.frequency === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
    await sql`
      UPDATE admin_scheduled_expenses
      SET next_due_date = ${nextDate.toISOString().split('T')[0]}
      WHERE id = ${id}
    `;
  } else if (item.frequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    await sql`
      UPDATE admin_scheduled_expenses
      SET next_due_date = ${nextDate.toISOString().split('T')[0]}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      DELETE FROM admin_scheduled_expenses WHERE id = ${id}
    `;
  }
}

// -- INVOICES --
import { cachedQuery } from '@/lib/db';

export async function getInvoices() {
  const tenantId = await getTenantId();
  if (!tenantId) return { invoices: [], totalIssued: 0, totalRevenue: 0, totalOutstanding: 0 };

  const [totalIssuedCount, rows, nonAdvancePaymentsRows] = await cachedQuery(
    () => Promise.all([
      sql`SELECT COUNT(*) as count FROM invoices WHERE tenant_id = ${tenantId}`,
    sql`
      SELECT 
        i.invoice_id as id, 
        i.user_email as client_email, 
        (SELECT full_name FROM admin_clients c WHERE LOWER(c.email) = LOWER(i.user_email) AND c.tenant_id = ${tenantId} LIMIT 1) as client_name, 
        i.project_name as service, i.subtotal, i.total, i.discount, i.advance, i.tax_rate, i.total_due, i.date as due_date, i.payment_status as status, i.legal_name, i.created_at
      FROM invoices i
      WHERE i.tenant_id = ${tenantId}
      ORDER BY i.date DESC, i.created_at DESC
    `,
    sql`
      SELECT invoice_id, SUM(amount) as paid_sum
      FROM admin_incomes
      WHERE tenant_id = ${tenantId} AND invoice_id IS NOT NULL AND LOWER(description) NOT LIKE 'advance:%' AND LOWER(description) NOT LIKE 'advance payment%'
      GROUP BY invoice_id
    `
    ])
  , [`invoices-${tenantId}`], 3600);
  
  const paymentsMap: Record<string, number> = {};
  nonAdvancePaymentsRows.forEach((p: any) => {
    paymentsMap[p.invoice_id] = parseFloat(p.paid_sum || '0');
  });

  let paidCount = 0;
  let pendingCount = 0;
  let computedTotalDueSum = 0;

  const items = rows.map(r => {
    const subtotal = parseFloat(r.subtotal || 0);
    const discount = parseFloat(r.discount || 0);
    const advance = parseFloat(r.advance || 0);
    const taxRate = parseFloat(r.tax_rate || 0);
    const taxAmount = subtotal * (taxRate / 100);
    const totalVal = parseFloat(r.total != null ? r.total : (subtotal + taxAmount - discount));
    const nonAdvanceVal = paymentsMap[r.id] || 0;

    const calculatedTotalDue = Math.max(0, totalVal - advance - nonAdvanceVal);

    let status = r.status;
    if (calculatedTotalDue < 0.01) {
      status = 'fully paid';
    }

    if (status === 'fully paid' || status === 'paid') {
      paidCount++;
    } else {
      pendingCount++;
      computedTotalDueSum += calculatedTotalDue;
    }

    return {
      id: r.id,
      created_at: r.created_at,
      client: r.client_name || r.client_email?.split('@')[0] || 'Unknown',
      clientEmail: r.client_email || '',
      client_email: r.client_email || '',
      legalName: r.legal_name || '',
      service: r.service,
      amount: totalVal,
      total_due: calculatedTotalDue,
      due: r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Colombo' }) : '-',
      status: status,
      
      overdue: r.status === 'overdue' || (r.due_date && new Date(r.due_date) < new Date() && status !== 'paid' && status !== 'fully paid')
    };
  });

  return {
    totalIssued: parseInt(totalIssuedCount[0]?.count || '0'),
    paid: paidCount,
    pending: pendingCount,
    totalDue: computedTotalDueSum,
    items: items
  };
}

export async function deleteInvoice(id: string) {
  const { error: rbacError } = await requirePermission('invoices', 'delete');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  let projectName = "";
  try {
    const existing = await sql`SELECT project_name FROM invoices WHERE invoice_id = ${id} AND tenant_id = ${tenantId}`;
    if (existing.length > 0) {
      projectName = existing[0].project_name || "";
    }
  } catch (e) {}

  await sql`
    UPDATE admin_quotations
    SET linked_invoice_id = NULL,
        status = 'draft',
        project_confirmed = false
    WHERE linked_invoice_id = ${id} AND tenant_id = ${tenantId}
  `;

  await sql`DELETE FROM invoice_items WHERE invoice_id = ${id} AND tenant_id = ${tenantId}`;
  await sql`DELETE FROM admin_incomes WHERE invoice_id = ${id} AND tenant_id = ${tenantId}`;
  await sql`DELETE FROM invoices WHERE invoice_id = ${id} AND tenant_id = ${tenantId}`;
  
  await logSystemAction(`Deleted invoice: "${projectName}" (${id})`);
}

export async function getInvoiceByIdAdmin(invoiceId: string) {
  const tenantId = await getTenantId();
  // Join with admin_clients and bank_accs to get client name + billing address + bank account
  const result = await sql`
    SELECT
      i.invoice_id,
      i.user_email,
      i.project_name,
      i.date,
      i.currency,
      i.category,
      i.subtotal,
      i.discount,
      i.total,
      i.advance,
      i.total_due,
      i.work_status,
      i.payment_status,
      i.bank_account_id,
      i.tax_rate,
      i.legal_name,
      i.bank_slip,
      COALESCE((SELECT full_name FROM admin_clients ac WHERE LOWER(ac.email) = LOWER(i.user_email) AND ac.tenant_id = ${tenantId} LIMIT 1), i.user_email) as client_name,
      (SELECT address FROM admin_clients ac WHERE LOWER(ac.email) = LOWER(i.user_email) AND ac.tenant_id = ${tenantId} LIMIT 1) as billing_address,
      ba.name as bank_acc_name,
      ba.account_number as bank_acc_number,
      ba.bank_name as bank_acc_bank,
      ba.branch as bank_acc_branch
    FROM invoices i
    LEFT JOIN accounts ba ON COALESCE(i.bank_account_id, (SELECT id FROM accounts WHERE type = 'Bank Account' AND tenant_id = ${tenantId} LIMIT 1)) = ba.id
    WHERE i.invoice_id = ${invoiceId} AND i.tenant_id = ${tenantId}
  `;

  if (result.length === 0) return null;
  const invoice = result[0];

  const itemsResult = await sql`
    SELECT description, price, total, quantity 
    FROM invoice_items 
    WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
    ORDER BY id ASC
  `;

  const payments = await sql`
    SELECT id, date, amount, payment_method, description, receipt_url, created_at
    FROM admin_incomes
    WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
    ORDER BY date DESC, created_at DESC, id DESC
  `;

  const slipRows = await sql`
    SELECT id, slip_url, amount, status, uploaded_at, review_note
    FROM invoice_payment_slips
    WHERE invoice_id = ${invoiceId}
    ORDER BY uploaded_at DESC, id DESC
  `;

  invoice.items = itemsResult;
  invoice.payments = payments.map(p => ({
    id: p.id,
    date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Colombo' }),
    amount: parseFloat(p.amount),
    method: p.payment_method,
    description: p.description,
    receipt_url: p.receipt_url
  }));

  const mappedSlips = slipRows.map(s => ({
    id: s.id,
    url: s.slip_url,
    amount: parseFloat(s.amount),
    status: s.status,
    uploaded_at: s.uploaded_at,
    review_note: s.review_note
  }));

  for (const inc of payments) {
    if (inc.receipt_url && !mappedSlips.some(s => s.url === inc.receipt_url)) {
      mappedSlips.push({
        id: `income-${inc.id}`,
        url: inc.receipt_url,
        amount: parseFloat(inc.amount || 0),
        status: 'approved',
        uploaded_at: inc.created_at || inc.date || null,
        review_note: inc.description || 'Income Receipt'
      });
    }
  }

  const advanceVal  = parseFloat(invoice.advance || 0);
  const subtotalVal = parseFloat(invoice.subtotal || 0);
  const discountVal = parseFloat(invoice.discount || 0);
  const taxRateVal  = parseFloat(invoice.tax_rate || 0);
  const taxAmountVal = subtotalVal * (taxRateVal / 100);
  const totalVal    = parseFloat(invoice.total || (subtotalVal + taxAmountVal - discountVal));

  if (invoice.bank_slip && !mappedSlips.some(s => s.url === invoice.bank_slip)) {
    mappedSlips.push({
      id: 'legacy',
      url: invoice.bank_slip,
      amount: advanceVal > 0 ? advanceVal : totalVal,
      status: invoice.payment_status === 'on review' ? 'pending' : (invoice.payment_status === 'fully paid' || invoice.payment_status === 'advance-paid' ? 'approved' : 'pending'),
      uploaded_at: invoice.date || null,
      review_note: 'Bank Slip'
    });
  }

  invoice.payment_slips = mappedSlips;

  const nonAdvancePayments = (invoice.payments || [])
    .filter((p: any) => !String(p.description || '').toLowerCase().startsWith('advance'))
    .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

  const calculatedTotalDue = Math.max(0, totalVal - advanceVal - nonAdvancePayments);
  invoice.total_due = calculatedTotalDue;
  invoice.payments_total = nonAdvancePayments;

  return invoice;
}

// -- CLIENTS --
export async function getClients() {
  const clerk = await clerkClient();
  const tenantId = await getTenantId();

  const rows = await sql`
    SELECT c.id,
           c.full_name as name,
           c.email,
           c.active,
           c.company,
           c.phone,
           c.address,
           c.clerk_id,
           c.legal_name,
           (SELECT COUNT(*) FROM invoices i WHERE LOWER(i.user_email) = LOWER(c.email) AND i.tenant_id = ${tenantId}) as invoices,
           COALESCE((SELECT SUM(amount) FROM admin_incomes inc WHERE inc.client_id = c.id AND inc.tenant_id = ${tenantId}), 0) as revenue,
           (SELECT COUNT(*) FROM admin_incomes inc WHERE inc.client_id = c.id AND inc.tenant_id = ${tenantId}) as income_count,
           (SELECT COUNT(*) FROM invoices i WHERE LOWER(i.user_email) = LOWER(c.email) AND i.tenant_id = ${tenantId}) as project_count
    FROM admin_clients c
    WHERE c.tenant_id = ${tenantId}
    ORDER BY c.id DESC
  `;

  const clients = await Promise.all(
    rows.map(async (r) => {
      let imageUrl: string | null = null;
      if (r.email) {
        imageUrl = getGravatarUrl(r.email.trim());
      }

      return {
        id: r.id,
        name: r.name || r.email.split('@')[0],
        email: r.email,
        clerkId: r.clerk_id || null,
        active: r.active,
        company: r.company,
        phone: r.phone,
        address: r.address,
        legalName: r.legal_name || "",
        imageUrl,
        invoices: parseInt(r.invoices),
        revenue: parseFloat(r.revenue),
        incomeCount: parseInt(r.income_count),
        projectCount: parseInt(r.project_count),
      };
    })
  );

  return clients;
}


export async function getClientById(clientId: string) {
  const clerk = await clerkClient();

  const rows = await sql`
    SELECT c.id,
           c.full_name as name,
           c.email,
           c.active,
           c.company,
           c.phone,
           c.address,
           c.clerk_id,
           c.website,
           c.legal_name
    FROM admin_clients c
    WHERE c.id = ${clientId}
  `;

  if (rows.length === 0) return null;
  const c = rows[0];

  let imageUrl = null;
  if (c.email) {
    imageUrl = getGravatarUrl(c.email.trim());
  }

  const invoices = await sql`
    SELECT invoice_id as id, project_name as service, total as amount, date as due_date, payment_status as status, created_at
    FROM invoices
    WHERE LOWER(user_email) = LOWER(${c.email})
    ORDER BY date DESC, created_at DESC
  `;

  // Also fetch manual income entries linked to this client
  const incomes = await sql`
    SELECT id, description as service, amount, date, category, invoice_id, created_at
    FROM admin_incomes
    WHERE client_id = ${clientId}
    ORDER BY date DESC, created_at DESC, id DESC
  `;

  // Build unified orders list — skip income rows already represented by a linked invoice
  const invoiceIds = new Set(invoices.map((r: any) => r.id));

  const invoiceOrders = invoices.map((r: any) => ({
    id: r.id,
    type: 'invoice',
    service: r.service,
    amount: parseFloat(r.amount),
    date: r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
    status: r.status,
    overdue: r.status === 'overdue' || (r.due_date && new Date(r.due_date) < new Date() && r.status !== 'fully paid'),
    rawDate: r.due_date ? new Date(r.due_date) : new Date(0),
  }));

  const incomeOrders = incomes
    .filter((r: any) => !r.invoice_id || !invoiceIds.has(r.invoice_id))
    .map((r: any) => ({
      id: `INC-${r.id}`,
      type: 'income',
      service: r.service || r.category || 'Income',
      amount: parseFloat(r.amount),
      date: r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
      status: 'fully paid', // manual incomes are already received
      overdue: false,
      rawDate: r.date ? new Date(r.date) : new Date(0),
    }));

  const orders = [...invoiceOrders, ...incomeOrders]
    .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    id: c.id,
    name: c.name || c.email.split('@')[0],
    email: c.email,
    active: c.active,
    company: c.company,
    phone: c.phone,
    address: c.address,
    website: c.website,
    legalName: c.legal_name || "",
    imageUrl,
    orders,
    invoices: invoiceOrders, // kept for backward compatibility
  };
}

async function generateUniqueInvoiceId(): Promise<string> {
  while (true) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const invoiceId = `INV-${num}`;
    const existing = await sql`SELECT 1 FROM invoices WHERE invoice_id = ${invoiceId}`;
    if (existing.length === 0) {
      return invoiceId;
    }
  }
}

export async function createInvoice(invoiceData: any, lineItems: any[]) {
  const { error: rbacError } = await requirePermission('invoices', 'insert');
  if (rbacError) throw new Error(rbacError);

  const limitCheck = await checkLimit('invoices');
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const tenantId = await getTenantId();
  // Upsert client — also save billing address if provided
  const existingClient = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${invoiceData.userEmail}) AND tenant_id = ${tenantId}`;
  
  if (existingClient.length === 0 && invoiceData.userEmail) {
    const clientId = 'C-' + Date.now();
    await sql`
      INSERT INTO admin_clients (id, full_name, company, email, phone, address, active, legal_name, tenant_id)
      VALUES (
        ${clientId},
        ${invoiceData.clientName || invoiceData.userEmail.split('@')[0]},
        ${invoiceData.company || null},
        ${invoiceData.userEmail},
        ${invoiceData.phone || null},
        ${invoiceData.billingAddress || null},
        true,
        ${invoiceData.legalName || null},
        ${tenantId}
      )
    `;
  } else if (existingClient.length > 0) {
    // Update name/address on existing client whenever new values were entered
    await sql`
      UPDATE admin_clients
      SET 
        full_name = COALESCE(${invoiceData.clientName || null}, full_name),
        address = COALESCE(${invoiceData.billingAddress || null}, address),
        legal_name = COALESCE(${invoiceData.legalName || null}, legal_name)
      WHERE LOWER(email) = LOWER(${invoiceData.userEmail}) AND tenant_id = ${tenantId}
    `;
  }

  const invoiceId = await generateUniqueInvoiceId();
  await sql`
  INSERT INTO invoices (
    invoice_id, user_email, project_name, date, 
    subtotal, discount, total, advance, total_due, 
    work_status, payment_status, currency, category, bank_account_id, tax_rate, legal_name, tenant_id
  ) VALUES (
    ${invoiceId}, ${invoiceData.userEmail},
    ${invoiceData.projectName}, ${invoiceData.date},
    ${invoiceData.subtotal}, ${invoiceData.discount}, ${invoiceData.total}, ${invoiceData.advance}, ${invoiceData.totalDue},
    ${invoiceData.workStatus}, ${invoiceData.paymentStatus}, ${invoiceData.currency}, ${invoiceData.category || null},
    ${invoiceData.bankAccountId || null}, ${parseFloat(invoiceData.taxRate) || 0}, ${invoiceData.legalName || null}, ${tenantId}
  )
`;

  for (const item of lineItems) {
    if (item.description) {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total, tenant_id)
        VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate}, ${tenantId})
      `;
    }
  }

  await logSystemAction(`Created invoice: "${invoiceData.projectName}" (${invoiceId}) for LKR ${invoiceData.total}`);
  return { success: true, invoiceId };
}

export async function updateInvoice(invoiceId: string, invoiceData: any, lineItems: any[]) {
  const { error: rbacError } = await requirePermission('invoices', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  // If a billing address was edited, persist it back to admin_clients
  if (invoiceData.billingAddress) {
    await sql`
      UPDATE admin_clients
      SET 
        address = ${invoiceData.billingAddress},
        legal_name = COALESCE(${invoiceData.legalName || null}, legal_name)
      WHERE LOWER(email) = LOWER(${invoiceData.userEmail}) AND tenant_id = ${tenantId}
    `;
  }

  const existingPayments = await sql`
    SELECT amount, description FROM admin_incomes WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
  `;
  const nonAdvancePayments = existingPayments
    .filter((p: any) => !String(p.description || '').toLowerCase().startsWith('advance'))
    .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

  const subtotalVal = parseFloat(invoiceData.subtotal || 0);
  const discountVal = parseFloat(invoiceData.discount || 0);
  const advanceVal  = parseFloat(invoiceData.advance || 0);
  const taxRateVal  = parseFloat(invoiceData.taxRate || 0);
  const taxAmountVal = subtotalVal * (taxRateVal / 100);
  const totalVal    = parseFloat(invoiceData.total || (subtotalVal + taxAmountVal - discountVal));
  const calculatedTotalDue = Math.max(0, totalVal - advanceVal - nonAdvancePayments);

  await sql`
  UPDATE invoices SET
    user_email = ${invoiceData.userEmail},
    project_name = ${invoiceData.projectName},
    date = ${invoiceData.date},
    subtotal = ${invoiceData.subtotal},
    discount = ${invoiceData.discount},
    total = ${invoiceData.total},
    advance = ${invoiceData.advance},
    total_due = ${calculatedTotalDue},
    
    payment_status = ${invoiceData.paymentStatus},
    currency = ${invoiceData.currency},
    category = ${invoiceData.category || null},
    bank_account_id = ${invoiceData.bankAccountId || null},
    tax_rate = ${parseFloat(invoiceData.taxRate) || 0},
    legal_name = ${invoiceData.legalName || null}
  WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}
`;

  await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId} AND tenant_id = ${tenantId}`;

  for (const item of lineItems) {
    if (item.description) {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total, tenant_id)
        VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate}, ${tenantId})
      `;
    }
  }

  await logSystemAction(`Updated invoice: "${invoiceData.projectName}" (${invoiceId})`);
  return { success: true };
}

// -- REPORTS --
export async function getReports(startDate?: string, endDate?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';
  const tenantId = await getTenantId();

  const [incomeStats, expenseStats, rawIncome, expensesBreakdown, journalEntriesRaw, taxRes, unpaidRes] = await Promise.all([
    sql`SELECT SUM(amount) as total FROM admin_incomes WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp`,
    sql`SELECT SUM(amount) as total FROM admin_expenses WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp`,
    sql`
      SELECT category, amount
      FROM admin_incomes
      WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
    `,
    sql`
      SELECT category as name, SUM(amount) as value
      FROM admin_expenses
      WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      GROUP BY category
      ORDER BY value DESC
    `,
    sql`
      SELECT id, 'income' as type, description, date, created_at, amount, category, payment_method, invoice_id FROM admin_incomes WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      UNION ALL
      SELECT id, 'expense' as type, description, date, created_at, amount, category, payment_method, NULL as invoice_id FROM admin_expenses WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
      ORDER BY date DESC, created_at DESC
    `,
    sql`SELECT SUM(subtotal * (tax_rate / 100)) as tax_collected FROM invoices WHERE tenant_id = ${tenantId} AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp`,
    sql`SELECT SUM(total_due) as unpaid_invoices FROM invoices WHERE tenant_id = ${tenantId} AND payment_status != 'paid'`
  ]);

  const { getAccounts } = await import('./accounts');
  const allAccounts = await getAccounts(start, end);
  const bankBalance = allAccounts.reduce((sum: number, acc: any) => sum + acc.currentBalance, 0);

  const totalIncome = parseFloat(incomeStats[0]?.total || 0);
  const totalExpenses = parseFloat(expenseStats[0]?.total || 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';

  const serviceMap: Record<string, number> = {};
  for (const row of rawIncome) {
    const rawCategory = (row.category || 'Other').trim();
    const categoryName = rawCategory
      ? rawCategory.split(',').map((s: string) => s.trim()).filter(Boolean).join(' + ') || 'Other'
      : 'Other';
    serviceMap[categoryName] = (serviceMap[categoryName] || 0) + parseFloat(row.amount);
  }
  const incomeByService = Object.entries(serviceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const journalEntries = journalEntriesRaw.map((r: any) => ({
    id: `${r.type}-${r.id}`,
    rawId: r.id,
    type: r.type,
    description: r.description || '',
    date: r.date,
    amount: parseFloat(r.amount || 0),
    category: r.category || 'Other',
    paymentMethod: r.payment_method || 'Cash',
    invoiceId: r.invoice_id || null
  }));

  const taxCollected = parseFloat(taxRes[0]?.tax_collected || 0);
  const unpaidInvoices = parseFloat(unpaidRes[0]?.unpaid_invoices || 0);

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    profitMargin,
    incomeByService,
    expensesBreakdown: expensesBreakdown.map(r => ({ name: r.name || 'Other', value: parseFloat(r.value) })),
    journalEntries,
    advanced: {
      taxCollected,
      assets: {
        bankBalance,
        accountsReceivable: unpaidInvoices,
        total: bankBalance + unpaidInvoices
      },
      liabilities: {
        accountsPayable: 0,
        total: 0
      },
      equity: bankBalance + unpaidInvoices
    }
  };
}

// -- QUOTATIONS --
export async function getQuotations(startDate?: string, endDate?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';
  const tenantId = await getTenantId();
  
  const rows = await sql`
    SELECT q.id, q.date, q.amount, q.advance, q.total_due as "totalDue", q.discount, q.bank_account_id as "bankAccountId",
           c.full_name as client, c.email as "clientEmail", q.client_id as "clientId", q.description as desc, q.category,
           q.invoice_id as invoice, q.receipt_url as "receiptUrl", q.status, q.project_confirmed as "projectConfirmed", q.legal_name as "legalName", q.created_at
    FROM admin_quotations q
    LEFT JOIN admin_clients c ON q.client_id = c.id AND c.tenant_id = ${tenantId}
    WHERE q.date >= ${start}::timestamp AND q.date <= (${end} || ' 23:59:59.999')::timestamp AND q.tenant_id = ${tenantId}
    ORDER BY q.date DESC, q.created_at DESC, q.id DESC
  `;
 
  const confirmedCount = rows.filter((r: any) => r.status === 'confirmed').length;
  const totalValue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);
 
  return {
    confirmedCount,
    totalValue,
    items: rows.map(r => ({
      ...r,
      created_at: r.created_at,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount),
      advance: parseFloat(r.advance || 0),
      discount: parseFloat(r.discount || 0),
      bankAccountId: r.bankAccountId,
      clientEmail: r.clientEmail || '',
      legalName: r.legalName || '',
      totalDue: parseFloat(r.totalDue || r.amount),
      paymentMethod: 'Bank Transfer'
    }))
  };
}
 
// ─── REPLACE createQuotation in actions.ts ───────────────────────────────────
export async function createQuotation(data: any, lineItems: any[] = []) {
  const { error: rbacError } = await requirePermission('invoices', 'read');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  const advance = data.advance || 0;
  const discount = data.discount || 0;
  const totalDue = data.totalDue ?? (data.amount - advance);

  if (data.clientId && data.billingAddress) {
    await sql`
      UPDATE admin_clients
      SET 
        address = ${data.billingAddress},
        legal_name = COALESCE(${data.legalName || null}, legal_name)
      WHERE id = ${data.clientId} AND tenant_id = ${tenantId}
    `;
  }

  const result = await sql`
    INSERT INTO admin_quotations (
      date, amount, advance, total_due, discount,
      description, category, payment_method, invoice_id, client_id, receipt_url, status, bank_account_id, notes, legal_name, tenant_id
    )
    VALUES (
      ${data.date}, ${data.amount}, ${advance}, ${totalDue}, ${discount},
      ${data.description}, ${data.category}, ${data.paymentMethod},
      ${data.invoiceId || null}, ${data.clientId || null}, ${data.receiptUrl || null}, 'draft', ${data.bankAccountId || null}, ${data.notes || null}, ${data.legalName || null}, ${tenantId}
    )
    RETURNING id
  `;

  const quotationId = result[0].id;

  for (const item of lineItems) {
    if (item.description) {
      await sql`
        INSERT INTO quotation_items (quotation_id, description, quantity, price, total, tenant_id)
        VALUES (${quotationId}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate}, ${tenantId})
      `;
    }
  }
  await logSystemAction(`Created quotation for "${data.description || 'Quotation'}" (ID: ${quotationId}) for LKR ${data.amount}`);
}

// ─── REPLACE updateQuotation in actions.ts ───────────────────────────────────
export async function updateQuotation(id: number, data: any, lineItems: any[] = []) {
  const { error: rbacError } = await requirePermission('clients', 'read');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  try {
    const advance = data.advance || 0;
    const discount = data.discount || 0;
    const totalDue = data.totalDue ?? (data.amount - advance);

    if (data.clientId && data.billingAddress) {
      await sql`
        UPDATE admin_clients
        SET 
          address = ${data.billingAddress},
          legal_name = COALESCE(${data.legalName || null}, legal_name)
        WHERE id = ${data.clientId} AND tenant_id = ${tenantId}
      `;
    }

    await sql`
      UPDATE admin_quotations 
      SET 
        date          = ${data.date}, 
        amount        = ${data.amount},
        advance       = ${advance},
        total_due     = ${totalDue},
        discount      = ${discount},
        description   = ${data.description}, 
        category      = ${data.category}, 
        payment_method= ${data.paymentMethod}, 
        invoice_id    = ${data.invoiceId || null}, 
        receipt_url   = ${data.receiptUrl || null},
        bank_account_id = ${data.bankAccountId || null},
        notes         = ${data.notes || null},
        legal_name    = ${data.legalName || null}
      WHERE id = ${id} AND status != 'confirmed' AND tenant_id = ${tenantId}
    `;

    await sql`DELETE FROM quotation_items WHERE quotation_id = ${id} AND tenant_id = ${tenantId}`;

    for (const item of lineItems) {
      if (item.description) {
        await sql`
          INSERT INTO quotation_items (quotation_id, description, quantity, price, total, tenant_id)
          VALUES (${id}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate}, ${tenantId})
        `;
      }
    }
    await logSystemAction(`Updated quotation ID ${id} ("${data.description || 'Quotation'}")`);
  } catch (e) {
    console.error("Failed to update quotation:", e);
    throw new Error("Failed to update quotation");
  }
}
 
export async function deleteQuotation(id: number) {
  const { error: rbacError } = await requirePermission('invoices', 'insert');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  let quoteDesc = "";
  try {
    const existing = await sql`SELECT description FROM admin_quotations WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (existing.length > 0) {
      quoteDesc = existing[0].description || "";
    }
  } catch (e) {}

  const q = await sql`SELECT linked_invoice_id FROM admin_quotations WHERE id = ${id} AND tenant_id = ${tenantId}`;
  const linkedInvoiceId = q[0]?.linked_invoice_id;

  if (linkedInvoiceId) {
    await sql`UPDATE admin_quotations SET linked_invoice_id = NULL WHERE id = ${id} AND tenant_id = ${tenantId}`;
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${linkedInvoiceId} AND tenant_id = ${tenantId}`;
    await sql`DELETE FROM invoices WHERE invoice_id = ${linkedInvoiceId} AND tenant_id = ${tenantId}`;
  }

  await sql`DELETE FROM admin_quotations WHERE id = ${id} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Deleted quotation ID ${id} ("${quoteDesc}")`);
}
 
export async function confirmQuotation(quotationId: number, quotationData: any, projectName: string, bankAccountId: number | null = null) {
  const { error: rbacError } = await requirePermission('invoices', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  const quotation = await sql`
    SELECT q.*, c.id as client_id_val, c.email, c.full_name as client_name, c.company, c.address as billing_address
    FROM admin_quotations q
    LEFT JOIN admin_clients c ON q.client_id = c.id AND c.tenant_id = ${tenantId}
    WHERE q.id = ${quotationId} AND q.tenant_id = ${tenantId}
  `;

  if (quotation.length === 0) throw new Error(`Quotation #${quotationId} not found`);

  const q = quotation[0];

  if (q.status === 'confirmed') {
    throw new Error("Quotation is already confirmed");
  }

  const userEmail = q.email || null;
  if (!userEmail) throw new Error("Quotation has no linked client email — please assign a client before confirming");

  const amount   = parseFloat(q.amount   || 0);
  const discountVal = parseFloat(q.discount || 0);
  const subtotalVal = amount + discountVal; // since amount is total (subtotal - discount), subtotal is amount + discount
  const invoiceTotal = amount; // no need to subtract discount again
  const advanceVal = parseFloat(q.advance || 0);
  const totalDueVal = invoiceTotal - advanceVal;
  const description = q.description || 'Project';

  // Resolve or create client
  let resolvedClientId: string | null = q.client_id_val || null;
  const existingClient = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${userEmail}) AND tenant_id = ${tenantId}`;
  if (existingClient.length === 0) {
    const clientId = 'C-' + Date.now();
    await sql`
      INSERT INTO admin_clients (id, full_name, company, email, phone, address, active, tenant_id)
      VALUES (
        ${clientId},
        ${q.client_name || userEmail.split('@')[0]},
        ${q.company || null},
        ${userEmail},
        null,
        ${q.billing_address || null},
        true,
        ${tenantId}
      )
    `;
    resolvedClientId = clientId;
  } else {
    resolvedClientId = existingClient[0].id;
  }

  const invoiceId = await generateUniqueInvoiceId();

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    
    await sql`
      INSERT INTO invoices (
        invoice_id, user_email, project_name, date,
        subtotal, discount, total, advance, total_due,
         payment_status, currency, bank_account_id, tenant_id
      ) VALUES (
        ${invoiceId},
        ${userEmail},
        ${projectName},
        ${todayStr},
        ${subtotalVal},
        ${discountVal},
        ${invoiceTotal},
        ${advanceVal},
        ${totalDueVal},
        'in progress',
        'unpaid',
        'LKR',
        ${bankAccountId},
        ${tenantId}
      )
    `;

    const qItems = await sql`
      SELECT description, quantity, price, total FROM quotation_items WHERE quotation_id = ${quotationId} AND tenant_id = ${tenantId}
    `;

    if (qItems.length > 0) {
      for (const item of qItems) {
        await sql`
          INSERT INTO invoice_items (invoice_id, description, quantity, price, total, tenant_id)
          VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.price}, ${item.total}, ${tenantId})
        `;
      }
    } else {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total, tenant_id)
        VALUES (${invoiceId}, ${description}, 1, ${amount}, ${amount}, ${tenantId})
      `;
    }

    await sql`
      UPDATE admin_quotations
      SET status = 'confirmed', project_confirmed = true, linked_invoice_id = ${invoiceId}
      WHERE id = ${quotationId} AND tenant_id = ${tenantId}
    `;

    await logSystemAction(`Confirmed quotation ID ${quotationId} for "${projectName}" (Linked Invoice: ${invoiceId})`);

    return { success: true, invoiceId };

  } catch (e: any) {
    console.error("confirmQuotation DB error:", e);
    throw new Error(e?.message ?? "Failed to confirm quotation and create invoice");
  }
}

export async function getQuotationById(quotationId: string) {
  try {
    const tenantId = await getTenantId();
    const quotation = await sql`
      SELECT q.*,
             c.full_name as client_name, c.email, c.company, c.phone,
             c.address as billing_address,
             ba.name as bank_acc_name, ba.account_number as bank_acc_number,
      ba.bank_name as bank_acc_bank,
      ba.branch as bank_acc_branch
      FROM admin_quotations q
      LEFT JOIN admin_clients c ON q.client_id = c.id AND c.tenant_id = ${tenantId}
      LEFT JOIN accounts ba ON COALESCE(q.bank_account_id, (SELECT id FROM accounts WHERE type = 'Bank Account' AND tenant_id = ${tenantId} LIMIT 1)) = ba.id
      WHERE q.id = ${parseInt(quotationId)} AND q.tenant_id = ${tenantId}
    `;
 
    if (quotation.length === 0) return null;
 
    const q = quotation[0];
 
    const itemRows = await sql`
      SELECT id, description, quantity, price, total
      FROM quotation_items
      WHERE quotation_id = ${parseInt(quotationId)}
      ORDER BY id ASC
    `;
 
    return {
      id: q.id,
      date: q.date,
      amount: parseFloat(q.amount),
      advance: parseFloat(q.advance || 0),
      total_due: parseFloat(q.total_due || q.amount),
      billing_address: q.billing_address || '',
      client_name: q.client_name || q.email?.split('@')[0] || '',
      email: q.email,
      company: q.company,
      phone: q.phone,
      project_name: q.description,
      description: q.description,
      category: q.category,
      payment_method: q.payment_method,
      invoice_id: q.invoice_id,
      receipt_url: q.receipt_url,
      status: q.status,
      project_confirmed: q.project_confirmed,
      created_at: q.created_at,
      updated_at: q.updated_at,
      discount: q.discount || 0,
      notes: q.notes || "",
      legal_name: q.legal_name || "",
      bank_account_id: q.bank_account_id,
      bank_acc_name: q.bank_acc_name,
      bank_acc_number: q.bank_acc_number,
      bank_acc_bank: q.bank_acc_bank,
      bank_acc_branch: q.bank_acc_branch,
      items: itemRows.map((i: any) => ({
        id: i.id,
        description: i.description,
        quantity: parseInt(i.quantity),
        rate: parseFloat(i.price),
        total: parseFloat(i.total),
      }))
    };
  } catch (e) {
    console.error("Failed to fetch quotation by ID:", e);
    throw new Error("Failed to fetch quotation");
  }
}


// -- BANK ACCOUNTS --
export async function getBankAccounts() {
  const tenantId = await getTenantId();
  if (!tenantId) return [];
  
  const rows = await sql`
    SELECT id, name, account_number as number, bank_name as bank, branch, 0 as is_default
    FROM accounts
    WHERE type = 'Bank Account' AND tenant_id = ${tenantId}
    ORDER BY id ASC
  `;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    number: r.number,
    bank: r.bank,
    branch: r.branch,
    is_default: Number(r.is_default || 0),
  }));
}

export async function recordInvoicePayment(
  invoiceId: string,
  paidAmount: number,
  paymentMethod: string,
  paymentDate: string,
  isAdvance: boolean
) {
  const { error: rbacError } = await requirePermission('invoices', 'delete');
  if (rbacError) throw new Error(rbacError);

  try {
    // 1. Fetch invoice info
    const invoiceRows = await sql`
      SELECT user_email, project_name, total, currency, category, payment_status, advance, total_due
      FROM invoices
      WHERE invoice_id = ${invoiceId}
    `;
    if (invoiceRows.length === 0) {
      throw new Error("Invoice not found");
    }
    const invoice = invoiceRows[0];
    const totalAmount = parseFloat(invoice.total);
    const currentAdvance = parseFloat(invoice.advance || '0');
    const currentTotalDue = parseFloat(invoice.total_due != null ? invoice.total_due : invoice.total);

    // 2. Fetch or resolve client
    let clientId = null;
    if (invoice.user_email) {
      const clientRows = await sql`
        SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${invoice.user_email})
      `;
      if (clientRows.length > 0) {
        clientId = clientRows[0].id;
      }
    }

    // 3. Create description and category for the income entry
    const description = isAdvance 
      ? `Advance: ${invoice.project_name || 'Project'}`
      : invoice.project_name || 'Payment';
    const category = invoice.category || 'Web dev';

    // 4. Create the income record with receipt_url if available
    let receiptUrlToAttach = null;
    if (invoice.bank_slip) {
      receiptUrlToAttach = invoice.bank_slip;
    } else {
      const existingSlips = await sql`
        SELECT slip_url FROM invoice_payment_slips WHERE invoice_id = ${invoiceId} ORDER BY id DESC LIMIT 1
      `;
      if (existingSlips.length > 0) {
        receiptUrlToAttach = existingSlips[0].slip_url;
      }
    }

    await sql`
      INSERT INTO admin_incomes (date, amount, description, category, payment_method, invoice_id, client_id, receipt_url, account_id)
      VALUES (${paymentDate}, ${paidAmount}, ${description}, ${category}, ${paymentMethod}, ${invoiceId}, ${clientId}, ${receiptUrlToAttach}, ${paymentMethod === 'Bank Transfer' ? invoice.bank_account_id : null})
    `;

    // 5. Update invoice payment fields
    let newAdvance = currentAdvance;
    let newTotalDue = currentTotalDue;
    let newStatus = invoice.payment_status;

    if (isAdvance) {
      newAdvance = currentAdvance + paidAmount;
      newTotalDue = Math.max(0, totalAmount - newAdvance);
      newStatus = 'advance-paid';
    } else {
      newTotalDue = Math.max(0, currentTotalDue - paidAmount);
      const isFullyPaid = newTotalDue < 0.01;
      newStatus = isFullyPaid ? 'fully paid' : 'partially paid';
    }

    await sql`
      UPDATE invoices
      SET payment_status = ${newStatus},
          advance = ${newAdvance},
          total_due = ${newTotalDue}
      WHERE invoice_id = ${invoiceId}
    `;

    await logSystemAction(`Recorded payment of LKR ${paidAmount} via ${paymentMethod} for invoice ${invoiceId}`);

    if (newStatus === "fully paid") {
      // Logic for domain reactivation was removed
    }

    return { success: true };
  } catch (e) {
    console.error("Failed to record invoice payment:", e);
    throw new Error(e instanceof Error ? e.message : "Failed to record invoice payment");
  }
}

export async function submitBankSlip(invoiceId: string, slipBase64: string, amount?: string | number) {
  const { error: rbacError } = await requirePermission('invoices', 'update');
  if (rbacError) throw new Error(rbacError);

  try {
    const invoiceRows = await sql`SELECT total, total_due, category FROM invoices WHERE invoice_id = ${invoiceId}`;
    if (invoiceRows.length === 0) return { success: false, error: "Invoice not found" };

    const invoice = invoiceRows[0];
    const currentDue = parseFloat(invoice.total_due != null ? invoice.total_due : invoice.total || '0');
    let slipAmount = parseFloat(String(amount ?? ''));
    if (isNaN(slipAmount)) slipAmount = currentDue;

    let slipUrl = slipBase64;
    if (typeof slipBase64 === 'string' && slipBase64.startsWith('data:')) {
      const matches = slipBase64.match(/^data:(.+);base64,(.*)$/);
      if (!matches) throw new Error('Invalid slip data');
      const mimeType = matches[1];
      const base64Data = matches[2];
      const fileExtension = mimeType.split('/')[1].split('+')[0] || 'png';
      const binary = Buffer.from(base64Data, 'base64');
      const filename = `admin/payment-slips/${Date.now()}-${invoiceId}.${fileExtension}`;
      const { put } = await import('@vercel/blob');
      const blob = await put(filename, binary, { access: 'public', contentType: mimeType });
      slipUrl = blob.url;
    }

    await sql`
      INSERT INTO invoice_payment_slips (invoice_id, slip_url, amount, status)
      VALUES (${invoiceId}, ${slipUrl}, ${slipAmount}, 'pending')
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Failed to submit bank slip:", err);
    return { success: false, error: err.message };
  }
}

export async function approveBankSlip(invoiceId: string, slipId: number) {
  const { error: rbacError } = await requirePermission('team', 'manage');
  if (rbacError) throw new Error(rbacError);

  try {
    const slipRows = await sql`SELECT amount FROM invoice_payment_slips WHERE invoice_id = ${invoiceId} AND id = ${slipId}`;
    if (slipRows.length === 0) return { success: false, error: "Slip not found" };

    const slipAmount = parseFloat(slipRows[0].amount || "0");
    await sql`
      UPDATE invoice_payment_slips 
      SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${slipId}
    `;

    const paymentDate = new Date().toISOString().split('T')[0];
    await recordInvoicePayment(invoiceId, slipAmount, 'Bank Transfer', paymentDate, false);

    await logSystemAction(`Approved bank slip ${slipId} for invoice ${invoiceId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to approve bank slip:", err);
    return { success: false, error: err.message };
  }
}

export async function declineBankSlip(invoiceId: string, slipId?: string | number) {
  const { error: rbacError } = await requirePermission('team', 'manage');
  if (rbacError) throw new Error(rbacError);

  try {
    let slipRows: any[] = [];
    if (slipId != null) {
      slipRows = await sql`SELECT * FROM invoice_payment_slips WHERE invoice_id = ${invoiceId} AND id = ${slipId}`;
    } else {
      slipRows = await sql`
        SELECT * FROM invoice_payment_slips
        WHERE invoice_id = ${invoiceId} AND status = 'pending'
        ORDER BY uploaded_at ASC, id ASC
        LIMIT 1
      `;
    }

    if (slipRows.length === 0) return { success: false, error: "Slip not found" };
    const slip = slipRows[0];
    if (slip.status !== 'pending') return { success: false, error: "Slip already processed" };

    // Delete the slip image from blob storage if it exists
    const slipUrl = slip.slip_url;
    if (slipUrl && (slipUrl.includes('blob.vercel-storage.com') || slipUrl.includes('public.blob.vercel-storage.com'))) {
      try {
        // Extract the blob path from the URL
        const urlParts = slipUrl.split('.com/');
        if (urlParts.length > 1) {
          const blobPath = urlParts[1];
          await del(blobPath);
        }
      } catch (blobErr) {
        console.warn("Failed to delete slip image from blob storage:", blobErr);
      }
    }

    // Delete the slip record from the database
    await sql`
      DELETE FROM invoice_payment_slips
      WHERE id = ${slip.id}
    `;

    const remainingPendingRows = await sql`
      SELECT id FROM invoice_payment_slips
      WHERE invoice_id = ${invoiceId} AND status = 'pending'
    `;
    const approvedRows = await sql`
      SELECT id FROM invoice_payment_slips
      WHERE invoice_id = ${invoiceId} AND status = 'approved'
    `;

    if (remainingPendingRows.length === 0 && approvedRows.length === 0) {
      await sql`
        UPDATE invoices
        SET payment_status = 'pending'
        WHERE invoice_id = ${invoiceId}
      `;
    }

    await logSystemAction(`Deleted declined bank slip for invoice ${invoiceId}.`);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to decline bank slip:", err);
    return { success: false, error: err.message };
  }
}

export async function undoApprovedBankSlipPayment(invoiceId: string, slipId: number) {
  const { error: rbacError } = await requirePermission('team', 'manage');
  if (rbacError) throw new Error(rbacError);

  try {
    // First, get the specific slip to find its amount
    const slipRows = await sql`
      SELECT amount FROM invoice_payment_slips
      WHERE invoice_id = ${invoiceId} AND id = ${slipId} AND status = 'approved'
    `;

    if (slipRows.length === 0) {
      return { success: false, error: "No approved bank slip found with this ID" };
    }

    const slipAmount = parseFloat(slipRows[0].amount || "0");

    // Find the corresponding income record for this specific slip
    const incomeRows = await sql`
      SELECT id, amount, description
      FROM admin_incomes
      WHERE invoice_id = ${invoiceId}
        AND payment_method = 'Bank Transfer'
        AND amount = ${slipAmount}
      ORDER BY id DESC
      LIMIT 1
    `;

    if (incomeRows.length === 0) {
      // Even if no income record found, we can still mark the slip as declined
      await sql`
        UPDATE invoice_payment_slips
        SET status = 'declined', reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ${slipId}
      `;

      await logSystemAction(`Marked bank slip ${slipId} as declined (no income record to reverse).`);
      return { success: true };
    }

    const incomeId = incomeRows[0].id;

    // Delete the income record
    await deleteIncome(incomeId);

    // Mark the slip as declined
    await sql`
      UPDATE invoice_payment_slips
      SET status = 'declined', reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ${slipId}
    `;

    await logSystemAction(`Declined approved bank slip ${slipId} for invoice ${invoiceId}. Reversed income record of ${slipAmount}.`);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to undo approved bank slip payment:", err);
    return { success: false, error: err.message };
  }
}

export async function adminUploadPaymentSlip(invoiceId: string, slipBase64: string, amount: number) {
  try {
    // Validate amount
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid payment amount" };
    }

    // Process the slip image
    let slipUrl = slipBase64;
    if (typeof slipBase64 === 'string' && slipBase64.startsWith('data:')) {
      const matches = slipBase64.match(/^data:(.+);base64,(.*)$/);
      if (!matches) {
        throw new Error('Invalid slip data');
      }
      const mimeType = matches[1];
      const base64Data = matches[2];
      const fileExtension = mimeType.split('/')[1].split('+')[0] || 'png';
      const binary = Buffer.from(base64Data, 'base64');
      const filename = `admin/payment-slips/${Date.now()}-${invoiceId}.${fileExtension}`;
      const blob = await put(filename, binary, {
        access: 'public',
        contentType: mimeType,
      });
      slipUrl = blob.url;
    }

    // Insert the slip with 'approved' status and mark as admin-uploaded
    await sql`
      INSERT INTO invoice_payment_slips (invoice_id, slip_url, amount, status, reviewed_at, review_note)
      VALUES (${invoiceId}, ${slipUrl}, ${amount}, 'approved', CURRENT_TIMESTAMP, 'Added by admin')
    `;

    await sql`
      UPDATE admin_incomes
      SET receipt_url = ${slipUrl}
      WHERE invoice_id = ${invoiceId} AND receipt_url IS NULL
    `;

    await logSystemAction(`Admin uploaded and auto-approved payment slip for invoice ${invoiceId}: LKR ${amount}`);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to upload admin payment slip:", err);
    return { success: false, error: err.message };
  }
}

// -- PAYMENT SLIPS --
export async function submitPaymentSlip(invoiceId: string, amount: number, slipBase64: string) {
  const { error: rbacError } = await requirePermission('team', 'manage');
  if (rbacError) throw new Error(rbacError);

  try {
    let slipUrl = slipBase64;
    if (typeof slipBase64 === 'string' && slipBase64.startsWith('data:')) {
      const matches = slipBase64.match(/^data:(.+);base64,(.*)$/);
      if (!matches) {
        throw new Error('Invalid slip data');
      }
      const mimeType = matches[1];
      const base64Data = matches[2];
      const fileExtension = mimeType.split('/')[1].split('+')[0] || 'png';
      const binary = Buffer.from(base64Data, 'base64');
      const filename = `admin/payment-slips/${Date.now()}-${invoiceId}.${fileExtension}`;
      const blob = await put(filename, binary, {
        access: 'public',
        contentType: mimeType,
      });
      slipUrl = blob.url;
    }

    await sql`
      INSERT INTO invoice_payment_slips (invoice_id, slip_url, amount, status)
      VALUES (${invoiceId}, ${slipUrl}, ${amount}, 'pending')
    `;

    await logSystemAction(`Payment slip submitted for invoice ${invoiceId}: LKR ${amount}`);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to submit payment slip:", err);
    return { success: false, error: err.message };
  }
}

export async function reviewPaymentSlip(id: number, approved: boolean, reviewerId: string, note?: string) {
  try {
    const slipRows = await sql`SELECT * FROM invoice_payment_slips WHERE id = ${id}`;
    if (slipRows.length === 0) return { success: false, error: "Slip not found" };
    const slip = slipRows[0];

    const invoiceId = slip.invoice_id;
    const amount = slip.amount;

    if (approved) {
      // On approval, find the corresponding invoice and update its payment status
      const invoiceRows = await sql`SELECT * FROM invoices WHERE invoice_id = ${invoiceId}`;
           if (invoiceRows.length > 0) {
        const invoice = invoiceRows[0];
        const newTotalDue = Math.max(0, parseFloat(invoice.total_due) - amount);
        let newStatus = 'partially paid';

        if (newTotalDue < 0.01) {
          newStatus = 'fully paid';
        }

        await sql`
          UPDATE invoices
          SET payment_status = ${newStatus},
              total_due = ${newTotalDue}
          WHERE invoice_id = ${invoiceId}
        `;
      }

      await logSystemAction(`Approved payment slip for invoice ${invoiceId}: LKR ${amount}`);
    } else {
      await logSystemAction(`Declined payment slip for invoice ${invoiceId}: LKR ${amount}`);
    }

    await sql`
      UPDATE invoice_payment_slips
      SET status = ${approved ? 'approved' : 'declined'},
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = ${reviewerId},
          review_note = ${note || null}
      WHERE id = ${id}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Failed to review payment slip:", err);
    return { success: false, error: err.message };
  }
}

export async function getExpenseBreakdownByMode(mode: string) {
  let start = '1970-01-01';
  let end = '2099-12-31';

  const now = new Date();
  if (mode === 'This Month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  } else if (mode === 'Last Month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  } else if (mode === 'This Year') {
    start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
  } else if (mode === 'Last Year') {
    start = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
    end = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
  } // Lifetime is default

  const rows = await sql`
    SELECT 
      category as name,
      SUM(amount) as value
    FROM admin_expenses
    WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp
    GROUP BY category
    ORDER BY value DESC
  `;

  const total = rows.reduce((sum, r) => sum + parseFloat(r.value), 0);
  return rows.map(r => {
    const val = parseFloat(r.value);
    return {
      name: r.name || 'Other',
      value: val,
      percentage: total > 0 ? parseFloat(((val / total) * 100).toFixed(1)) : 0
    };
  });
}

export async function getTopClients() {
  // Lifetime top clients by revenue
  const rows = await sql`
    SELECT 
      c.full_name as name,
      SUM(i.amount) as value
    FROM admin_incomes i
    LEFT JOIN admin_clients c ON i.client_id = c.id
    WHERE c.full_name IS NOT NULL
    GROUP BY c.id, c.full_name
    ORDER BY value DESC
    LIMIT 6
  `;
  return rows.map(r => ({
    name: r.name,
    value: parseFloat(r.value)
  }));
}

export async function getAllLimits() {
  const resources = ['invoices', 'incomes', 'expenses', 'clients', 'accounts'] as const;
  const exceeded: string[] = [];
  for (const r of resources) {
    const check = await checkLimit(r);
    if (!check.allowed) exceeded.push(r);
  }
  return exceeded;
}

export async function getLimitStatus(resource: 'invoices' | 'incomes' | 'expenses' | 'clients' | 'accounts') {
  const check = await checkLimit(resource);
  return check;
}


