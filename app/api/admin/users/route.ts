import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { deleteUserAccount, listAdminUsers } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() || "";
    const users = await listAdminUsers(query);
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/users-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { userId?: string } | null;
    const userId = body?.userId?.trim() || "";

    if (!userId) {
      return NextResponse.json({ error: "admin/user-id-required" }, { status: 400 });
    }

    await deleteUserAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/delete-user-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
