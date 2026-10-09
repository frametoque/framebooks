// src/lib/admin/permissions.ts

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'user';

export type AdminPermission =
  | 'view_overview'
  | 'view_users'
  | 'edit_users'
  | 'ban_users'
  | 'delete_users'
  | 'view_subscriptions'
  | 'manage_subscriptions'
  | 'view_payments'
  | 'manage_payments'
  | 'refund_payments'
  | 'view_plans'
  | 'edit_plans'
  | 'view_coupons'
  | 'manage_coupons'
  | 'view_analytics'
  | 'manage_announcements'
  | 'view_audit_logs'
  | 'manage_admins'
  | 'manage_settings';

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'view_overview',
    'view_users',
    'edit_users',
    'ban_users',
    'delete_users',
    'view_subscriptions',
    'manage_subscriptions',
    'view_payments',
    'manage_payments',
    'refund_payments',
    'view_plans',
    'edit_plans',
    'view_coupons',
    'manage_coupons',
    'view_analytics',
    'manage_announcements',
    'view_audit_logs',
    'manage_admins',
    'manage_settings',
  ],
  admin: [
    'view_overview',
    'view_users',
    'edit_users',
    'ban_users',
    'view_subscriptions',
    'manage_subscriptions',
    'view_payments',
    'manage_payments',
    'refund_payments',
    'view_plans',
    'edit_plans',
    'view_coupons',
    'manage_coupons',
    'view_analytics',
    'manage_announcements',
    'view_audit_logs',
  ],
  support: [
    'view_overview',
    'view_users',
    'ban_users',
    'view_subscriptions',
    'view_payments',
    'view_plans',
    'view_coupons',
    'view_analytics',
    'view_audit_logs',
  ],
  user: [],
};

export function hasPermission(role: string | null | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  const adminRole = role as AdminRole;
  const permissions = ROLE_PERMISSIONS[adminRole] || [];
  return permissions.includes(permission);
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'support';
}

export function canManageAdmins(role: string | null | undefined): boolean {
  return role === 'super_admin';
}

export function canDeleteData(role: string | null | undefined): boolean {
  return role === 'super_admin';
}
