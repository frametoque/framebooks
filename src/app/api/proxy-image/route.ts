import { NextRequest, NextResponse } from "next/server";
import { validateSafeUrl } from "@/lib/security/ssrf";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rateCheck = checkRateLimit(req, { prefix: "image-proxy", limit: 30, windowMs: 60 * 1000 });
  if (!rateCheck.allowed) {
    return new NextResponse("Rate limit exceeded for image proxy", {
      status: 429,
      headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
    });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url query parameter", { status: 400 });
  }

  const ssrfCheck = await validateSafeUrl(url);
  if (!ssrfCheck.safe) {
    return new NextResponse(ssrfCheck.error || "Prohibited destination URL", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Framebooks-ImageProxy/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return new NextResponse(`Upstream failed with status ${res.status}`, {
        status: res.status,
      });
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    // Strictly allow only safe raster image formats (SVG disallowed to prevent XSS)
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(contentType)) {
      return new NextResponse("Only standard raster images (PNG, JPEG, WebP, GIF) are allowed", { status: 400 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 10 * 1024 * 1024) {
      return new NextResponse("Image exceeds maximum size", { status: 400 });
    }

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    console.error("Image proxy error:", err);
    return new NextResponse("Failed to proxy image", {
      status: 500,
    });
  }
}
