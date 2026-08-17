import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  getPrivateProfileFromPostgres,
  getPublicProfileFromPostgres,
  isPostgresProfilesEnabled,
  upsertPrivateProfileInPostgres,
  upsertPublicProfileInPostgres,
} from "@/lib/postgres-profiles";

export const runtime = "nodejs";

function cleanUserId(value: string | null | undefined) {
  return (value || "").trim().slice(0, 160);
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

async function verifyOwner(request: NextRequest, userId: string) {
  const token = getBearerToken(request);
  if (!token) throw new Error("auth/missing-token");
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (decoded.uid !== userId) throw new Error("profile/forbidden");
  return decoded;
}

function preserveExistingHandle(
  incomingProfile: Record<string, unknown>,
  existingProfile: Record<string, unknown> | null | undefined
) {
  const existingHandle = typeof existingProfile?.handle === "string" ? existingProfile.handle.trim() : "";
  const incomingHandle = typeof incomingProfile.handle === "string" ? incomingProfile.handle.trim() : "";

  if (!existingHandle || !incomingHandle || existingHandle === incomingHandle) {
    return incomingProfile;
  }

  const nextProfile = { ...incomingProfile };
  delete nextProfile.handle;
  delete nextProfile.handleLower;
  return nextProfile;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function cleanUrl(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, maxLength);

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function sanitizePublicProfile(profile: Record<string, unknown>, userId: string) {
  const displayName = cleanText(profile.displayName || profile.name, 30);
  const description = cleanText(profile.description || profile.profileDescription, 120);
  const avatarUrl = cleanUrl(profile.avatarUrl, 500);
  const instagramUsername = cleanText(profile.instagramUsername, 30).replace(/[^a-zA-Z0-9._]/g, "");
  const now = Date.now();

  return {
    userId,
    ...(displayName ? { displayName, name: displayName } : {}),
    ...(description ? { description, profileDescription: description } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(instagramUsername ? { instagramUsername } : {}),
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = cleanUserId(request.nextUrl.searchParams.get("userId"));
    const scope = request.nextUrl.searchParams.get("scope") === "private" ? "private" : "public";

    if (!userId) {
      return NextResponse.json({ error: "profile/missing-user-id" }, { status: 400 });
    }

    if (scope === "private") {
      await verifyOwner(request, userId);
    }

    if (isPostgresProfilesEnabled()) {
      const profile =
        scope === "private"
          ? await getPrivateProfileFromPostgres(userId)
          : await getPublicProfileFromPostgres(userId);

      return NextResponse.json({ profile });
    }

    const collection = scope === "private" ? "userPrivateProfiles" : "userProfiles";
    const snapshot = await getAdminDb().collection(collection).doc(userId).get();
    return NextResponse.json({
      profile: snapshot.exists ? { userId, ...snapshot.data() } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/read-failed";
    const status = message === "auth/missing-token" ? 401 : message === "profile/forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { userId?: string; scope?: string; profile?: Record<string, unknown> }
      | null;
    const userId = cleanUserId(body?.userId);
    const scope = body?.scope === "private" ? "private" : "public";
    const profile = body?.profile && typeof body.profile === "object" ? body.profile : null;

    if (!userId || !profile) {
      return NextResponse.json({ error: "profile/invalid-payload" }, { status: 400 });
    }

    await verifyOwner(request, userId);

    if (isPostgresProfilesEnabled()) {
      if (scope === "private") {
        await upsertPrivateProfileInPostgres(userId, { ...profile, userId });
      } else {
        const existing = await getPublicProfileFromPostgres(userId);
        const sanitizedProfile = sanitizePublicProfile(profile, userId);
        await upsertPublicProfileInPostgres(userId, preserveExistingHandle(sanitizedProfile, existing));
      }

      return NextResponse.json({ ok: true });
    }

    const collection = scope === "private" ? "userPrivateProfiles" : "userProfiles";
    const currentPublicProfile =
      scope === "public"
        ? ((await getAdminDb().collection(collection).doc(userId).get()).data() as Record<string, unknown> | undefined)
        : null;
    await getAdminDb()
      .collection(collection)
      .doc(userId)
      .set(
        {
          ...(scope === "public"
            ? preserveExistingHandle(sanitizePublicProfile(profile, userId), currentPublicProfile)
            : profile),
          userId,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/write-failed";
    const status = message === "auth/missing-token" ? 401 : message === "profile/forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
