import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type ChatListingActionRequest = {
  listingId?: unknown;
  chatId?: unknown;
  action?: unknown;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function notificationMessage(action: "reserve" | "sell", title: string) {
  if (action === "sell") {
    return `El artículo "${title}" que estabas viendo fue marcado como vendido. Gracias por tu interés; puedes seguir explorando opciones similares en Josealo.`;
  }

  return `El artículo "${title}" que estabas viendo ha sido apartado por otro usuario. Esto no quiere decir que está vendido; te informamos para que conozcas el proceso.`;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as ChatListingActionRequest | null;
    const listingId = cleanText(body?.listingId);
    const chatId = cleanText(body?.chatId);
    const action = body?.action === "reserve" || body?.action === "sell" ? body.action : "";

    if (!listingId || !chatId || !action) {
      return NextResponse.json({ error: "listing/invalid-chat-action" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const listingRef = adminDb.collection("listings").doc(listingId);
    const chatRef = adminDb.collection("chats").doc(chatId);
    const now = Date.now();

    const result = await adminDb.runTransaction(async (tx) => {
      const [listingSnap, chatSnap] = await Promise.all([tx.get(listingRef), tx.get(chatRef)]);

      if (!listingSnap.exists) throw new Error("listing/not-found");
      if (!chatSnap.exists) throw new Error("chat/not-found");

      const listing = listingSnap.data() || {};
      const chat = chatSnap.data() || {};

      if (listing.ownerId !== decoded.uid || chat.sellerId !== decoded.uid) {
        throw new Error("listing/owner-mismatch");
      }
      if (chat.listingId !== listingId) {
        throw new Error("listing/chat-mismatch");
      }
      if ((listing.status || "active") === "sold") {
        throw new Error("listing/already-sold");
      }

      const buyerId = cleanText(chat.buyerId);
      const buyerName = cleanText(chat.buyerName, 120) || "Comprador";
      const title = cleanText(listing.title, 180) || cleanText(chat.listingTitle, 180) || "Artículo";

      if (!buyerId) throw new Error("listing/missing-buyer");

      const updatePayload =
        action === "sell"
          ? {
              status: "sold",
              image: "",
              soldAt: now,
              soldAtServer: FieldValue.serverTimestamp(),
              soldWithJosealo: true,
              saleSpeedRating: 5,
              soldToUserId: buyerId,
              soldToUserName: buyerName,
              updatedAt: now,
              updatedAtServer: FieldValue.serverTimestamp(),
            }
          : {
              reservedForUserId: buyerId,
              reservedForUserName: buyerName,
              reservedAt: now,
              reservedAtServer: FieldValue.serverTimestamp(),
              updatedAt: now,
              updatedAtServer: FieldValue.serverTimestamp(),
            };

      tx.update(listingRef, updatePayload);

      if (action === "sell") {
        const soldEventRef = adminDb.collection("listingSoldEvents").doc();
        tx.set(soldEventRef, {
          listingId,
          ownerId: decoded.uid,
          type: "listing",
          soldAt: now,
          soldAtServer: FieldValue.serverTimestamp(),
          soldWithJosealo: true,
          saleSpeedRating: 5,
          soldToUserId: buyerId,
          soldToUserName: buyerName,
        });

        tx.set(
          adminDb.collection("purchaseReviewRequests").doc(`${listingId}_${buyerId}`),
          {
            listingId,
            itemTitle: title,
            sellerId: decoded.uid,
            sellerName: cleanText(listing.ownerName, 120) || "Vendedor",
            buyerId,
            buyerName,
            status: "pending",
            createdAt: now,
            createdAtServer: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return {
        buyerId,
        buyerName,
        title,
        status: action === "sell" ? "sold" : listing.status || "active",
        reservedAt: action === "reserve" ? now : undefined,
        soldAt: action === "sell" ? now : undefined,
      };
    });

    const chatSnap = await adminDb.collection("chats").where("listingId", "==", listingId).get();
    const userIds = new Set<string>();
    chatSnap.docs.forEach((docSnap) => {
      const row = docSnap.data() as { buyerId?: string };
      if (row.buyerId) userIds.add(row.buyerId);
    });

    await Promise.all(
      Array.from(userIds).map((userId) =>
        adminDb.collection("supportNotifications").add({
          userId,
          type: action === "sell" ? "listing_sold" : "listing_reserved",
          title: action === "sell" ? "Artículo vendido" : "Artículo apartado",
          message: notificationMessage(action, result.title),
          reason: action === "sell" ? "Vendido por el vendedor" : "Apartado por el vendedor",
          listingId,
          read: false,
          createdAt: now,
          createdAtServer: FieldValue.serverTimestamp(),
        })
      )
    );

    return NextResponse.json({
      ok: true,
      status: result.status,
      reservedForUserId: action === "reserve" ? result.buyerId : undefined,
      reservedForUserName: action === "reserve" ? result.buyerName : undefined,
      reservedAt: result.reservedAt,
      soldAt: result.soldAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/chat-action-failed";
    const status =
      message === "listing/not-found" || message === "chat/not-found"
        ? 404
        : message === "listing/owner-mismatch" || message === "listing/chat-mismatch"
          ? 403
          : message.startsWith("listing/") || message.startsWith("auth/")
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
