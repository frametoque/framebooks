"use server";

import sql from "@/lib/db";
import { getTenantId } from "@/app/(dashboard)/user/actions/actions";
import { PlanType } from "@/lib/plans";

export async function getTenantPlan(): Promise<PlanType> {
  const tenantId = await getTenantId();
  if (!tenantId) return 'Free';
  
  const result = await sql`SELECT plan FROM tenants WHERE id = ${tenantId}`;
  if (result.length === 0) return 'Free';
  
  const plan = result[0].plan;
  return (plan === 'Pro Plus' || plan === 'Pro') ? plan as PlanType : 'Free';
}
