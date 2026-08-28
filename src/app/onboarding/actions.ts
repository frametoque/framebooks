"use server";

import sql from "@/lib/db";
import {  auth, clerkClient  } from '@/lib/auth';
import { put } from "@vercel/blob";

export async function completeOnboarding(formData: FormData) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const businessName = formData.get("businessName") as string;
    if (!businessName) {
      return { success: false, error: "Business name is required." };
    }

    let logoUrl = null;
    const logoFile = formData.get("logo") as File;
    if (logoFile && logoFile.size > 0) {
      const filename = `admin/tenants/${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const blob = await put(filename, logoFile, { access: 'public' });
      logoUrl = blob.url;
    }

    const planName = (formData.get("plan") as string) || "Free";

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    // Create a new tenant
    const newTenant = await sql`
      INSERT INTO tenants (name, plan, currency, logo_url) 
      VALUES (${businessName}, ${planName}, 'LKR', ${logoUrl})
      RETURNING id
    `;
    const tenantId = newTenant[0].id;

    // Update clerk user metadata
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        tenant_id: tenantId,
      }
    });

    // Insert user into admin_users table
    const email = user.emailAddresses[0]?.emailAddress || '';
    await sql`
      INSERT INTO admin_users (clerk_id, email, full_name, tenant_id, role)
      VALUES (${userId}, ${email}, ${user.fullName || ''}, ${tenantId}, 'owner')
      ON CONFLICT (clerk_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
    `;

    return { success: true };
  } catch (err) {
    console.error("Onboarding error:", err);
    return { success: false, error: String(err) };
  }
}
