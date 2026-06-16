import { NextRequest, NextResponse } from "next/server";
import { createAuthActionToken, verifyPostgresAuthToken } from "@/lib/postgres-auth";

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
    console.info(`Email verification link for ${user.email || user.uid}: /verify-email?token=${actionToken}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/email-verification-failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
