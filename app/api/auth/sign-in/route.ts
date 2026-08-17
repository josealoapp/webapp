import { NextRequest, NextResponse } from "next/server";
import { signInWithPostgresPassword } from "@/lib/postgres-auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
    const email = cleanText(body?.email).toLowerCase();
    const password = cleanText(body?.password, 1000);
    if (!email || !password) {
      return NextResponse.json({ error: "auth/missing-credentials" }, { status: 400 });
    }

    const limit = await checkRateLimit(getRateLimitKey(request, "auth-sign-in", email), {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "auth/too-many-attempts" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const result = await signInWithPostgresPassword(email, password);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/sign-in-failed";
    const status = message.startsWith("auth/") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
