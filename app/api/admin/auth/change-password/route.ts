import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest, updateAdminPassword } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = body?.password?.trim() || "";

    if (password.length < 8) {
      return NextResponse.json({ error: "admin/password-too-short" }, { status: 400 });
    }

    await updateAdminPassword(password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/change-password-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
