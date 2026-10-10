"use server";

import sql from "@/lib/db";
import { auth } from '@/lib/auth';
import { revalidatePath } from "next/cache";
import { logSystemAction } from "@/lib/logger";

import { requirePermission } from "./rbac";

async function resolveGraceAndReadOnly(plan: string, planExpiresAt: any, tenantId?: number | null, paymentStatus?: string | null) {
  let is_grace_period = false;
  let is_read_only = false;
  let is_payment_pending = false;
  let grace_days_remaining: number | null = null;
  let grace_end_date: string | null = null;
  let grace_period_days = 7;

  // 1. Explicit admin pending payment flag
  if (paymentStatus === "pending_payment") {
    return {
      grace_period_days: 0,
      is_grace_period: false,
      is_read_only: true,
      is_payment_pending: true,
      grace_days_remaining: 0,
      grace_end_date: null,
      plan_expires_at: planExpiresAt ? new Date(planExpiresAt).toISOString() : null,
    };
  }

  // 2. Check subscription status
  let subStatus: string | null = null;
  let expires = planExpiresAt;
  if (tenantId) {
    try {
      const subRows = await sql`
        SELECT status, current_period_end 
        FROM subscriptions 
        WHERE tenant_id = ${tenantId}
        ORDER BY id DESC LIMIT 1
      `;
      if (subRows.length > 0) {
        subStatus = subRows[0].status;
        if (!expires && subRows[0].current_period_end) {
          expires = subRows[0].current_period_end;
        }
      }
    } catch (err) {}
  }

  if (subStatus === "past_due") {
    return {
      grace_period_days: 0,
      is_grace_period: false,
      is_read_only: true,
      is_payment_pending: true,
      grace_days_remaining: 0,
      grace_end_date: null,
      plan_expires_at: expires ? new Date(expires).toISOString() : null,
    };
  }

  try {
    const settingsRows = await sql`SELECT value FROM platform_settings WHERE key = 'grace_period_days' LIMIT 1`;
    if (settingsRows.length > 0 && settingsRows[0].value != null) {
      grace_period_days = Number(settingsRows[0].value) || 7;
    }
  } catch (err) {
    // default 7
  }

  if (plan && plan.toLowerCase() !== "free" && expires) {
    const expiresAt = new Date(expires);
    const now = new Date();
    const graceEnd = new Date(expiresAt.getTime() + grace_period_days * 24 * 60 * 60 * 1000);
    grace_end_date = graceEnd.toISOString();

    if (now > expiresAt && now <= graceEnd) {
      is_grace_period = true;
      is_read_only = false;
      const msLeft = graceEnd.getTime() - now.getTime();
      grace_days_remaining = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    } else if (now > graceEnd) {
      is_grace_period = false;
      is_read_only = true;
      grace_days_remaining = 0;
    }
  }

  return {
    grace_period_days,
    is_grace_period,
    is_read_only,
    is_payment_pending: false,
    grace_days_remaining,
    grace_end_date,
    plan_expires_at: expires ? new Date(expires).toISOString() : null,
  };
}

