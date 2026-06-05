import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

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

    const user = await getAdminAuth().getUser(userId);
    const createdAt = user.metadata.creationTime
      ? new Date(user.metadata.creationTime).getTime()
      : 0;

    return NextResponse.json({ createdAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/account-load-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
