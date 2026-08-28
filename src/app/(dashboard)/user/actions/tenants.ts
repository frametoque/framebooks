"use server";

import sql from "@/lib/db";
import {  auth, clerkClient  } from '@/lib/auth';
import { revalidatePath } from "next/cache";
import { logSystemAction } from "@/lib/logger";

import { requirePermission } from "./rbac";

export async function getTenantInfo() {
  try {
    const { userId } = await auth();
    if (!userId) return { plan: "Free", name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null, teamMembersCount: 1 };
    
    const userRows = await sql`SELECT tenant_id, role FROM admin_users WHERE clerk_id = ${userId}`;
    if (!userRows || userRows.length === 0) {
      const defaultTenant = await sql`SELECT id, name, plan, plan_expires_at, logo_url, industry, phone, email, website, address FROM tenants ORDER BY created_at ASC LIMIT 1`;
      if (defaultTenant.length > 0) return { 
        plan: defaultTenant[0].plan || "Free",
        plan_expires_at: defaultTenant[0].plan_expires_at || null,
        name: defaultTenant[0].name || "My Business",
        logo_url: defaultTenant[0].logo_url || null,
        industry: defaultTenant[0].industry || null,
        phone: defaultTenant[0].phone || null,
        email: defaultTenant[0].email || null,
        website: defaultTenant[0].website || null,
        address: defaultTenant[0].address || null,
        userRole: null,
        teamMembersCount: 1
      };
      return { plan: "Free", plan_expires_at: null, name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null, userRole: null, teamMembersCount: 1 };
    }
    
    const tenantId = userRows[0].tenant_id;
    const userRole = userRows[0].role;
    const tenants = await sql`SELECT name, plan, plan_expires_at, logo_url, industry, phone, email, website, address FROM tenants WHERE id = ${tenantId}`;
    
    const teamMembersCountRows = await sql`SELECT count(*) FROM admin_users WHERE tenant_id = ${tenantId}`;
    const teamMembersCount = parseInt(teamMembersCountRows[0]?.count || '1');

    if (tenants.length > 0) {
      return { 
        plan: tenants[0].plan || "Free",
        plan_expires_at: tenants[0].plan_expires_at || null,
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
    return { plan: "Free", plan_expires_at: null, name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null, userRole: null, teamMembersCount: 1 };
  } catch (e) {
    console.error("Failed to fetch tenant info:", e);
    return { plan: "Free", plan_expires_at: null, name: "My Business", logo_url: null, industry: null, phone: null, email: null, website: null, address: null, userRole: null, teamMembersCount: 1 };
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
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
    if (!userRows || userRows.length === 0) return null;
    
    const tenantId = userRows[0].tenant_id;
    
    const [invoices, incomes, expenses, clients, accounts] = await Promise.all([
      sql`SELECT count(*) FROM invoices WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM admin_clients WHERE tenant_id = ${tenantId}`,
      sql`SELECT count(*) FROM accounts WHERE tenant_id = ${tenantId}`,
    ]);
    
    return {
      invoices: parseInt(invoices[0].count),
      incomes: parseInt(incomes[0].count),
      expenses: parseInt(expenses[0].count),
      clients: parseInt(clients[0].count),
      accounts: parseInt(accounts[0].count),
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
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
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
    const rows = await sql`SELECT role FROM admin_users WHERE clerk_id = ${userId} LIMIT 1`;
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
    
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
    if (!userRows || userRows.length === 0) return { success: false, members: [] };
    
    const tenantId = userRows[0].tenant_id;
    
    const members = await sql`
      SELECT id, clerk_id, email, full_name, role, created_at
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

    const userRows = await sql`SELECT id, tenant_id, role, email FROM admin_users WHERE clerk_id = ${userId}`;
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

    await sql`UPDATE admin_users SET tenant_id = ${newTenantId}, role = 'owner' WHERE clerk_id = ${userId}`;
    
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

    await sql`UPDATE admin_users SET tenant_id = ${newTenantId}, role = 'owner' WHERE clerk_id = ${userId}`;
    
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

    const userRows = await sql`SELECT id, tenant_id, role, email FROM admin_users WHERE clerk_id = ${userId}`;
    if (userRows.length === 0) return { success: false, error: "Not found" };
    
    if (userRows[0].role === 'owner' || userRows[0].role === 'Super Admin') {
      return { success: false, error: "Workspace owner cannot delete their personal account. Transfer ownership or delete the workspace first." };
    }

    await sql`DELETE FROM admin_users WHERE clerk_id = ${userId}`;

    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);

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

    const userRows = await sql`SELECT role FROM admin_users WHERE clerk_id = ${userId} AND tenant_id = ${tenantId}`;
    if (userRows.length === 0 || (userRows[0].role !== 'owner' && userRows[0].role !== 'Super Admin')) {
      return { success: false, error: "Only the owner can transfer ownership." };
    }

    const targetRows = await sql`SELECT id, email FROM admin_users WHERE id = ${newOwnerId} AND tenant_id = ${tenantId}`;
    if (targetRows.length === 0) {
      return { success: false, error: "Selected user not found in this workspace." };
    }

    // Demote current owner to Admin
    await sql`UPDATE admin_users SET role = 'Admin' WHERE clerk_id = ${userId} AND tenant_id = ${tenantId}`;
    
    // Promote new user to owner
    await sql`UPDATE admin_users SET role = 'owner' WHERE id = ${newOwnerId} AND tenant_id = ${tenantId}`;

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

    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
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