export async function getTenantInfo() {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user?.email) {
      return {
        plan: "Free",
        plan_expires_at: null,
        grace_period_days: 7,
        is_grace_period: false,
        is_read_only: false,
        grace_days_remaining: null,
        grace_end_date: null,
        name: "My Business",
        logo_url: null,
        industry: null,
        phone: null,
        email: null,
        website: null,
        address: null,
        userRole: null,
        teamMembersCount: 1,
      };
    }
    
    const email = session?.user?.email?.trim().toLowerCase();
    const numId = Number(userId) || 0;
    const safeId = (numId > 0 && numId < 2147483647) ? numId : 0;

    const userRows = await sql`
      SELECT tenant_id, role 
      FROM admin_users 
      WHERE (id = ${safeId} AND ${safeId} > 0)
         OR (email IS NOT NULL AND LOWER(email) = ${email || ''})
      LIMIT 1
    `;
    if (!userRows || userRows.length === 0 || !userRows[0].tenant_id) {
      return {
        plan: "Free",
        plan_expires_at: null,
        grace_period_days: 7,
        is_grace_period: false,
        is_read_only: false,
        grace_days_remaining: null,
        grace_end_date: null,
        name: "My Business",
        logo_url: null,
        industry: null,
        phone: null,
        email: null,
        website: null,
        address: null,
        userRole: null,
        teamMembersCount: 1
      };
    }
    
    const tenantId = userRows[0].tenant_id;
    const rawRole = userRows[0].role;
    const userRole = rawRole ? (rawRole.toLowerCase() === 'viewer' ? 'Viewer' : rawRole) : null;
    const tenants = await sql`SELECT id, name, plan, plan_expires_at, payment_status, logo_url, industry, phone, email, website, address FROM tenants WHERE id = ${tenantId}`;
    
    const teamMembersCountRows = await sql`SELECT count(*) FROM admin_users WHERE tenant_id = ${tenantId}`;
    const teamMembersCount = parseInt(teamMembersCountRows[0]?.count || '1');

    if (tenants.length > 0) {
      const grace = await resolveGraceAndReadOnly(tenants[0].plan || "Free", tenants[0].plan_expires_at, tenants[0].id, tenants[0].payment_status);
      return { 
        plan: tenants[0].plan || "Free",
        payment_status: tenants[0].payment_status || "paid",
        ...grace,
        name: tenants[0].name || "My Business",
        logo_url: tenants[0].logo_url || null,
        industry: tenants[0].industry || null,
        phone: tenants[0].phone || null,
        email: tenants[0].email || null,
        website: tenants[0].website || null,
        address: tenants[0].address || null,
        userRole: userRole || null,
        teamMembersCount,
      };
    }
    return {
      plan: "Free",
      plan_expires_at: null,
      grace_period_days: 7,
      is_grace_period: false,
      is_read_only: false,
      grace_days_remaining: null,
      grace_end_date: null,
      name: "My Business",
      logo_url: null,
      industry: null,
      phone: null,
      email: null,
      website: null,
      address: null,
      userRole: null,
      teamMembersCount: 1
    };
  } catch (e) {
    console.error("Failed to fetch tenant info:", e);
    return {
      plan: "Free",
      plan_expires_at: null,
      grace_period_days: 7,
      is_grace_period: false,
      is_read_only: false,
      grace_days_remaining: null,
      grace_end_date: null,
      name: "My Business",
      logo_url: null,
      industry: null,
      phone: null,
      email: null,
      website: null,
      address: null,
      userRole: null,
      teamMembersCount: 1
    };
  }
}

export async function updateTenantInfo(data: { 
  name?: string; 
  logo_url?: string | null;
  industry?: string | null; 
  phone?: string | null; 
  email?: string | null; 
  website?: string | null; 
  address?: string | null; 
}) {
  try {
    const { error: rbacError, context } = await requirePermission('settings', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    
    const { tenantId, userId, sql } = context;
    
    await sql`
      UPDATE tenants 
      SET 
        name = ${data.name}, 
        logo_url = ${data.logo_url}, 
        industry = ${data.industry},
        phone = ${data.phone},
        email = ${data.email},
        website = ${data.website},
        address = ${data.address}
      WHERE id = ${tenantId}
    `;

    // Add audit log
    await logSystemAction(`Business Profile Updated: changed details for ${data.name || 'tenant'}`);
    
    revalidatePath("/user/settings");
    return { success: true };
  } catch (e) {
    console.error("Failed to update tenant info:", e);
    return { success: false, error: "Failed to update business profile" };
  }
}

export async function getTenantUsage() {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (!userRows || userRows.length === 0) return null;
    
    const tenantId = userRows[0].tenant_id;
    
    const [invoices, incomes, expenses, clients, accounts, tenantRows] = await Promise.all([
      sql`SELECT count(*) FROM invoices WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_clients WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM accounts WHERE tenant_id = ${tenantId}`,
      sql`SELECT lifetime_invoices, lifetime_incomes, lifetime_expenses, lifetime_clients, lifetime_accounts FROM tenants WHERE id = ${tenantId}`,
    ]);
    
    const t = tenantRows[0] || {};
    const invCount = parseInt(invoices[0].count) || 0;
    const incCount = parseInt(incomes[0].count) || 0;
    const expCount = parseInt(expenses[0].count) || 0;
    const clientCount = parseInt(clients[0].count) || 0;
    const accCount = parseInt(accounts[0].count) || 0;

    return {
      invoices: Math.max(t.lifetime_invoices ?? 0, invCount),
      incomes: Math.max(t.lifetime_incomes ?? 0, incCount),
      expenses: Math.max(t.lifetime_expenses ?? 0, expCount),
      clients: Math.max(t.lifetime_clients ?? 0, clientCount),
      accounts: Math.max(t.lifetime_accounts ?? 0, accCount),
      active: {
        invoices: invCount,
        incomes: incCount,
        expenses: expCount,
        clients: clientCount,
        accounts: accCount,
      },
      lifetime: {
        invoices: t.lifetime_invoices ?? 0,
        incomes: t.lifetime_incomes ?? 0,
        expenses: t.lifetime_expenses ?? 0,
        clients: t.lifetime_clients ?? 0,
        accounts: t.lifetime_accounts ?? 0,
      }
    };
  } catch (e) {
    console.error("Failed to fetch tenant usage:", e);
    return null;
  }
}

