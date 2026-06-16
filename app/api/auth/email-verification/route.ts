import { NextRequest, NextResponse } from "next/server";
import {
  createAuthActionToken,
  verifyEmailWithPostgresToken,
  verifyPostgresAuthToken,
} from "@/lib/postgres-auth";
import { sendEmail, verificationEmailTemplate } from "@/lib/email";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const user = await verifyPostgresAuthToken(token);
    const actionToken = await createAuthActionToken(user.uid, "email_verification");
    const verificationUrl = new URL(`/verify-email?token=${encodeURIComponent(actionToken)}`, request.nextUrl.origin);
    if (user.email) {
      const email = verificationEmailTemplate({
        name: user.displayName,
        url: verificationUrl.toString(),
      });
      await sendEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } else {
      console.info(`Email verification link for ${user.uid}: ${verificationUrl.toString()}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/email-verification-failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() || "";
    if (!token) return NextResponse.json({ error: "auth/invalid-action-code" }, { status: 400 });
    await verifyEmailWithPostgresToken(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/email-verification-failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
