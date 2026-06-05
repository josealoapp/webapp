import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { getAdminReportDetails, markReportHandled } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const { reportId } = await context.params;
    const details = await getAdminReportDetails(reportId);
    if (!details) {
      return NextResponse.json({ error: "admin/report-not-found" }, { status: 404 });
    }

    return NextResponse.json({ details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/report-details-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const { reportId } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: string; reason?: string } | null;
    if (body?.action !== "omit") {
      return NextResponse.json({ error: "admin/invalid-report-action" }, { status: 400 });
    }

    await markReportHandled(reportId, {
      action: "omit",
      reason: body.reason?.trim() || "Omitido por soporte",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/report-action-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