export async function getAuditLogs() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, logs: [] };
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (!userRows || userRows.length === 0) return { success: false, logs: [] };
    
    const tenantId = userRows[0].tenant_id;
    
    const logs = await sql`
      SELECT id, action, details, created_at
      FROM audit_logs
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    return { success: true, logs: logs.map(l => ({ ...l, created_at: l.created_at.toISOString() })) };
  } catch (e) {
    console.error("Failed to fetch audit logs:", e);
    return { success: false, logs: [] };
  }
}

export async function getCurrentUserRole() {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const rows = await sql`SELECT role FROM admin_users WHERE id = ${Number(userId) || 0} LIMIT 1`;
    if (rows.length > 0) return rows[0].role;
    return null;
  } catch (e) {
    return null;
  }
}

export async function getTeamMembers() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, members: [] };
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (!userRows || userRows.length === 0) return { success: false, members: [] };
    
    const tenantId = userRows[0].tenant_id;
    
    const members = await sql`
      SELECT id, email, full_name, role, created_at
      FROM admin_users
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
    
    return { success: true, members: members.map(m => ({ ...m, created_at: m.created_at.toISOString() })) };
  } catch (e) {
    console.error("Failed to fetch team members:", e);
    return { success: false, members: [] };
  }
}

export async function updateTeamMemberRole(memberId: number, newRole: string) {
  try {
    const { error: rbacError, context } = await requirePermission('team', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    
    const { tenantId, userId, sql } = context;
    
    // Ensure we don't change another owner's role
    const targetRow = await sql`SELECT role FROM admin_users WHERE id = ${memberId} AND tenant_id = ${tenantId}`;
    if (targetRow.length === 0) return { success: false, error: "Member not found" };
    if (targetRow[0].role === 'owner' || targetRow[0].role === 'Super Admin') {
      return { success: false, error: "Cannot change Super Admin role" };
    }

    await sql`UPDATE admin_users SET role = ${newRole} WHERE id = ${memberId} AND tenant_id = ${tenantId}`;
    
    await logSystemAction(`Updated role for team member ID ${memberId} to ${newRole}`);
    revalidatePath("/user/settings");
    
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update role" };
  }
}

export async function removeTeamMember(memberId: number) {
  try {
    const { error: rbacError, context } = await requirePermission('team', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    
    const { tenantId, userId, sql } = context;
    
    // Ensure we don't remove another owner
    const targetRow = await sql`SELECT role, email FROM admin_users WHERE id = ${memberId} AND tenant_id = ${tenantId}`;
    if (targetRow.length === 0) return { success: false, error: "Member not found" };
    if (targetRow[0].role === 'owner' || targetRow[0].role === 'Super Admin') {
      return { success: false, error: "Cannot remove Super Admin" };
    }

    await sql`UPDATE admin_users SET tenant_id = NULL, role = 'pending' WHERE id = ${memberId} AND tenant_id = ${tenantId}`;
    
    await logSystemAction(`Removed team member ID ${memberId} from the business profile`);
    revalidatePath("/user/settings");
    
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to remove member" };
  }
}

export async function leaveTeam() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const userRows = await sql`SELECT id, tenant_id, role, email FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (userRows.length === 0) return { success: false, error: "Not found" };
    
    if (userRows[0].role === 'owner' || userRows[0].role === 'Super Admin') {
      return { success: false, error: "Super Admin cannot leave the team. You must transfer ownership first." };
    }

    const tenantId = userRows[0].tenant_id;
    const memberId = userRows[0].id;
    const email = userRows[0].email;

    // Create a new free workspace for the user leaving
    const newWorkspace = await sql`
      INSERT INTO tenants (name, plan)
      VALUES ('My Business', 'Free')
      RETURNING id
    `;
    const newTenantId = newWorkspace[0].id;

    await sql`UPDATE admin_users SET tenant_id = ${newTenantId}, role = 'owner' WHERE id = ${Number(userId) || 0}`;
    
    await logSystemAction(`Team member left: ${email}`);
    
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to leave team" };
  }
}

export async function resetWorkspace() {
  try {
    const { error: rbacError, context } = await requirePermission('settings', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    const { tenantId, userId, sql } = context;

    await sql`DELETE FROM admin_incomes WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_scheduled_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM invoices WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_quotations WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_clients WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_inventory WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_transfers WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM accounts WHERE tenant_id = ${tenantId}`;

    await logSystemAction(`Reset Workspace: deleted all records`);

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to reset workspace." };
  }
}

export async function deleteWorkspace() {
  try {
    const { error: rbacError, context } = await requirePermission('settings', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    const { tenantId, userId, sql } = context;

    await sql`DELETE FROM admin_incomes WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_scheduled_expenses WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM invoices WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_quotations WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_clients WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_inventory WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM admin_transfers WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM accounts WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM audit_logs WHERE tenant_id = ${tenantId}`;

    const newWorkspace = await sql`
      INSERT INTO tenants (name, plan)
      VALUES ('My Business', 'Free')
      RETURNING id
    `;
    const newTenantId = newWorkspace[0].id;

    await sql`UPDATE admin_users SET tenant_id = ${newTenantId}, role = 'owner' WHERE id = ${Number(userId) || 0}`;
    
    await sql`DELETE FROM admin_users WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete workspace." };
  }
}

