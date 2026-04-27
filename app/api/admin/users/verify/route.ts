import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { setUserVerified } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { userId?: string; verified?: boolean } | null;
    const userId = body?.userId?.trim() || "";
    const verified = Boolean(body?.verified);

    if (!userId) {
      return NextResponse.json({ error: "admin/user-id-required" }, { status: 400 });
    }

    await setUserVerified(userId, verified);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/verify-user-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
