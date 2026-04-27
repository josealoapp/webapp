import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import { getAdminUserCountsByDay, listAdminReports, listAdminUsers } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const selectedDate = request.nextUrl.searchParams.get("date")?.trim() || "";
    const [userCounts, users, reports] = await Promise.all([
      getAdminUserCountsByDay(),
      listAdminUsers(""),
      listAdminReports(),
    ]);

    const selectedDateCount = selectedDate
      ? userCounts.find((entry) => entry.date === selectedDate)?.count || 0
      : null;

    return NextResponse.json({
      userCounts,
      selectedDate,
      selectedDateCount,
      users: users.slice(0, 100),
      reports,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/dashboard-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
