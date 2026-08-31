import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSocialEnabled } from "@/lib/postgres";
import {
  deleteLikeFromPostgres,
  listLikesFromPostgres,
  upsertLikeInPostgres,
  type SocialLikeRecord,
} from "@/lib/postgres-social";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function likeIdFor(actorId: string, listingId: string, bazarItemId?: string) {
  return `${actorId}__${listingId}${bazarItemId ? `__${bazarItemId}` : ""}`;
}

function normalizeLike(body: Record<string, unknown>, actorId: string): SocialLikeRecord {
  const listingId = cleanText(body.listingId, 160);
  const bazarItemId = cleanText(body.bazarItemId, 160);
  const ownerId = cleanText(body.ownerId, 160);

  if (!listingId || !ownerId) {
    throw new Error("like/invalid-payload");
  }

  return {
    id: likeIdFor(actorId, listingId, bazarItemId || undefined),
    actorId,
    actorName: cleanText(body.actorName, 180),
    ownerId,
    ownerName: cleanText(body.ownerName, 180),
    listingId,
    bazarItemId: bazarItemId || undefined,
    itemTitle: cleanText(body.itemTitle, 220),
    image: cleanText(body.image, 1200),
    price: Number(body.price || 0),
    currency: body.currency === "USD" ? "USD" : "DOP",
    location: cleanText(body.location, 180),
    href: cleanText(body.href, 500),
    createdAt: Number(body.createdAt || Date.now()),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actorId = cleanText(request.nextUrl.searchParams.get("actorId"), 160);
    const ownerId = cleanText(request.nextUrl.searchParams.get("ownerId"), 160);

    if (!actorId && !ownerId) {
      return NextResponse.json({ error: "like/missing-query" }, { status: 400 });
    }

    if (isPostgresSocialEnabled()) {
      const rows = await listLikesFromPostgres({ actorId, ownerId });
      return NextResponse.json({ likes: rows });
    }

    const field = actorId ? "actorId" : "ownerId";
    const value = actorId || ownerId;
    const snap = await getAdminDb().collection("likes").where(field, "==", value).get();
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ likes: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "like/read-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const like = normalizeLike(body, decoded.uid);

    if (isPostgresSocialEnabled()) {
      await upsertLikeInPostgres(like);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("likes").doc(like.id).set(like);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "like/write-failed";
    const status = message.startsWith("like/") ? 400 : message.startsWith("auth/") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const listingId = cleanText(body.listingId, 160);
    const bazarItemId = cleanText(body.bazarItemId, 160);
    const id = likeIdFor(decoded.uid, listingId, bazarItemId || undefined);

    if (!listingId) {
      return NextResponse.json({ error: "like/invalid-payload" }, { status: 400 });
    }

    if (isPostgresSocialEnabled()) {
      await deleteLikeFromPostgres(id);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("likes").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "like/delete-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
