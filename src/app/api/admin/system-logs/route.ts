import { NextResponse } from "next/server";
import { getAdminUser } from "@/app/(dashboard)/admin/_lib/auth";
import { hasPermission } from "@/app/(dashboard)/admin/_lib/permissions";
import { getSystemLogs, logSystemAction } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin || !hasPermission(admin.systemRole, "view_audit_logs")) {
      return NextResponse.json({ error: "Forbidden. Administrative access required." }, { status: 403 });
    }

    const logs = await getSystemLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Error fetching system logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden. Administrative access required." }, { status: 403 });
    }

    const { task } = await request.json();
    if (!task || typeof task !== "string") {
      return NextResponse.json({ error: "Task description is required" }, { status: 400 });
    }

    await logSystemAction(`[Admin ${admin.email}] ${task.slice(0, 500)}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging system action via API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log action" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  // System audit logs are append-only and tamper-resistant; programmatic deletion is prohibited
  return NextResponse.json(
    { error: "Audit logs are append-only and cannot be deleted." },
    { status: 405 }
  );
}

