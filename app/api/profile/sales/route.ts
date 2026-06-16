import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSalesEnabled } from "@/lib/postgres";
import { getSalesCountFromPostgres } from "@/lib/postgres-sales";

export const runtime = "nodejs";

function cleanUserId(value: string | null) {
  return (value || "").trim().slice(0, 128);
}

export async function GET(request: NextRequest) {
  try {
    const userId = cleanUserId(request.nextUrl.searchParams.get("userId"));
    if (!userId) {
      return NextResponse.json({ error: "profile/missing-user-id" }, { status: 400 });
    }

    if (isPostgresSalesEnabled()) {
      const salesCount = await getSalesCountFromPostgres(userId);
      return NextResponse.json({ salesCount });
    }

    const snapshot = await getAdminDb()
      .collection("listingSoldEvents")
      .where("ownerId", "==", userId)
      .get();

    return NextResponse.json({ salesCount: snapshot.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/sales-count-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
