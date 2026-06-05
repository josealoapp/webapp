import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/admin-session";
import {
  getAdminAppSalesSummary,
  getAdminSoldSourceStats,
  getAdminUserCountsByDay,
  getAdminUserCountsForTimeframe,
  listAdminReports,
  listAdminUsers,
} from "@/lib/admin-data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const userRange = request.nextUrl.searchParams.get("userRange")?.trim() || "last_week";
    const salesRange = request.nextUrl.searchParams.get("salesRange")?.trim() || "all_time";
    const [userCounts, weeklyUserCounts, soldSourceStats, appSalesSummary, users, reports] = await Promise.all([
      getAdminUserCountsByDay(),
      getAdminUserCountsForTimeframe(userRange),
      getAdminSoldSourceStats(),
      getAdminAppSalesSummary(salesRange),
      listAdminUsers(""),
      listAdminReports(),
    ]);

    return NextResponse.json({
      userCounts,
      weeklyUserCounts,
      selectedDate: "",
      selectedDateCount: null,
      userRange,
      soldSourceStats,
      appSalesSummary,
      users: users.slice(0, 100),
      reports,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/dashboard-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
