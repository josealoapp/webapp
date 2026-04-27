import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

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
          listingId?: string;
          bazarItemId?: string;
          sellerId?: string;
          itemTitle?: string;
          reason?: string;
          details?: string;
        }
      | null;

    const listingId = body?.listingId?.trim();
    const bazarItemId = body?.bazarItemId?.trim() || "";
    const sellerId = body?.sellerId?.trim() || "";
    const itemTitle = body?.itemTitle?.trim() || "";
    const reason = body?.reason?.trim();
    const details = body?.details?.trim() || "";

    if (!listingId || !reason) {
      return NextResponse.json({ error: "report/invalid-payload" }, { status: 400 });
    }

    await getAdminDb().collection("reports").add({
      listingId,
      bazarItemId,
      sellerId,
      itemTitle,
      reason,
      details,
      reporterId: decoded.uid,
      reporterName: decoded.name || decoded.email || "Usuario",
      createdAt: Date.now(),
      createdAtServer: FieldValue.serverTimestamp(),
      status: "open",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report/create-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
