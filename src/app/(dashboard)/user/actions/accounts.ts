"use server";
import { checkLimit } from "@/lib/plans";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";
import { getTenantId } from "./actions";

// Fetch all accounts and calculate running balances
export async function getAccounts(startDate?: string, endDate?: string, providedTenantId?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';

  const tenantId = providedTenantId || await getTenantId();
  let rows;
  try {
    rows = await sql`
      SELECT id, name, type, bank_name, account_number, branch, initial_balance, created_at, is_default, is_hidden
      FROM accounts
      WHERE is_hidden IS NOT TRUE AND tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
  } catch (e: any) {
    if (e.message?.includes('does not exist') || String(e).includes('does not exist')) {
      await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE`;
      rows = await sql`
        SELECT id, name, type, bank_name, account_number, branch, initial_balance, created_at, is_default, is_hidden
        FROM accounts
        WHERE is_hidden IS NOT TRUE AND tenant_id = ${tenantId}
        ORDER BY created_at ASC
      `;
    } else {
      throw e;
    }
  }

  const accounts = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    bankName: r.bank_name || "",
    accountNumber: r.account_number || "",
    branch: r.branch || "",
    initialBalance: parseFloat(r.initial_balance || "0"),
    createdAt: r.created_at,
    
    isDefault: r.is_default === true,
    currentBalance: parseFloat(r.initial_balance || "0"),
    periodInflow: 0,
    periodOutflow: 0,
  }));

  if (accounts.length === 0) return accounts;

  const [
    incomesAll,
    expensesAll,
    transfersOutAll,
    transfersInAll,
    incomesPeriod,
    expensesPeriod,
    transfersOutPeriod,
    transfersInPeriod
  ] = await Promise.all([
    sql`SELECT account_id, SUM(amount) as total FROM admin_incomes WHERE account_id IS NOT NULL AND tenant_id = ${tenantId} GROUP BY account_id`,
    sql`SELECT account_id, SUM(amount) as total FROM admin_expenses WHERE account_id IS NOT NULL AND tenant_id = ${tenantId} GROUP BY account_id`,
    sql`SELECT source_account_id as account_id, SUM(amount) as total FROM admin_transfers WHERE source_account_id IS NOT NULL AND tenant_id = ${tenantId} GROUP BY source_account_id`,
    sql`SELECT destination_account_id as account_id, SUM(amount) as total FROM admin_transfers WHERE destination_account_id IS NOT NULL AND tenant_id = ${tenantId} GROUP BY destination_account_id`,
    sql`SELECT account_id, SUM(amount) as total FROM admin_incomes WHERE account_id IS NOT NULL AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId} GROUP BY account_id`,
    sql`SELECT account_id, SUM(amount) as total FROM admin_expenses WHERE account_id IS NOT NULL AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId} GROUP BY account_id`,
    sql`SELECT source_account_id as account_id, SUM(amount) as total FROM admin_transfers WHERE source_account_id IS NOT NULL AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId} GROUP BY source_account_id`,
    sql`SELECT destination_account_id as account_id, SUM(amount) as total FROM admin_transfers WHERE destination_account_id IS NOT NULL AND date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId} GROUP BY destination_account_id`
  ]);

  const toDict = (arr: any[]) => arr.reduce((acc, row) => ({ ...acc, [row.account_id]: parseFloat(row.total || "0") }), {});
  
  const incAllMap = toDict(incomesAll);
  const expAllMap = toDict(expensesAll);
  const trOutAllMap = toDict(transfersOutAll);
  const trInAllMap = toDict(transfersInAll);

  const incPerMap = toDict(incomesPeriod);
  const expPerMap = toDict(expensesPeriod);
  const trOutPerMap = toDict(transfersOutPeriod);
  const trInPerMap = toDict(transfersInPeriod);

  for (const acc of accounts) {
    const id = acc.id;
    acc.currentBalance += (incAllMap[id] || 0) + (trInAllMap[id] || 0);
    acc.currentBalance -= (expAllMap[id] || 0) + (trOutAllMap[id] || 0);
    acc.periodInflow = (incPerMap[id] || 0) + (trInPerMap[id] || 0);
    acc.periodOutflow = (expPerMap[id] || 0) + (trOutPerMap[id] || 0);
  }

  return accounts;
}

