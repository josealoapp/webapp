import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresListingsEnabled } from "@/lib/postgres";
import { updateSellerWhatsappForOwnerInPostgres } from "@/lib/postgres-listings";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function updateSellerWhatsappInFirestore(
  ownerId: string,
  input: { sellerWhatsappNumber: string; sellerUsesWhatsapp: boolean }
) {
  const db = getAdminDb();
  const snap = await db.collection("listings").where("ownerId", "==", ownerId).get();

  for (let index = 0; index < snap.docs.length; index += 450) {
    const batch = db.batch();
    snap.docs.slice(index, index + 450).forEach((listingDoc) => {
      batch.set(
        listingDoc.ref,
        {
          sellerWhatsappNumber: input.sellerWhatsappNumber,
          sellerUsesWhatsapp: input.sellerUsesWhatsapp,
          updatedAt: Date.now(),
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as
      | { ownerId?: unknown; sellerWhatsappNumber?: unknown; sellerUsesWhatsapp?: unknown }
      | null;

    const ownerId = cleanText(body?.ownerId, 160);
    const sellerWhatsappNumber = cleanText(body?.sellerWhatsappNumber, 40);
    const normalizedNumber = normalizeWhatsappNumber(sellerWhatsappNumber);
    const sellerUsesWhatsapp = body?.sellerUsesWhatsapp === true && Boolean(normalizedNumber);

    if (!ownerId) {
      return NextResponse.json({ error: "profile/whatsapp-missing-owner" }, { status: 400 });
    }

    if (decoded.uid !== ownerId) {
      return NextResponse.json({ error: "profile/whatsapp-forbidden" }, { status: 403 });
    }

    if (body?.sellerUsesWhatsapp === true && !normalizedNumber) {
      return NextResponse.json({ error: "profile/whatsapp-invalid-number" }, { status: 400 });
    }

    const input = {
      sellerWhatsappNumber: sellerUsesWhatsapp ? normalizedNumber : "",
      sellerUsesWhatsapp,
    };

    if (isPostgresListingsEnabled()) {
      await updateSellerWhatsappForOwnerInPostgres(ownerId, input);
    } else {
      await updateSellerWhatsappInFirestore(ownerId, input);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/whatsapp-sync-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
