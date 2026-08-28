import {  auth, clerkClient  } from '@/lib/auth';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ role: null, isAdmin: false });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const isAdmin = user?.publicMetadata?.role === "admin";

    return NextResponse.json({
      role: user?.publicMetadata?.role,
      isAdmin: isAdmin,
      userId: userId,
      isNewUser: !user?.publicMetadata?.tenant_id,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return NextResponse.json(
      { role: null, isAdmin: false, error: String(error) },
      { status: 500 }
    );
  }
}
