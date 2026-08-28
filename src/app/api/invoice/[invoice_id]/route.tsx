import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {  auth, clerkClient  } from '@/lib/auth';

export async function GET(request, { params }) {
  const { invoice_id } = await params;

  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;
  
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT
        i.invoice_id,
        i.user_email,
        i.project_name,
        i.date,
        i.currency,
        i.subtotal,
        i.discount,
        i.total,
        i.advance,
        i.total_due,
        
        i.payment_status,
        i.created_at,
        i.tax_rate,
        i.bank_account_id,
        ba.name as bank_account_name,
        ba.number as bank_account_number,
        ba.bank as bank_account_bank,
        ba.branch as bank_account_branch,
        COALESCE(ac.full_name, i.user_email) as client_name,
        ac.address as billing_address
      FROM public.invoices i
      LEFT JOIN public.admin_clients ac ON LOWER(i.user_email) = LOWER(ac.email)
      LEFT JOIN public.bank_accs ba ON COALESCE(i.bank_account_id, (SELECT id FROM public.bank_accs WHERE is_default = 1 LIMIT 1)) = ba.id
      WHERE i.invoice_id = ${invoice_id} AND LOWER(i.user_email) = LOWER(${userEmail})
    `;

    if (result.length === 0) {
      const invoiceExists = await sql`
        SELECT user_email FROM public.invoices WHERE invoice_id = ${invoice_id}
      `;
      
      if (invoiceExists.length > 0) {
        return NextResponse.json(
          { error: "Unauthorized - This invoice does not belong to you" },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }
    }

    const invoice = result[0] as any;
    
    // Fetch line items
    const itemsResult = await sql`
      SELECT description, price, total, quantity 
      FROM public.invoice_items 
      WHERE invoice_id = ${invoice_id}
      ORDER BY id ASC
    `;
    invoice.items = itemsResult;

    // Fetch payments history
    const paymentsResult = await sql`
      SELECT id, date, amount, payment_method, description, receipt_url 
      FROM public.admin_incomes 
      WHERE invoice_id = ${invoice_id}
      ORDER BY date DESC
    `;
    invoice.payments = paymentsResult.map((p: any) => ({
      id: p.id,
      date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Colombo' }),
      amount: parseFloat(p.amount),
      method: p.payment_method,
      description: p.description,
      receipt_url: p.receipt_url
    }));

    const subtotalVal = parseFloat(invoice.subtotal || 0);
    const discountVal = parseFloat(invoice.discount || 0);
    const advanceVal  = parseFloat(invoice.advance || 0);
    const taxRateVal  = parseFloat(invoice.tax_rate || 0);
    const taxAmountVal = subtotalVal * (taxRateVal / 100);
    const totalVal    = parseFloat(invoice.total || (subtotalVal + taxAmountVal - discountVal));

    const nonAdvancePayments = (invoice.payments || [])
      .filter((p: any) => !String(p.description || '').toLowerCase().startsWith('advance'))
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    const calculatedTotalDue = Math.max(0, totalVal - advanceVal - nonAdvancePayments);
    invoice.total_due = calculatedTotalDue;
    invoice.payments_total = nonAdvancePayments;

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Invoice fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}