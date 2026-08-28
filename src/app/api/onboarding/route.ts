import { NextResponse } from "next/server";
import {  auth, currentUser  } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || "";

    const { businessName, address, plan, accountName, initialBalance } = await req.json();

    const sql = neon(process.env.DATABASE_URL!);

    // Check if user already exists
    const existingUser = await sql`SELECT id, tenant_id FROM admin_users WHERE clerk_id = ${userId}`;

    if (existingUser.length > 0 && existingUser[0].tenant_id) {
      return NextResponse.json({ message: "User already has a business profile" }, { status: 400 });
    }

    // Insert new tenant
    const newTenant = await sql`
      INSERT INTO tenants (name, plan, currency, address, created_at)
      VALUES (${businessName}, ${plan}, 'LKR', ${address}, NOW())
      RETURNING id
    `;
    const tenantId = newTenant[0].id;

    // Create user mapping
    if (existingUser.length === 0) {
      await sql`
        INSERT INTO admin_users (email, full_name, role, clerk_id, tenant_id, created_at)
        VALUES (${email}, ${user?.fullName || ""}, 'owner', ${userId}, ${tenantId}, NOW())
      `;
    } else {
      await sql`UPDATE admin_users SET tenant_id = ${tenantId} WHERE clerk_id = ${userId}`;
    }

    // Create initial account
    if (accountName) {
      const balance = initialBalance || 0;
      await sql`
        INSERT INTO accounts (name, type, initial_balance, current_balance, tenant_id, created_at)
        VALUES (${accountName}, 'Cash', ${balance}, ${balance}, ${tenantId}, NOW())
      `;
    }

    return NextResponse.json({ success: true, tenantId });
  } catch (error) {
    console.error("[ONBOARDING_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
