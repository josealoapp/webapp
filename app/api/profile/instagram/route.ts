import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  getPublicProfileFromPostgres,
  isPostgresProfilesEnabled,
  upsertPublicProfileInPostgres,
} from "@/lib/postgres-profiles";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function normalizeInstagramUsername(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const withoutUrl = trimmedValue
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "");

  const username = withoutUrl.split("/")[0]?.trim() || "";

  return username.replace(/[^a-zA-Z0-9._]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "profile/instagram-missing-user-id" }, { status: 400 });
    }

    if (isPostgresProfilesEnabled()) {
      const data = (await getPublicProfileFromPostgres(userId)) as { instagramUsername?: string } | null;
      return NextResponse.json({
        instagramUsername: normalizeInstagramUsername(data?.instagramUsername || ""),
      });
    }

    const snapshot = await getAdminDb().collection("userProfiles").doc(userId).get();
    const data = snapshot.data() as { instagramUsername?: string } | undefined;

    return NextResponse.json({
      instagramUsername: normalizeInstagramUsername(data?.instagramUsername || ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/instagram-read-failed";
    return NextResponse.json({ error: message }, { status: 500 });
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
      | { userId?: string; instagramUsername?: string }
      | null;

    const userId = body?.userId?.trim();
    const instagramUsername = normalizeInstagramUsername(body?.instagramUsername || "");

    if (!userId) {
      return NextResponse.json({ error: "profile/instagram-missing-user-id" }, { status: 400 });
    }

    if (!instagramUsername) {
      return NextResponse.json({ error: "profile/instagram-invalid-username" }, { status: 400 });
    }

    if (decoded.uid !== userId) {
      return NextResponse.json({ error: "profile/instagram-forbidden" }, { status: 403 });
    }

    if (isPostgresProfilesEnabled()) {
      await upsertPublicProfileInPostgres(userId, {
        instagramUsername,
        updatedAt: Date.now(),
      });

      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("userProfiles").doc(userId).set(
      {
        instagramUsername,
        updatedAt: Date.now(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/instagram-save-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
