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

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    const body = (await request.json().catch(() => null)) as { listingId?: unknown; bazarItemId?: unknown } | null;
    const listingId = cleanId(body?.listingId);
    const bazarItemId = cleanId(body?.bazarItemId);

    if (!listingId) {
      return NextResponse.json({ error: "listing/missing-id" }, { status: 400 });
    }

    let viewerId = "";
    if (token) {
      const decoded = await getAdminAuth().verifyIdToken(token);
      viewerId = decoded.uid;
    }

    const adminDb = getAdminDb();
    const listingRef = adminDb.collection("listings").doc(listingId);
    const eventRef = adminDb.collection("listingViewEvents").doc();
    const viewedAt = Date.now();

    const result = await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(listingRef);
      if (!snapshot.exists) {
        throw new Error("listing/not-found");
      }

      const listing = snapshot.data() || {};
      const ownerId = typeof listing.ownerId === "string" ? listing.ownerId : "";
      const isOwnerView = Boolean(viewerId && ownerId === viewerId);

      tx.set(eventRef, {
        listingId,
        bazarItemId,
        ownerId,
        viewerId,
        isOwnerView,
        viewedAt,
        viewedAtServer: FieldValue.serverTimestamp(),
      });

      if (!isOwnerView) {
        tx.update(listingRef, {
          views: FieldValue.increment(1),
          viewCount: FieldValue.increment(1),
          lastViewedAt: viewedAt,
          lastViewedAtServer: FieldValue.serverTimestamp(),
        });
      }

      return { counted: !isOwnerView };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/view-failed";
    const status = message === "listing/not-found" ? 404 : message.startsWith("listing/") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
