import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresAdminEnabled } from "@/lib/postgres";
import {
  listSupportNotificationsFromPostgres,
  markSupportNotificationReadInPostgres,
} from "@/lib/postgres-admin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const userId = request.nextUrl.searchParams.get("userId")?.trim() || "";
    if (!userId || userId !== decoded.uid) {
      return NextResponse.json({ error: "support-notifications/forbidden" }, { status: 403 });
    }

    if (isPostgresAdminEnabled()) {
      const notifications = await listSupportNotificationsFromPostgres(userId);
      return NextResponse.json({ notifications });
    }

    const snap = await getAdminDb().collection("supportNotifications").where("userId", "==", userId).get();
    const notifications = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as { id: string; createdAt?: number }))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return NextResponse.json({ notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "support-notifications/read-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as { notificationId?: string } | null;
    const notificationId = body?.notificationId?.trim() || "";
    if (!notificationId) {
      return NextResponse.json({ error: "support-notifications/missing-id" }, { status: 400 });
    }

    if (isPostgresAdminEnabled()) {
      await markSupportNotificationReadInPostgres(notificationId);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("supportNotifications").doc(notificationId).update({
      read: true,
      readAt: Date.now(),
      readAtServer: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "support-notifications/update-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
