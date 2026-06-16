import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresAdminEnabled } from "@/lib/postgres";
import { createReportInPostgres } from "@/lib/postgres-admin";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as
      | {
          reportType?: string;
          listingId?: string;
          bazarItemId?: string;
          sellerId?: string;
          itemTitle?: string;
          targetUserId?: string;
          targetUserName?: string;
          reason?: string;
          details?: string;
        }
      | null;

    const reportType = body?.reportType === "user" ? "user" : "item";
    const listingId = body?.listingId?.trim() || "";
    const bazarItemId = body?.bazarItemId?.trim() || "";
    const targetUserId = body?.targetUserId?.trim() || "";
    const targetUserName = body?.targetUserName?.trim() || "";
    const sellerId = reportType === "user" ? targetUserId : body?.sellerId?.trim() || "";
    const itemTitle = reportType === "user" ? targetUserName || "Usuario reportado" : body?.itemTitle?.trim() || "";
    const reason = body?.reason?.trim();
    const details = body?.details?.trim() || "";

    if (reportType === "item" && (!listingId || !reason)) {
      return NextResponse.json({ error: "report/invalid-payload" }, { status: 400 });
    }

    if (reportType === "user" && (!targetUserId || !reason)) {
      return NextResponse.json({ error: "report/invalid-payload" }, { status: 400 });
    }

    if (targetUserId && targetUserId === decoded.uid) {
      return NextResponse.json({ error: "report/self-report" }, { status: 400 });
    }

    const payload = {
      reportType,
      listingId,
      bazarItemId,
      sellerId,
      itemTitle,
      targetUserId,
      targetUserName,
      reason,
      details,
      reporterId: decoded.uid,
      reporterName: decoded.name || decoded.email || "Usuario",
      createdAt: Date.now(),
      status: "open",
    };

    if (isPostgresAdminEnabled()) {
      await createReportInPostgres(payload);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("reports").add({
      ...payload,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report/create-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
