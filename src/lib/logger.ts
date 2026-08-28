import sql from "@/lib/db";
import { headers } from "next/headers";
import {  auth, clerkClient  } from '@/lib/auth';

let isTableEnsured = false;

export async function ensureSystemLogsTable() {
  if (isTableEnsured) return;
  isTableEnsured = true;
}

export async function logSystemAction(task: string) {
  try {
    // Ensure table exists (cached)
    await ensureSystemLogsTable();

    // Get headers info
    const headersList = await headers();
    const ua = headersList.get("user-agent") || "";
    const ip = headersList.get("x-forwarded-for")?.split(",")[0].trim() || 
               headersList.get("x-real-ip") || 
               "127.0.0.1";

    let os = "Unknown OS";
    let device = "Desktop";
    let type = "Web Browser";

    if (ua) {
      // OS Detection
      if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
      else if (ua.includes("iPhone")) { os = "iOS"; device = "Mobile"; }
      else if (ua.includes("iPad")) { os = "iOS (iPad)"; device = "Tablet"; }
      else if (ua.includes("Android")) { os = "Android"; device = "Mobile"; }
      else if (ua.includes("Linux")) os = "Linux";

      // Device Type Detection
      if (ua.includes("Mobi") || ua.includes("Phone")) {
        device = "Mobile";
      } else if (ua.includes("Tablet") || ua.includes("iPad")) {
        device = "Tablet";
      }

      // Browser/Client Type Detection
      if (ua.includes("Firefox")) type = "Firefox";
      else if (ua.includes("Chrome") && !ua.includes("Chromium")) type = "Chrome";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) type = "Safari";
      else if (ua.includes("Edge")) type = "Edge";
      else if (ua.includes("Postman")) type = "Postman";
      else if (ua.includes("curl")) type = "Curl";
    }

    let userEmail = "System / Anonymous";
    let tenantId = null;
    try {
      const { userId, session } = await auth() as any;
      if (userId && session?.user) {
        tenantId = session.user.tenantId || null;
        userEmail = session.user.email || userEmail;
      }
    } catch (e) {
      console.warn("Could not retrieve user details for logger:", e);
    }

    await sql`
      INSERT INTO admin_system_logs (task, device_ip, device_os, device_type, user_email, tenant_id)
      VALUES (${task}, ${ip}, ${os}, ${device === "Desktop" ? type : `${device} (${type})`}, ${userEmail}, ${tenantId})
    `;
  } catch (error) {
    console.error("Failed to log system action:", error);
  }
}

export async function getSystemLogs() {
  await ensureSystemLogsTable();
  try {
    // Auto-delete logs older than 3 months
    await sql`
      DELETE FROM admin_system_logs 
      WHERE timestamp < NOW() - INTERVAL '3 months'
    `;
  } catch (err) {
    console.error("Auto-delete old logs failed:", err);
  }

  try {
    const { userId, session } = await auth() as any;
    if (!userId) return [];
    
    const tenantId = session?.user?.tenantId || null;
    if (!tenantId) return [];

    const logs = await sql`
      SELECT id, task, timestamp, device_ip, device_os, device_type, user_email
      FROM admin_system_logs
      WHERE tenant_id = ${tenantId}
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    return logs;
  } catch (error) {
    console.error("Failed to fetch system logs:", error);
    return [];
  }
}

export async function clearSystemLogs() {
  await ensureSystemLogsTable();
  try {
    const { userId, session } = await auth() as any;
    if (!userId) return false;
    
    const tenantId = session?.user?.tenantId || null;
    if (!tenantId) return false;

    await sql`DELETE FROM admin_system_logs WHERE tenant_id = ${tenantId}`;
    await logSystemAction("Cleared all system logs");
    return true;
  } catch (error) {
    console.error("Failed to clear system logs:", error);
    return false;
  }
}
