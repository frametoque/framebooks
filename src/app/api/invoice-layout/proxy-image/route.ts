import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url query parameter", { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Framebooks-Proxy/1.0",
      },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream failed with status ${res.status}`, {
        status: res.status,
      });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  } catch (err: any) {
    console.error("Image proxy error:", err);
    return new NextResponse(err.message || "Failed to proxy image", {
      status: 500,
    });
  }
}
