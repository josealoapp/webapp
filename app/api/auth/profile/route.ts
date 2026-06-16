import { NextRequest, NextResponse } from "next/server";
import { updatePostgresAuthUserProfile, verifyPostgresAuthToken } from "@/lib/postgres-auth";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const user = await verifyPostgresAuthToken(token);
    const body = (await request.json().catch(() => null)) as { displayName?: unknown; photoURL?: unknown } | null;
    const updated = await updatePostgresAuthUserProfile(user.uid, {
      displayName: cleanText(body?.displayName) || undefined,
      photoURL: cleanText(body?.photoURL, 1000) || undefined,
    });
    return NextResponse.json({ token, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/update-profile-failed";
    const status = message.startsWith("auth/") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
