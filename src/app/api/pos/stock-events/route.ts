import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { subscribeTenantStockEvents } from "@/lib/pos/server-events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Resolve active tenant_id for the current user
  let tenantId: number | null = null;
  try {
    const userRows = await sql`
      SELECT u.tenant_id FROM admin_users u WHERE LOWER(u.email) = ${session.user.email.toLowerCase()} LIMIT 1
    `;
    tenantId = userRows[0]?.tenant_id ? Number(userRows[0].tenant_id) : null;
  } catch (err) {
    console.error("[SSE Stock Stream Tenant Lookup Error]", err);
  }

  if (!tenantId) {
    return new Response("No tenant associated", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", tenantId, timestamp: Date.now() })}\n\n`)
      );

      // Subscribe to instant stock events for this business
      cleanupSubscription = subscribeTenantStockEvents(tenantId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch (e) {
          console.error("[SSE Stock Stream Enqueue Error]", e);
        }
      });

      // Keep connection alive with lightweight heartbeat ping every 15s
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (cleanupSubscription) {
        cleanupSubscription();
        cleanupSubscription = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
