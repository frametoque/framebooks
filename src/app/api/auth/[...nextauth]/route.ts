import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

async function authHandler(req: NextRequest, context: any) {
  try {
    return await handler(req, context);
  } catch (err: any) {
    console.error("[NextAuth Route Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Authentication error" },
      { status: 500 }
    );
  }
}

export { authHandler as GET, authHandler as POST };