export async function createAccount(data: { name: string; type: string; bankName?: string; accountNumber?: string; branch?: string; initialBalance: number; }) {
  const { error: rbacError } = await requirePermission('accounts', 'update');
  if (rbacError) throw new Error(rbacError);

  const limitCheck = await checkLimit('accounts');
  if (!limitCheck.allowed) return { error: limitCheck.error };

  const tenantId = await getTenantId();
  await sql`
    INSERT INTO accounts (name, type, bank_name, account_number, branch, initial_balance, tenant_id)
    VALUES (${data.name}, ${data.type}, ${data.bankName || null}, ${data.accountNumber || null}, ${data.branch || null}, ${data.initialBalance || 0}, ${tenantId})
  `;
  await logSystemAction(`Created account "${data.name}"`);
}

export async function updateAccount(id: number, data: { name: string; type: string; bankName?: string; accountNumber?: string; branch?: string; }) {
  const { error: rbacError } = await requirePermission('accounts', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  await sql`
    UPDATE accounts 
    SET name = ${data.name}, type = ${data.type}, bank_name = ${data.bankName || null}, account_number = ${data.accountNumber || null}, branch = ${data.branch || null}
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `;
  await logSystemAction(`Updated account "${data.name}"`);
}

export async function deleteAccount(id: number) {
  const { error: rbacError } = await requirePermission('accounts', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  // Soft delete by hiding it from the UI.
  // Add 'is_hidden' column if it doesn't exist.
  try {
    await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE`;
  } catch (e) {
    console.error("Failed to add is_hidden column", e);
  }

  await sql`UPDATE accounts SET is_hidden = TRUE WHERE id = ${id} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Deleted account`);
}

export async function transferCash(data: { date: string; sourceAccountId: number; destinationAccountId: number; amount: number; description: string }) {
  const tenantId = await getTenantId();
  await sql`
    INSERT INTO admin_transfers (date, source_account_id, destination_account_id, amount, description, tenant_id)
    VALUES (${data.date}, ${data.sourceAccountId}, ${data.destinationAccountId}, ${data.amount}, ${data.description}, ${tenantId})
  `;
  await logSystemAction(`Transferred LKR ${data.amount} between accounts`);
}

export async function getTransfers() {
  const tenantId = await getTenantId();
  const rows = await sql`
    SELECT t.id, t.date, t.amount, t.description, 
           t.source_account_id, t.destination_account_id,
           sa.name as source_account_name,
           da.name as destination_account_name
    FROM admin_transfers t
    LEFT JOIN accounts sa ON t.source_account_id = sa.id AND sa.tenant_id = ${tenantId}
    LEFT JOIN accounts da ON t.destination_account_id = da.id AND da.tenant_id = ${tenantId}
    WHERE t.tenant_id = ${tenantId}
    ORDER BY t.date DESC, t.id DESC
  `;
  
  return rows.map((r: any) => ({
    id: r.id,
    date: new Date(r.date).toISOString().split('T')[0],
    amount: parseFloat(r.amount || "0"),
    description: r.description || "",
    sourceAccountId: r.source_account_id,
    destinationAccountId: r.destination_account_id,
    sourceAccountName: r.source_account_name || "Unknown",
    destinationAccountName: r.destination_account_name || "Unknown"
  }));
}

export async function updateTransfer(id: number, data: { date: string; sourceAccountId: number; destinationAccountId: number; amount: number; description: string }) {
  const { error: rbacError } = await requirePermission('accounts', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  await sql`
    UPDATE admin_transfers
    SET date = ${data.date}, source_account_id = ${data.sourceAccountId}, destination_account_id = ${data.destinationAccountId}, amount = ${data.amount}, description = ${data.description}
    WHERE id = ${id} AND tenant_id = ${tenantId}
  `;
  await logSystemAction(`Updated cash transfer of LKR ${data.amount}`);
}

export async function deleteTransfer(id: number) {
  const { error: rbacError } = await requirePermission('accounts', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  await sql`DELETE FROM admin_transfers WHERE id = ${id} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Undid a cash transfer`);
}

export async function getLedger(accountId: number | null, startDate?: string, endDate?: string) {
  const start = startDate || '1970-01-01';
  const end = endDate || '2099-12-31';
  const tenantId = await getTenantId();

  let transactions;
  if (accountId) {
    transactions = await sql`
      WITH unified AS (
        SELECT i.date, 
               CASE WHEN c.full_name IS NOT NULL THEN COALESCE(i.description, 'Income') || ' - ' || c.full_name ELSE COALESCE(i.description, 'Income') END as description, 
               'Income' as ref_type, i.id as ref_id, i.account_id, NULL::integer as related_account_id, i.amount as debit, 0 as credit, i.created_at
        FROM admin_incomes i
        LEFT JOIN admin_clients c ON i.client_id = c.id AND c.tenant_id = ${tenantId}
        WHERE i.date >= ${start}::timestamp AND i.date <= (${end} || ' 23:59:59.999')::timestamp AND i.tenant_id = ${tenantId}
        UNION ALL
        SELECT date, description, 'Expense' as ref_type, id as ref_id, account_id, NULL::integer as related_account_id, 0 as debit, amount as credit, created_at
        FROM admin_expenses WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId}
        UNION ALL
        SELECT date, description, 'Transfer Out' as ref_type, id as ref_id, source_account_id as account_id, destination_account_id as related_account_id, 0 as debit, amount as credit, created_at
        FROM admin_transfers WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId}
        UNION ALL
        SELECT date, description, 'Transfer In' as ref_type, id as ref_id, destination_account_id as account_id, source_account_id as related_account_id, amount as debit, 0 as credit, created_at
        FROM admin_transfers WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId}
      )
      SELECT * FROM unified WHERE account_id = ${accountId} ORDER BY date ASC, created_at ASC, ref_type ASC
    `;
  } else {
    transactions = await sql`
      WITH unified AS (
        SELECT i.date, 
               CASE WHEN c.full_name IS NOT NULL THEN COALESCE(i.description, 'Income') || ' - ' || c.full_name ELSE COALESCE(i.description, 'Income') END as description, 
               'Income' as ref_type, i.id as ref_id, i.account_id, NULL::integer as related_account_id, i.amount as debit, 0 as credit, i.created_at
        FROM admin_incomes i
        LEFT JOIN admin_clients c ON i.client_id = c.id AND c.tenant_id = ${tenantId}
        WHERE i.date >= ${start}::timestamp AND i.date <= (${end} || ' 23:59:59.999')::timestamp AND i.tenant_id = ${tenantId}
        UNION ALL
        SELECT date, description, 'Expense' as ref_type, id as ref_id, account_id, NULL::integer as related_account_id, 0 as debit, amount as credit, created_at
        FROM admin_expenses WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId}
        UNION ALL
        SELECT date, description, 'Transfer' as ref_type, id as ref_id, source_account_id as account_id, destination_account_id as related_account_id, amount as debit, amount as credit, created_at
        FROM admin_transfers WHERE date >= ${start}::timestamp AND date <= (${end} || ' 23:59:59.999')::timestamp AND tenant_id = ${tenantId}
      )
      SELECT * FROM unified ORDER BY date ASC, created_at ASC, ref_type ASC
    `;
  }

  return transactions.map((t: any) => ({
    date: new Date(t.date).toISOString().split('T')[0],
    description: t.description || "",
    referenceType: t.ref_type,
    referenceId: t.ref_id,
    accountId: t.account_id,
    relatedAccountId: t.related_account_id,
    debit: parseFloat(t.debit || "0"),
    credit: parseFloat(t.credit || "0"),
  }));
}

export async function setDefaultAccount(id: number) {
  const tenantId = await getTenantId();
  await sql`UPDATE accounts SET is_default = FALSE WHERE tenant_id = ${tenantId}`;
  await sql`UPDATE accounts SET is_default = TRUE WHERE id = ${id} AND tenant_id = ${tenantId}`;
  await logSystemAction(`Set account ID ${id} as default`);
}
