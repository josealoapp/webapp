import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { deleteListingById, markReportHandled } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { listingId?: string; reason?: string; reportId?: string } | null;
    const listingId = body?.listingId?.trim() || "";
    const reason = body?.reason?.trim() || "";
    const reportId = body?.reportId?.trim() || "";

    if (!listingId || !reason) {
      return NextResponse.json({ error: "admin/listing-id-required" }, { status: 400 });
    }

    await deleteListingById(listingId, reason);
    await markReportHandled(reportId, { action: "delete_item", reason });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/delete-item-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
