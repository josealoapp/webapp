import { NextRequest, NextResponse } from "next/server";
import { createPostgresAuthUser } from "@/lib/postgres-auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    } | null;
    const email = cleanText(body?.email).toLowerCase();
    const password = cleanText(body?.password, 1000);
    const displayName = cleanText(body?.displayName, 120) || email.split("@")[0] || "Usuario";

    if (!isValidEmail(email) || password.length < 8) {
      return NextResponse.json({ error: "auth/invalid-payload" }, { status: 400 });
    }

    const limit = await checkRateLimit(getRateLimitKey(request, "auth-sign-up", email), {
      max: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "auth/too-many-attempts" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const result = await createPostgresAuthUser({ email, password, displayName });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/sign-up-failed";
    const status = message.startsWith("auth/") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
