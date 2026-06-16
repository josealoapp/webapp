import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSocialEnabled } from "@/lib/postgres";
import {
  deleteFollowFromPostgres,
  listFollowsFromPostgres,
  upsertFollowInPostgres,
  type SocialFollowRecord,
} from "@/lib/postgres-social";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function followIdFor(followerId: string, followeeId: string) {
  return `${followerId}__${followeeId}`;
}

function normalizeFollow(body: Record<string, unknown>, followerId: string): SocialFollowRecord {
  const followeeId = cleanText(body.followeeId, 160);
  if (!followeeId) throw new Error("follow/invalid-payload");

  return {
    id: followIdFor(followerId, followeeId),
    followerId,
    followerName: cleanText(body.followerName, 180),
    followeeId,
    followeeName: cleanText(body.followeeName, 180),
    createdAt: Number(body.createdAt || Date.now()),
  };
}

export async function GET(request: NextRequest) {
  try {
    const followerId = cleanText(request.nextUrl.searchParams.get("followerId"), 160);
    const followeeId = cleanText(request.nextUrl.searchParams.get("followeeId"), 160);

    if (!followerId && !followeeId) {
      return NextResponse.json({ error: "follow/missing-query" }, { status: 400 });
    }

    if (isPostgresSocialEnabled()) {
      const rows = await listFollowsFromPostgres({ followerId, followeeId });
      return NextResponse.json({ follows: rows });
    }

    const field = followerId ? "followerId" : "followeeId";
    const value = followerId || followeeId;
    const snap = await getAdminDb().collection("follows").where(field, "==", value).get();
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ follows: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "follow/read-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const follow = normalizeFollow(body, decoded.uid);

    if (isPostgresSocialEnabled()) {
      await upsertFollowInPostgres(follow);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("follows").doc(follow.id).set(follow);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "follow/write-failed";
    const status = message.startsWith("follow/") ? 400 : message.startsWith("auth/") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const followeeId = cleanText(body.followeeId, 160);
    if (!followeeId) {
      return NextResponse.json({ error: "follow/invalid-payload" }, { status: 400 });
    }

    const id = followIdFor(decoded.uid, followeeId);

    if (isPostgresSocialEnabled()) {
      await deleteFollowFromPostgres(id);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("follows").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "follow/delete-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
