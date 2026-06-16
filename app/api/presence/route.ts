import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresAnalyticsEnabled } from "@/lib/postgres";
import { getUserPresenceFromPostgres, updateUserPresenceInPostgres } from "@/lib/postgres-analytics";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim() || "";
    if (!userId) {
      return NextResponse.json({ error: "presence/user-required" }, { status: 400 });
    }

    if (isPostgresAnalyticsEnabled()) {
      return NextResponse.json({
        userId,
        lastActiveAt: await getUserPresenceFromPostgres(userId),
      });
    }

    const snapshot = await getAdminDb().collection("userPresence").doc(userId).get();
    const data = snapshot.data() as { lastActiveAt?: number } | undefined;

    return NextResponse.json({
      userId,
      lastActiveAt: Number(data?.lastActiveAt || 0),
    });
  } catch {
    return NextResponse.json({ error: "presence/load-failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as { userId?: string } | null;
    const userId = body?.userId?.trim() || decoded.uid;

    if (userId !== decoded.uid) {
      return NextResponse.json({ error: "presence/user-mismatch" }, { status: 403 });
    }

    if (isPostgresAnalyticsEnabled()) {
      await updateUserPresenceInPostgres(decoded.uid);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("userPresence").doc(decoded.uid).set(
      {
        userId: decoded.uid,
        lastActiveAt: Date.now(),
        lastActiveAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "presence/update-failed" }, { status: 500 });
  }
}
