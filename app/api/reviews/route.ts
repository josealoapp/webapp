import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSalesEnabled } from "@/lib/postgres";
import {
  completeReviewRequestInPostgres,
  createDirectReviewInPostgres,
  listPendingReviewRequestsFromPostgres,
  listReviewsForSellerFromPostgres,
  skipReviewRequestInPostgres,
} from "@/lib/postgres-sales";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  try {
    const sellerId = request.nextUrl.searchParams.get("sellerId")?.trim() || "";
    if (sellerId) {
      if (isPostgresSalesEnabled()) {
        const reviews = await listReviewsForSellerFromPostgres(sellerId);
        return NextResponse.json({ reviews });
      }

      const snap = await getAdminDb()
        .collection("userRatings")
        .where("sellerId", "==", sellerId)
        .limit(30)
        .get();

      return NextResponse.json({
        reviews: snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => Number((b as { createdAt?: number }).createdAt || 0) - Number((a as { createdAt?: number }).createdAt || 0)),
      });
    }

    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);

    if (isPostgresSalesEnabled()) {
      const requests = await listPendingReviewRequestsFromPostgres(decoded.uid);
      return NextResponse.json({ requests });
    }

    const snap = await getAdminDb()
      .collection("purchaseReviewRequests")
      .where("buyerId", "==", decoded.uid)
      .where("status", "==", "pending")
      .limit(5)
      .get();

    return NextResponse.json({
      requests: snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => Number((b as { createdAt?: number }).createdAt || 0) - Number((a as { createdAt?: number }).createdAt || 0)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reviews/read-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as {
      requestId?: unknown;
      sellerId?: unknown;
      sellerName?: unknown;
      action?: unknown;
      rating?: unknown;
      comment?: unknown;
    } | null;
    const requestId = cleanText(body?.requestId, 180);
    const action = cleanText(body?.action, 20);
    const directSellerId = cleanText(body?.sellerId, 180);

    if (!requestId && directSellerId) {
      if (directSellerId === decoded.uid) {
        return NextResponse.json({ error: "reviews/self-review" }, { status: 400 });
      }

      const rating = Number(body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: "reviews/invalid-rating" }, { status: 400 });
      }

      const comment = cleanText(body?.comment, 500);
      if (isPostgresSalesEnabled()) {
        await createDirectReviewInPostgres({
          sellerId: directSellerId,
          sellerName: cleanText(body?.sellerName, 180) || "Vendedor",
          buyerId: decoded.uid,
          buyerName: decoded.name || decoded.email || "Usuario",
          rating,
          comment,
        });

        return NextResponse.json({ ok: true });
      }

      const now = Date.now();
      const reviewId = `direct_${directSellerId}_${decoded.uid}`;
      const db = getAdminDb();
      const reviewRef = db.collection("userRatings").doc(reviewId);
      const existing = await reviewRef.get();
      if (existing.exists) {
        return NextResponse.json({ error: "reviews/already-reviewed" }, { status: 409 });
      }

      await db.runTransaction(async (tx) => {
        const profileRef = db.collection("userProfiles").doc(directSellerId);
        const profileSnap = await tx.get(profileRef);
        tx.set(reviewRef, {
          requestId: "",
          sellerId: directSellerId,
          sellerName: cleanText(body?.sellerName, 180) || "Vendedor",
          buyerId: decoded.uid,
          buyerName: decoded.name || decoded.email || "Usuario",
          listingId: "",
          bazarItemId: "",
          itemTitle: "Reseña directa",
          source: "direct",
          rating,
          comment,
          createdAt: now,
          createdAtServer: FieldValue.serverTimestamp(),
        });

        const current = profileSnap.data() as { sellerRatingSum?: number; sellerRatingCount?: number } | undefined;
        const nextSum = Number(current?.sellerRatingSum || 0) + rating;
        const nextCount = Number(current?.sellerRatingCount || 0) + 1;
        tx.set(profileRef, {
          sellerRatingSum: nextSum,
          sellerRatingCount: nextCount,
          sellerRatingAvg: Math.round((nextSum / nextCount) * 10) / 10,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      return NextResponse.json({ ok: true });
    }

    if (!requestId) return NextResponse.json({ error: "reviews/missing-request" }, { status: 400 });

    if (isPostgresSalesEnabled()) {
      if (action === "skip") {
        await skipReviewRequestInPostgres(requestId, decoded.uid);
        return NextResponse.json({ ok: true });
      }

      const rating = Number(body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: "reviews/invalid-rating" }, { status: 400 });
      }
      await completeReviewRequestInPostgres({
        requestId,
        buyerId: decoded.uid,
        buyerName: decoded.name || decoded.email || "Usuario",
        rating,
        comment: cleanText(body?.comment, 500),
      });

      return NextResponse.json({ ok: true });
    }

    const db = getAdminDb();
    const requestRef = db.collection("purchaseReviewRequests").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) return NextResponse.json({ error: "reviews/not-found" }, { status: 404 });
    const reviewRequest = requestSnap.data() as {
      buyerId?: string;
      sellerId?: string;
      listingId?: string;
      bazarItemId?: string;
      itemTitle?: string;
      sellerName?: string;
      status?: string;
    };
    if (reviewRequest.buyerId !== decoded.uid) return NextResponse.json({ error: "reviews/forbidden" }, { status: 403 });
    if (reviewRequest.status !== "pending") return NextResponse.json({ ok: true });

    if (action === "skip") {
      await requestRef.set({ status: "skipped", updatedAt: Date.now(), updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    const rating = Number(body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "reviews/invalid-rating" }, { status: 400 });
    }
    const comment = cleanText(body?.comment, 500);
    const now = Date.now();
    const sellerId = reviewRequest.sellerId || "";
    if (!sellerId) return NextResponse.json({ error: "reviews/missing-seller" }, { status: 400 });

    await db.runTransaction(async (tx) => {
      const profileRef = db.collection("userProfiles").doc(sellerId);
      const profileSnap = await tx.get(profileRef);
      tx.set(db.collection("userRatings").doc(requestId), {
        requestId,
        sellerId,
        sellerName: reviewRequest.sellerName || "Vendedor",
        buyerId: decoded.uid,
        listingId: reviewRequest.listingId || "",
        bazarItemId: reviewRequest.bazarItemId || "",
        itemTitle: reviewRequest.itemTitle || "Artículo",
        rating,
        comment,
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp(),
      });
      tx.set(requestRef, {
        status: "completed",
        rating,
        comment,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      }, { merge: true });

      const current = profileSnap.data() as { sellerRatingSum?: number; sellerRatingCount?: number } | undefined;
      const nextSum = Number(current?.sellerRatingSum || 0) + rating;
      const nextCount = Number(current?.sellerRatingCount || 0) + 1;
      tx.set(profileRef, {
        sellerRatingSum: nextSum,
        sellerRatingCount: nextCount,
        sellerRatingAvg: Math.round((nextSum / nextCount) * 10) / 10,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reviews/write-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
