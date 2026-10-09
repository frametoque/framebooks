import { NextResponse } from "next/server";
import { auth, currentUser } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function POST(req: Request) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const fullName = session?.user?.name || "";

    const { businessName, address, plan, accountName, initialBalance, couponCode } = await req.json();

    const sql = neon(process.env.DATABASE_URL!);

    // Check if user already exists
    const existingUser = await sql`
      SELECT id, tenant_id FROM admin_users 
      WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    if (existingUser.length > 0 && existingUser[0].tenant_id) {
      return NextResponse.json({ message: "User already has a business profile" }, { status: 400 });
    }

    // Insert new tenant
    const newTenant = await sql`
      INSERT INTO tenants (name, plan, currency, address, created_at)
      VALUES (${businessName}, ${plan || 'Free'}, 'LKR', ${address}, NOW())
      RETURNING id
    `;
    const tenantId = newTenant[0].id;

    // Create user mapping
    let dbUserId: number | null = null;
    if (existingUser.length === 0) {
      const inserted = await sql`
        INSERT INTO admin_users (email, full_name, role, tenant_id, created_at)
        VALUES (${email}, ${fullName}, 'owner', ${tenantId}, NOW())
        ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = 'owner'
        RETURNING id
      `;
      dbUserId = inserted[0]?.id;
    } else {
      await sql`UPDATE admin_users SET tenant_id = ${tenantId}, role = 'owner' WHERE id = ${existingUser[0].id}`;
      dbUserId = existingUser[0].id;
    }

    // Create initial account
    if (accountName) {
      const balance = initialBalance || 0;
      await sql`
        INSERT INTO accounts (name, type, initial_balance, current_balance, tenant_id, created_at)
        VALUES (${accountName}, 'Cash', ${balance}, ${balance}, ${tenantId}, NOW())
      `;
      await sql`
        UPDATE tenants SET lifetime_accounts = COALESCE(lifetime_accounts, 0) + 1 WHERE id = ${tenantId}
      `;
    }

    // Process coupon code if provided
    let isComplimentary = false;
    if (couponCode && typeof couponCode === 'string') {
      const cleanCode = couponCode.trim().toUpperCase();
      const couponRows = await sql`
        SELECT * FROM coupons 
        WHERE UPPER(code) = ${cleanCode} AND is_active = true
        LIMIT 1
      `;
      if (couponRows.length > 0) {
        const coupon = couponRows[0];
        await sql`
          INSERT INTO coupon_redemptions (coupon_id, tenant_id, user_id, redeemed_at)
          VALUES (${coupon.id}, ${tenantId}, ${dbUserId}, NOW())
        `;
        await sql`
          UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${coupon.id}
        `;

        if (coupon.type === 'percent' && Number(coupon.value) >= 100) {
          isComplimentary = true;
          const planRows = await sql`
            SELECT id FROM plans 
            WHERE LOWER(name) = LOWER(${plan || 'Free'}) OR LOWER(key) = LOWER(${plan || 'Free'})
            LIMIT 1
          `;
          const planId = planRows[0]?.id || 1;

          await sql`
            INSERT INTO subscriptions (
              tenant_id, user_id, plan_id, status, billing_interval,
              current_period_start, current_period_end, source, created_at, updated_at
            ) VALUES (
              ${tenantId}, ${dbUserId}, ${planId}, 'active', 'monthly',
              NOW(), NOW() + interval '100 years', 'admin_comp', NOW(), NOW()
            )
          `;
        }
      }
    }

    return NextResponse.json({ success: true, tenantId, isComplimentary });
  } catch (error) {
    console.error("[ONBOARDING_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
