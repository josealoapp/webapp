import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { listAdminReports } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const reports = await listAdminReports();
    return NextResponse.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/reports-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
