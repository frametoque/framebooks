import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      error:
        "Local Puppeteer and Chromium browser automation is not supported in Cloudflare Workers V8 isolate runtime. Use an external screenshot API service or Cloudflare Browser Rendering (@cloudflare/puppeteer).",
    },
    { status: 501 }
  );
}

