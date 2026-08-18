import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSalesEnabled } from "@/lib/postgres";
import { markListingSoldInPostgres } from "@/lib/postgres-sales";

export const runtime = "nodejs";

type SoldRequest = {
  listingId?: string;
  bazarItemId?: string;
  soldWithJosealo?: unknown;
  saleSpeedRating?: unknown;
  soldToUserId?: unknown;
  soldToUserName?: unknown;
};

type BazarItemRecord = {
  id?: string;
  status?: "active" | "sold";
  soldAt?: number;
  [key: string]: unknown;
};

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

function cleanSoldFeedback(body: SoldRequest, required: boolean) {
  const hasJosealoValue = typeof body.soldWithJosealo === "boolean";
  const saleSpeedRating = Number(body.saleSpeedRating);
  const hasSaleSpeedValue =
    Number.isInteger(saleSpeedRating) && saleSpeedRating >= 1 && saleSpeedRating <= 5;

  if (required && (!hasJosealoValue || !hasSaleSpeedValue)) {
    throw new Error("listing/invalid-sold-feedback");
  }

  if (!hasJosealoValue && !hasSaleSpeedValue) {
    return null;
  }

  if (!hasJosealoValue || !hasSaleSpeedValue) {
    throw new Error("listing/invalid-sold-feedback");
  }

  return {
    soldWithJosealo: body.soldWithJosealo as boolean,
    saleSpeedRating: saleSpeedRating as 1 | 2 | 3 | 4 | 5,
  };
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as SoldRequest | null;
    const listingId = cleanId(body?.listingId);
    const bazarItemId = cleanId(body?.bazarItemId);
    const feedback = cleanSoldFeedback(body || {}, !bazarItemId);
    const soldToUserId = cleanId(body?.soldToUserId);
    const soldToUserName = typeof body?.soldToUserName === "string" ? body.soldToUserName.trim().slice(0, 120) : "";

    if (!listingId) {
      return NextResponse.json({ error: "listing/missing-id" }, { status: 400 });
    }

    if (isPostgresSalesEnabled()) {
      const result = await markListingSoldInPostgres({
        listingId,
        ...(bazarItemId ? { bazarItemId } : {}),
        ownerId: decoded.uid,
        ...(feedback || {}),
        ...(soldToUserId ? { soldToUserId } : {}),
        ...(soldToUserName ? { soldToUserName } : {}),
      });

      return NextResponse.json({ ok: true, ...result });
    }

    const adminDb = getAdminDb();
    const listingRef = adminDb.collection("listings").doc(listingId);
    const soldEventRef = adminDb.collection("listingSoldEvents").doc();
    const soldAt = Date.now();

    const result = await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(listingRef);
      if (!snapshot.exists) {
        throw new Error("listing/not-found");
      }

      const listing = snapshot.data() || {};
      if (listing.ownerId !== decoded.uid) {
        throw new Error("listing/owner-mismatch");
      }
      let soldToBuyer: { buyerId: string; buyerName: string } | null = null;
      if (soldToUserId) {
        const chatSnap = await adminDb
          .collection("chats")
          .where("listingId", "==", listingId)
          .where("sellerId", "==", decoded.uid)
          .where("buyerId", "==", soldToUserId)
          .limit(1)
          .get();
        if (chatSnap.empty) throw new Error("listing/invalid-sold-buyer");
        const chat = chatSnap.docs[0].data() as { buyerId?: string; buyerName?: string };
        soldToBuyer = {
          buyerId: chat.buyerId || soldToUserId,
          buyerName: chat.buyerName || soldToUserName || "Comprador",
        };
      }

      const baseUpdate = {
        updatedAt: soldAt,
        updatedAtServer: FieldValue.serverTimestamp(),
        lastSoldAt: soldAt,
        lastSoldAtServer: FieldValue.serverTimestamp(),
      };

      if (bazarItemId) {
        if ((listing.type || "article") !== "bazar") {
          throw new Error("listing/not-bazar");
        }

        const items = Array.isArray(listing.bazarItems)
          ? (listing.bazarItems as BazarItemRecord[])
          : [];
        const itemIndex = items.findIndex((item) => item.id === bazarItemId);

        if (itemIndex < 0) {
          throw new Error("listing/bazar-item-not-found");
        }

        const nextItems = items.map((item, index) =>
          index === itemIndex
            ? {
                ...item,
                status: "sold" as const,
                soldAt: Number(item.soldAt) > 0 ? Number(item.soldAt) : soldAt,
                ...(feedback || {}),
                ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
              }
            : item
        );
        const allItemsSold = nextItems.length > 0 && nextItems.every((item) => item.status === "sold");
        const updatePayload = {
          ...baseUpdate,
          bazarItems: nextItems,
          status: allItemsSold ? "sold" : "active",
          soldAt: allItemsSold ? soldAt : null,
          soldAtServer: allItemsSold ? FieldValue.serverTimestamp() : null,
        };

        tx.update(listingRef, updatePayload);
        tx.set(soldEventRef, {
          listingId,
          bazarItemId,
          ownerId: decoded.uid,
          type: "bazarItem",
          saleTitle: items[itemIndex]?.title || listing.title || "Artículo",
          salePrice: Number(items[itemIndex]?.price || 0),
          saleCurrency: items[itemIndex]?.currency || listing.currency || "DOP",
          saleImage: items[itemIndex]?.image || "",
          soldAt,
          soldAtServer: FieldValue.serverTimestamp(),
          allItemsSold,
          ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
          ...(feedback || {}),
        });
        if (soldToBuyer) {
          tx.set(adminDb.collection("purchaseReviewRequests").doc(`${listingId}_${bazarItemId}_${soldToBuyer.buyerId}`), {
            listingId,
            bazarItemId,
            itemTitle: items[itemIndex]?.title || listing.title || "Artículo",
            sellerId: decoded.uid,
            sellerName: listing.ownerName || "Vendedor",
            buyerId: soldToBuyer.buyerId,
            buyerName: soldToBuyer.buyerName,
            status: "pending",
            createdAt: soldAt,
            createdAtServer: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        return {
          status: updatePayload.status,
          soldAt,
          bazarItems: nextItems,
        };
      }

      tx.update(listingRef, {
        ...baseUpdate,
        status: "sold",
        image: "",
        soldAt,
        soldAtServer: FieldValue.serverTimestamp(),
        ...(feedback || {}),
        ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
      });
      tx.set(soldEventRef, {
        listingId,
        ownerId: decoded.uid,
        type: "listing",
        saleTitle: listing.title || "Artículo",
        salePrice: Number(listing.price || 0),
        saleCurrency: listing.currency || "DOP",
        saleImage: listing.image || (Array.isArray(listing.images) ? listing.images[0] : "") || "",
        soldAt,
        soldAtServer: FieldValue.serverTimestamp(),
        ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
        ...(feedback || {}),
      });
      if (soldToBuyer) {
        tx.set(adminDb.collection("purchaseReviewRequests").doc(`${listingId}_${soldToBuyer.buyerId}`), {
          listingId,
          itemTitle: listing.title || "Artículo",
          sellerId: decoded.uid,
          sellerName: listing.ownerName || "Vendedor",
          buyerId: soldToBuyer.buyerId,
          buyerName: soldToBuyer.buyerName,
          status: "pending",
          createdAt: soldAt,
          createdAtServer: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return {
        status: "sold" as const,
        soldAt,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/sold-failed";
    const status =
      message === "listing/not-found"
        ? 404
        : message === "listing/owner-mismatch"
          ? 403
          : message.startsWith("listing/") || message.startsWith("auth/")
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
