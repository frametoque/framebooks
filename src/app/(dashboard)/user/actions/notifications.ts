"use server";

import sql from "@/lib/db";

export interface NotificationItem {
  id: string;
  type: "finance" | "project" | "agreement" | "system" | "analytics";
  title: string;
  message: string;
  timestamp: string; // ISO date string - used to compute "time ago" on the client
  link?: string; // where clicking the notification should navigate
  read: boolean;
}

export async function fetchLiveNotifications(): Promise<NotificationItem[]> {
  return [];
  const notifications: NotificationItem[] = [];
  const now = Date.now();

  try {
    const [
      activeCountResult,
      analyticsResult,
      signedAgreementsResult,
      pendingQuotationsResult,
      paidInvoicesResult,
      overdueInvoicesResult,
      upcomingAgreementsResult,
      upcomingBookingsResult
    ] = await Promise.allSettled([
      Promise.resolve(0),
      Promise.resolve({}),
      sql`
        SELECT id, client_name, title, client_sig_date,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) * 1000 AS ms_ago
        FROM admin_agreements
        WHERE status = 'signed' AND client_sig_date IS NOT NULL
        ORDER BY updated_at DESC LIMIT 2
      `,
      sql`
        SELECT q.id, q.amount, c.full_name as client, q.category, q.date,
               EXTRACT(EPOCH FROM (NOW() - q.created_at)) * 1000 AS ms_ago
        FROM admin_quotations q
        LEFT JOIN admin_clients c ON q.client_id = c.id
        WHERE q.status IN ('pending', 'client-draft')
        ORDER BY q.date DESC, q.created_at DESC LIMIT 2
      `,
      sql`
        SELECT invoice_id, user_email, total,
               EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000 AS ms_ago
        FROM invoices
        WHERE payment_status = 'fully paid'
        ORDER BY date DESC, created_at DESC LIMIT 2
      `,
      sql`
        SELECT invoice_id, user_email, total,
               EXTRACT(EPOCH FROM (NOW() - due_date)) * 1000 AS ms_ago
        FROM invoices
        WHERE payment_status IN ('unpaid', 'pending') AND due_date < NOW()
        ORDER BY due_date ASC LIMIT 1
      `,
      sql`
        SELECT id, client_name, title,
               EXTRACT(EPOCH FROM (deadline::timestamp - NOW())) * 1000 AS ms_until
        FROM admin_agreements
        WHERE status = 'pending' AND deadline >= NOW() AND deadline <= NOW() + INTERVAL '7 days'
        ORDER BY deadline ASC LIMIT 1
      `,
      sql`
        SELECT id, title, customer_name, booking_date, start_time, event_type,
               EXTRACT(EPOCH FROM ((booking_date::text || ' ' || COALESCE(start_time::text, '00:00:00'))::timestamp - NOW())) * 1000 AS ms_until
        FROM admin_bookings
        WHERE status != 'cancelled' 
          AND (booking_date::text || ' ' || COALESCE(start_time::text, '00:00:00'))::timestamp >= NOW() 
          AND (booking_date::text || ' ' || COALESCE(start_time::text, '00:00:00'))::timestamp <= NOW() + INTERVAL '3 days'
        ORDER BY booking_date ASC, start_time ASC LIMIT 2
      `
    ]);

    const getVal = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === "fulfilled" ? result.value : fallback;

    const activeCount = getVal(activeCountResult, 0);
    const analytics = getVal(analyticsResult, null);
    const signedAgreements = getVal(signedAgreementsResult, [] as any);
    const pendingQuotations = getVal(pendingQuotationsResult, [] as any);
    const paidInvoices = getVal(paidInvoicesResult, [] as any);
    const overdueInvoices = getVal(overdueInvoicesResult, [] as any);
    const upcomingAgreements = getVal(upcomingAgreementsResult, [] as any);
    const upcomingBookings = getVal(upcomingBookingsResult, [] as any);

    // Build an ISO timestamp from a DB-computed ms offset, anchored to *this* request's `now`.
    // This avoids ever asking the Node pg driver to parse a naive TIMESTAMP column back into
    // a Date object, which is where the timezone misinterpretation was happening.
    const fromMsAgo = (msAgo: number | string | null | undefined) =>
      new Date(now - Number(msAgo ?? 0)).toISOString();

    if (activeCount > 0) {
      notifications.push({
        id: "analytics-active-visitors",
        type: "analytics",
        title: "Live Visitors Alert",
        message: `There are currently ${activeCount} active ${activeCount === 1 ? "visitor" : "visitors"} browsing your site right now!`,
        timestamp: new Date(now).toISOString(),
        link: "/user/analytics",
        read: false
      });
    }

    // Analytics module was removed

    for (const ag of signedAgreements) {
      const dateStr = ag.client_sig_date
        ? new Date(ag.client_sig_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      notifications.push({
        id: `agreement-signed-${ag.id || ag.title}`,
        type: "agreement",
        title: "Agreement Signed",
        message: `${ag.client_name} signed the contract for '${ag.title}' on ${dateStr || "recently"}.`,
        timestamp: fromMsAgo(ag.ms_ago),
        link: "/user/agreements/",
        read: false
      });
    }

    for (const q of pendingQuotations) {
      const amtStr = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(parseFloat(q.amount) || 0);
      const dateStr = q.date
        ? new Date(q.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      notifications.push({
        id: `quotation-pending-${q.id}`,
        type: "agreement",
        title: "New Quotation Request",
        message: `Client ${q.client || "Unknown"} requested a quote for ${q.category || "Service"} (${amtStr}) on ${dateStr || "recently"}.`,
        timestamp: fromMsAgo(q.ms_ago),
        link: "/user/quotations/",
        read: false
      });
    }

    for (const inv of paidInvoices) {
      const amtStr = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(parseFloat(inv.total) || 0);
      notifications.push({
        id: `invoice-paid-${inv.invoice_id}`,
        type: "finance",
        title: "Invoice Paid",
        message: `Client ${inv.user_email} settled Invoice #${inv.invoice_id} for ${amtStr}.`,
        timestamp: fromMsAgo(inv.ms_ago),
        link: "/user/invoices/" + inv.invoice_id,
        read: false
      });
    }

    for (const inv of overdueInvoices) {
      const amtStr = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(parseFloat(inv.total) || 0);
      notifications.push({
        id: `invoice-overdue-${inv.invoice_id}`,
        type: "finance",
        title: "Overdue Invoice Alert",
        message: `Invoice #${inv.invoice_id} for ${inv.user_email} (${amtStr}) is past due.`,
        timestamp: fromMsAgo(inv.ms_ago),
        link: "/user/invoices/" + inv.invoice_id,
        read: false
      });
    }

    for (const ag of upcomingAgreements) {
      // ms_until is positive when the deadline is in the future
      const msUntil = Number(ag.ms_until ?? 0);
      const dateStr = new Date(now + msUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      notifications.push({
        id: `agreement-deadline-${ag.id || ag.title}`,
        type: "system",
        title: "Project Delivery Milestone",
        message: `Agreement deadline for '${ag.title}' is coming up on ${dateStr}.`,
        timestamp: new Date(now + msUntil).toISOString(), // future timestamp -> renders as "in X days"
        link: "/user/agreements/" + ag.id,
        read: true
      });
    }

    for (const b of upcomingBookings) {
      const msUntil = Number(b.ms_until ?? 0);
      const dateStr = new Date(now + msUntil).toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric",
        hour: b.start_time ? "2-digit" : undefined,
        minute: b.start_time ? "2-digit" : undefined
      });
      const isTask = b.event_type === 'task_reminder';
      notifications.push({
        id: `booking-upcoming-${b.id}`,
        type: isTask ? "system" : "project",
        title: isTask ? "Upcoming Task" : "Upcoming Booking",
        message: isTask
          ? `Task '${b.title}' is scheduled on ${dateStr}.`
          : `Booking '${b.title}' for client ${b.customer_name} is scheduled on ${dateStr}.`,
        timestamp: new Date(now + msUntil).toISOString(),
        link: "/user/bookings",
        read: false
      });
    }

    if (notifications.length === 0) {
      notifications.push({
        id: "system-fallback-empty",
        type: "system",
        title: "System Update",
        message: "No new financial or client agreement alerts are currently active.",
        timestamp: new Date(now).toISOString(),
        read: true
      });
    }

  } catch (error) {
    console.error("Failed to fetch live notifications:", error);
    return [{
      id: "err-reconciliation-required",
      type: "system",
      title: "Reconciliation Required",
      message: "Monthly general ledger balance review is pending.",
      timestamp: new Date(now).toISOString(),
      read: false
    }];
  }

  // Most recent first
  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return notifications;
}