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
    const body = (await request.json().catch(() => null)) as { ownerId?: string; ownerAvatar?: string } | null;
    const ownerId = body?.ownerId?.trim();
    const ownerAvatar = body?.ownerAvatar?.trim();

    if (!ownerId || !ownerAvatar) {
      return NextResponse.json({ error: "profile/avatar-invalid-payload" }, { status: 400 });
    }

    if (decoded.uid !== ownerId) {
      return NextResponse.json({ error: "profile/avatar-forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const snap = await db.collection("listings").where("ownerId", "==", ownerId).get();

    if (!snap.empty) {
      const batch = db.batch();

      snap.docs.forEach((listingDoc) => {
        batch.update(listingDoc.ref, {
          ownerAvatar,
          updatedAt: Date.now(),
          updatedAtServer: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/avatar-sync-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
