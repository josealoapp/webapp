import { NextRequest, NextResponse } from "next/server";
import { buildAdminSessionResponse, verifyAdminCredentials } from "@/lib/admin-session";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
    const username = body?.username?.trim() || "";
    const password = body?.password || "";

    if (!username || !password) {
      return NextResponse.json({ error: "admin/missing-credentials" }, { status: 400 });
    }

    const limit = await checkRateLimit(getRateLimitKey(request, "admin-sign-in", username), {
      max: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "admin/too-many-attempts" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const valid = await verifyAdminCredentials(username, password);
    if (!valid) {
      return NextResponse.json({ error: "admin/invalid-credentials" }, { status: 401 });
    }

    return buildAdminSessionResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/sign-in-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