export async function deletePersonalAccount() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const userRows = await sql`SELECT id, tenant_id, role, email FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (userRows.length === 0) return { success: false, error: "Not found" };
    
    if (userRows[0].role === 'owner' || userRows[0].role === 'Super Admin') {
      return { success: false, error: "Workspace owner cannot delete their personal account. Transfer ownership or delete the workspace first." };
    }

    await sql`DELETE FROM admin_users WHERE id = ${Number(userId) || 0}`;

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete personal account." };
  }
}

export async function transferOwnership(newOwnerId: string) {
  try {
    const { error: rbacError, context } = await requirePermission('settings', 'manage');
    if (rbacError || !context) return { success: false, error: rbacError };
    const { tenantId, userId, sql } = context;

    const userRows = await sql`SELECT role FROM admin_users WHERE id = ${Number(userId) || 0} AND tenant_id = ${tenantId}`;
    if (userRows.length === 0 || (userRows[0].role !== 'owner' && userRows[0].role !== 'Super Admin')) {
      return { success: false, error: "Only the owner can transfer ownership." };
    }

    const targetRows = await sql`SELECT id, email FROM admin_users WHERE id = ${newOwnerId} AND tenant_id = ${tenantId}`;
    if (targetRows.length === 0) {
      return { success: false, error: "Selected user not found in this workspace." };
    }

    // Demote current owner to Admin
    await sql`UPDATE admin_users SET role = 'Admin' WHERE id = ${Number(userId) || 0} AND tenant_id = ${tenantId}`;
    
    // Promote new user to owner
    await sql`UPDATE admin_users SET role = 'owner' WHERE id = ${newOwnerId} AND tenant_id = ${tenantId}`;
    await sql`UPDATE tenants SET owner_email = ${targetRows[0].email} WHERE id = ${tenantId}`;

    await logSystemAction(`Transferred ownership to ${targetRows[0].email}`);

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to transfer ownership." };
  }
}

export async function deleteTeamInvitation(invitationId: number) {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) return { success: false, error: rbacError };

  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (!userRows || userRows.length === 0) return { success: false, error: "User not found" };
    const tenantId = userRows[0].tenant_id;

    await sql`
      DELETE FROM team_invitations 
      WHERE id = ${invitationId} AND tenant_id = ${tenantId} AND status = 'pending'
    `;
    
    await logSystemAction(`Deleted a pending team invitation`);
    
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete invitation:", error);
    return { success: false, error: "Failed to delete invitation" };
  }
}

export interface UserBusinessItem {
  id: number;
  name: string;
  logo_url: string | null;
  plan: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
}

export interface PendingInviteItem {
  id: number;
  tenantId: number;
  tenantName: string;
  logoUrl: string | null;
  role: string;
  createdAt: string | null;
}

export interface UserBusinessesResult {
  businesses: UserBusinessItem[];
  pendingInvites: PendingInviteItem[];
  hasOwnedBusiness: boolean;
  activeTenantId: number | null;
}

export async function getUserBusinesses(): Promise<UserBusinessesResult> {
  try {
    const { session } = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return { businesses: [], pendingInvites: [], hasOwnedBusiness: false, activeTenantId: null };
    }

    const userRows = await sql`
      SELECT id, tenant_id, role 
      FROM admin_users 
      WHERE LOWER(email) = ${email} 
      LIMIT 1
    `;
    const activeTenantId = userRows[0]?.tenant_id || null;

    // 1. Check if user owns any tenant
    const ownedTenants = await sql`
      SELECT id, name, logo_url, plan, owner_email 
      FROM tenants 
      WHERE LOWER(owner_email) = ${email}
    `;
    const hasOwnedBusiness = ownedTenants.length > 0;

    // 2. Check accepted team invitations
    const acceptedInvites = await sql`
      SELECT t.id, t.name, t.logo_url, t.plan, ti.role
      FROM team_invitations ti
      JOIN tenants t ON ti.tenant_id = t.id::text
      WHERE LOWER(ti.email) = ${email} AND ti.status = 'accepted'
    `;

    // 3. Fallback: if activeTenantId exists and isn't in owned or accepted, include it
    let fallbackTenants: any[] = [];
    if (activeTenantId && !ownedTenants.some(t => t.id === activeTenantId) && !acceptedInvites.some(t => t.id === activeTenantId)) {
      fallbackTenants = await sql`
        SELECT id, name, logo_url, plan 
        FROM tenants 
        WHERE id = ${activeTenantId}
      `;
    }

    const map = new Map<number, UserBusinessItem>();

    // Add owned
    for (const t of ownedTenants) {
      map.set(t.id, {
        id: t.id,
        name: t.name,
        logo_url: t.logo_url,
        plan: t.plan || 'Free',
        role: 'Owner',
        isOwner: true,
        isActive: t.id === activeTenantId,
      });
    }

    // Add accepted invites
    for (const t of acceptedInvites) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          id: t.id,
          name: t.name,
          logo_url: t.logo_url,
          plan: t.plan || 'Free',
          role: t.role || 'Viewer',
          isOwner: false,
          isActive: t.id === activeTenantId,
        });
      }
    }

    // Add fallback if exists
    for (const t of fallbackTenants) {
      if (!map.has(t.id)) {
        const isOwnerRole = (userRows[0]?.role || '').toLowerCase() === 'owner';
        map.set(t.id, {
          id: t.id,
          name: t.name,
          logo_url: t.logo_url,
          plan: t.plan || 'Free',
          role: userRows[0]?.role || 'Viewer',
          isOwner: isOwnerRole,
          isActive: true,
        });
      }
    }

    // 4. Pending invitations
    const pending = await sql`
      SELECT ti.id, ti.tenant_id, ti.role, ti.created_at, t.name as tenant_name, t.logo_url
      FROM team_invitations ti
      JOIN tenants t ON ti.tenant_id = t.id::text
      WHERE LOWER(ti.email) = ${email} AND ti.status = 'pending'
      ORDER BY ti.created_at DESC
    `;

    return {
      businesses: Array.from(map.values()),
      pendingInvites: pending.map(p => ({
        id: p.id,
        tenantId: Number(p.tenant_id),
        tenantName: p.tenant_name,
        logoUrl: p.logo_url,
        role: p.role || 'Viewer',
        createdAt: p.created_at ? new Date(p.created_at).toISOString() : null,
      })),
      hasOwnedBusiness,
      activeTenantId,
    };
  } catch (err) {
    console.error("getUserBusinesses error:", err);
    return { businesses: [], pendingInvites: [], hasOwnedBusiness: false, activeTenantId: null };
  }
}

export async function switchActiveTenant(targetTenantId: number) {
  try {
    const { session } = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return { success: false, error: "Unauthorized" };

    // Validate user has permission for targetTenantId
    const isOwner = await sql`
      SELECT id FROM tenants WHERE id = ${targetTenantId} AND LOWER(owner_email) = ${email} LIMIT 1
    `;
    const invite = await sql`
      SELECT role FROM team_invitations WHERE tenant_id = ${targetTenantId.toString()} AND LOWER(email) = ${email} AND status = 'accepted' LIMIT 1
    `;

    let newRole = 'Viewer';
    if (isOwner.length > 0) {
      newRole = 'owner';
    } else if (invite.length > 0) {
      newRole = invite[0].role || 'Viewer';
    } else {
      const existing = await sql`SELECT role FROM admin_users WHERE tenant_id = ${targetTenantId} AND LOWER(email) = ${email} LIMIT 1`;
      if (existing.length === 0) {
        return { success: false, error: "You do not have access to this business profile." };
      }
      newRole = existing[0].role || 'Viewer';
    }

    await sql`
      UPDATE admin_users 
      SET tenant_id = ${targetTenantId}, role = ${newRole} 
      WHERE LOWER(email) = ${email}
    `;

    await logSystemAction(`Switched active workspace to tenant ID ${targetTenantId} as ${newRole}`);
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    console.error("switchActiveTenant error:", err);
    return { success: false, error: err?.message || "Failed to switch workspace" };
  }
}

export async function respondToTeamInvitation(invitationId: number, action: 'accept' | 'decline') {
  try {
    const { session } = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return { success: false, error: "Unauthorized" };

    const inviteRows = await sql`
      SELECT id, tenant_id, role 
      FROM team_invitations 
      WHERE id = ${invitationId} AND LOWER(email) = ${email} AND status = 'pending'
      LIMIT 1
    `;
    if (inviteRows.length === 0) {
      return { success: false, error: "Invitation not found or already processed" };
    }

    const invite = inviteRows[0];
    const tenantId = Number(invite.tenant_id);
    const role = invite.role || 'Viewer';

    if (action === 'accept') {
      await sql`UPDATE team_invitations SET status = 'accepted' WHERE id = ${invitationId}`;
      await sql`
        UPDATE admin_users 
        SET tenant_id = ${tenantId}, role = ${role} 
        WHERE LOWER(email) = ${email}
      `;
      await logSystemAction(`Accepted invitation ${invitationId} and switched to tenant ID ${tenantId}`);
      revalidatePath("/", "layout");
      return { success: true, message: "Invitation accepted. Switched to workspace." };
    } else {
      await sql`UPDATE team_invitations SET status = 'declined' WHERE id = ${invitationId}`;
      await logSystemAction(`Declined invitation ${invitationId} for tenant ID ${tenantId}`);
      return { success: true, message: "Invitation declined." };
    }
  } catch (err: any) {
    console.error("respondToTeamInvitation error:", err);
    return { success: false, error: err?.message || "Failed to respond to invitation" };
  }
}

export async function createOwnedBusinessProfile(name: string, currency: string = 'LKR') {
  try {
    const { session } = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    const fullName = session?.user?.name || "";
    if (!email) return { success: false, error: "Unauthorized" };

    if (!name || !name.trim()) {
      return { success: false, error: "Business name is required." };
    }

    // Enforce rule: only one user can create their own business profile from their account!
    const alreadyOwns = await sql`
      SELECT id, name FROM tenants WHERE LOWER(owner_email) = ${email} LIMIT 1
    `;
    if (alreadyOwns.length > 0) {
      return { 
        success: false, 
        error: `You have already created your business profile ("${alreadyOwns[0].name}"). Each account can create at most 1 owned business profile.` 
      };
    }

    const cleanName = name.trim();
    const cleanCurrency = (currency || 'LKR').trim();

    const newTenant = await sql`
      INSERT INTO tenants (name, owner_email, plan, currency, created_at)
      VALUES (${cleanName}, ${email}, 'Free', ${cleanCurrency}, NOW())
      RETURNING id
    `;
    const newTenantId = newTenant[0].id;

    const userRows = await sql`SELECT id FROM admin_users WHERE LOWER(email) = ${email} LIMIT 1`;
    if (userRows.length > 0) {
      await sql`
        UPDATE admin_users 
        SET tenant_id = ${newTenantId}, role = 'owner' 
        WHERE id = ${userRows[0].id}
      `;
    } else {
      await sql`
        INSERT INTO admin_users (email, full_name, tenant_id, role, created_at)
        VALUES (${email}, ${fullName}, ${newTenantId}, 'owner', NOW())
      `;
    }

    await logSystemAction(`Created new owned business profile "${cleanName}" (ID ${newTenantId})`);
    revalidatePath("/", "layout");
    return { success: true, tenantId: newTenantId };
  } catch (err: any) {
    console.error("createOwnedBusinessProfile error:", err);
    return { success: false, error: err?.message || "Failed to create business profile" };
  }
}
