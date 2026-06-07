import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

type OfferRequest = {
  listingId?: string;
  listingTitle?: string;
  listingPrice?: number;
  tradeListingId?: string;
  tradeListingTitle?: string;
  tradeListingPrice?: number;
  tradeListingImage?: string;
  tradeListingCurrency?: string;
  sellerId?: string;
  sellerName?: string;
  message?: string;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function chatIdFor(listingId: string, buyerId: string) {
  return `chat_${listingId}_${buyerId}`;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as OfferRequest;

    const listingId = body.listingId?.trim();
    const listingTitle = body.listingTitle?.trim();
    const listingPrice = Number(body.listingPrice);
    const tradeListingId = body.tradeListingId?.trim();
    const tradeListingTitle = body.tradeListingTitle?.trim();
    const tradeListingPrice = Number(body.tradeListingPrice);
    const tradeListingImage = body.tradeListingImage?.trim();
    const tradeListingCurrency = body.tradeListingCurrency === "USD" ? "USD" : body.tradeListingCurrency === "DOP" ? "DOP" : "";
    const sellerId = body.sellerId?.trim();
    const sellerName = body.sellerName?.trim();
    const message = body.message?.trim();

    if (!listingId || !listingTitle || !sellerId || !sellerName || !message) {
      return NextResponse.json({ error: "offer/invalid-payload" }, { status: 400 });
    }

    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      return NextResponse.json({ error: "offer/invalid-price" }, { status: 400 });
    }

    if (sellerId === decoded.uid) {
      return NextResponse.json({ error: "offer/self-offer" }, { status: 400 });
    }

    const buyerName = decoded.name || decoded.email || "Comprador";
    const now = Date.now();
    const chatId = chatIdFor(listingId, decoded.uid);
    const adminDb = getAdminDb();
    const chatRef = adminDb.collection("chats").doc(chatId);
    const messageRef = adminDb.collection("messages").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(
        chatRef,
        {
          listingId,
          listingTitle,
          listingPrice,
          ...(tradeListingId && tradeListingTitle && Number.isFinite(tradeListingPrice) && tradeListingPrice > 0
            ? {
                tradeListingId,
                tradeListingTitle,
                tradeListingPrice,
                tradeListingImage: tradeListingImage || "",
                tradeListingCurrency: tradeListingCurrency || "DOP",
              }
            : {}),
          sellerId,
          sellerName,
          buyerId: decoded.uid,
          buyerName,
          createdAt: now,
          updatedAt: now,
          createdAtServer: FieldValue.serverTimestamp(),
          updatedAtServer: FieldValue.serverTimestamp(),
          lastMessage: message,
          lastMessageSenderId: decoded.uid,
          unreadBy: {
            [decoded.uid]: 0,
            [sellerId]: FieldValue.increment(1),
          },
        },
        { merge: true }
      );

      tx.set(messageRef, {
        chatId,
        senderId: decoded.uid,
        senderRole: "buyer",
        text: message,
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ chatId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "offer/unknown-error";
    const status =
      message.startsWith("auth/") || message.includes("ID token")
        ? 401
        : message.startsWith("Missing required env var:")
          ? 500
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
