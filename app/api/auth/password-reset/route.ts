import { NextRequest, NextResponse } from "next/server";
import {
  createAuthActionToken,
  getAuthActionToken,
  getAuthUserByEmail,
  resetPasswordWithPostgresToken,
} from "@/lib/postgres-auth";
import { passwordResetEmailTemplate, sendEmail } from "@/lib/email";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength = 320) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() || "";
    const row = token ? await getAuthActionToken(token, "password_reset") : null;
    if (!row?.email) return NextResponse.json({ error: "auth/invalid-action-code" }, { status: 400 });
    return NextResponse.json({ email: row.email });
  } catch {
    return NextResponse.json({ error: "auth/invalid-action-code" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = cleanText(body?.email).toLowerCase();
  const limit = await checkRateLimit(getRateLimitKey(request, "auth-password-reset", email), {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "auth/too-many-attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const user = email ? await getAuthUserByEmail(email) : null;
  let devResetUrl = "";
  if (user) {
    const token = await createAuthActionToken(user.id, "password_reset");
    const resetUrl = new URL(
      `/forgot-password?mode=resetPassword&oobCode=${encodeURIComponent(token)}`,
      request.nextUrl.origin
    );
    const emailTemplate = passwordResetEmailTemplate({ url: resetUrl.toString() });
    const result = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
    if (result.skipped && process.env.NODE_ENV !== "production") {
      devResetUrl = resetUrl.toString();
      console.info(`Password reset email skipped. Local reset URL: ${devResetUrl}`);
    }
  }
  return NextResponse.json({
    ok: true,
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
    const token = cleanText(body?.token, 1000);
    const password = cleanText(body?.password, 1000);
    if (!token || password.length < 8) {
      return NextResponse.json({ error: "auth/invalid-payload" }, { status: 400 });
    }
    const limit = await checkRateLimit(getRateLimitKey(request, "auth-password-reset-confirm", token.slice(0, 16)), {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "auth/too-many-attempts" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    await resetPasswordWithPostgresToken(token, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/reset-failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
