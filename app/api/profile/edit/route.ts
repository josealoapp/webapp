import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresAuthEnabled, pgQuery } from "@/lib/postgres";
import { updatePostgresAuthUserProfile } from "@/lib/postgres-auth";
import { syncPublicIdentityReferences } from "@/lib/profile-identity-sync";
import {
  getPublicProfileFromPostgres,
  isPostgresProfilesEnabled,
  upsertPublicProfileInPostgres,
} from "@/lib/postgres-profiles";

export const runtime = "nodejs";

const USER_ID_UPDATE_INTERVAL_MS = 365 * 24 * 60 * 60 * 1000;
const USERNAME_MAX_LENGTH = 30;
const USER_ID_MAX_LENGTH = 20;

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function cleanUsername(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, USERNAME_MAX_LENGTH) : "";
}

function cleanDescription(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function cleanUserIdHandle(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@+/, "").toLowerCase().slice(0, USER_ID_MAX_LENGTH);
}

function normalizeUserIdHandle(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function isValidUserIdHandle(value: string) {
  return new RegExp(`^[a-z0-9_-]{3,${USER_ID_MAX_LENGTH}}$`).test(value);
}

async function isPostgresHandleTaken(userId: string, handle: string) {
  const result = await pgQuery<{ id: string }>(
    `
      select id
      from user_profiles
      where id <> $1
        and lower(profile ->> 'handle') = lower($2)
      limit 1
    `,
    [userId, handle]
  );

  return result.rows.length > 0;
}

async function isFirestoreHandleTaken(userId: string, handle: string) {
  const db = getAdminDb();
  const [normalizedSnap, exactSnap] = await Promise.all([
    db.collection("userProfiles").where("handleLower", "==", handle).limit(1).get(),
    db.collection("userProfiles").where("handle", "==", handle).limit(1).get(),
  ]);

  return [...normalizedSnap.docs, ...exactSnap.docs].some((doc) => doc.id !== userId);
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const userId = decoded.uid;
    const body = (await request.json().catch(() => null)) as
      | { username?: unknown; userIdHandle?: unknown; description?: unknown }
      | null;

    const username = cleanUsername(body?.username);
    const requestedHandle = cleanUserIdHandle(body?.userIdHandle);
    const description = cleanDescription(body?.description);

    if (username.length < 2) {
      return NextResponse.json({ error: "profile/username-too-short" }, { status: 400 });
    }

    if (!isValidUserIdHandle(requestedHandle)) {
      return NextResponse.json({ error: "profile/user-id-invalid" }, { status: 400 });
    }

    const now = Date.now();

    if (isPostgresProfilesEnabled()) {
      const current = (await getPublicProfileFromPostgres(userId)) as
        | {
            displayName?: string;
            name?: string;
            handle?: string;
            userIdUpdatedAt?: number;
            handleUpdatedAt?: number;
            userIdChangeCount?: number;
          }
        | null;
      const currentHandle = normalizeUserIdHandle(String(current?.handle || ""));
      const handleChanged = requestedHandle !== currentHandle;
      const lastUserIdUpdate = Number(current?.userIdUpdatedAt || current?.handleUpdatedAt || 0);
      const userIdChangeCount = Number(current?.userIdChangeCount || 0);
      const countsAsUserIdChange = Boolean(currentHandle && handleChanged);

      if (countsAsUserIdChange && userIdChangeCount > 0 && lastUserIdUpdate && now - lastUserIdUpdate < USER_ID_UPDATE_INTERVAL_MS) {
        return NextResponse.json({ error: "profile/user-id-update-too-soon" }, { status: 409 });
      }

      if (handleChanged && (await isPostgresHandleTaken(userId, requestedHandle))) {
        return NextResponse.json({ error: "profile/user-id-taken" }, { status: 409 });
      }

      await upsertPublicProfileInPostgres(userId, {
        displayName: username,
        name: username,
        handle: requestedHandle,
        description,
        profileDescription: description,
        ...(countsAsUserIdChange
          ? { userIdUpdatedAt: now, handleUpdatedAt: now, userIdChangeCount: userIdChangeCount + 1 }
          : handleChanged
            ? { userIdInitializedAt: now }
            : {}),
        updatedAt: now,
      });

      if (isPostgresAuthEnabled()) {
        await updatePostgresAuthUserProfile(userId, { displayName: username });
      }

      await syncPublicIdentityReferences({ userId, displayName: username, handle: requestedHandle });

      return NextResponse.json({
        profile: {
          displayName: username,
          handle: requestedHandle,
          description,
          profileDescription: description,
          userIdUpdatedAt: countsAsUserIdChange ? now : lastUserIdUpdate,
          userIdChangeCount: countsAsUserIdChange ? userIdChangeCount + 1 : userIdChangeCount,
        },
      });
    }

    const profileRef = getAdminDb().collection("userProfiles").doc(userId);
    const profileSnap = await profileRef.get();
    const current = profileSnap.data() as
      | { handle?: string; userIdUpdatedAt?: number; handleUpdatedAt?: number; userIdChangeCount?: number }
      | undefined;
    const currentHandle = normalizeUserIdHandle(String(current?.handle || ""));
    const handleChanged = requestedHandle !== currentHandle;
    const lastUserIdUpdate = Number(current?.userIdUpdatedAt || current?.handleUpdatedAt || 0);
    const userIdChangeCount = Number(current?.userIdChangeCount || 0);
    const countsAsUserIdChange = Boolean(currentHandle && handleChanged);

    if (countsAsUserIdChange && userIdChangeCount > 0 && lastUserIdUpdate && now - lastUserIdUpdate < USER_ID_UPDATE_INTERVAL_MS) {
      return NextResponse.json({ error: "profile/user-id-update-too-soon" }, { status: 409 });
    }

    if (handleChanged && (await isFirestoreHandleTaken(userId, requestedHandle))) {
      return NextResponse.json({ error: "profile/user-id-taken" }, { status: 409 });
    }

    await profileRef.set(
      {
        displayName: username,
        name: username,
        handle: requestedHandle,
        handleLower: requestedHandle,
        description,
        profileDescription: description,
        ...(countsAsUserIdChange
          ? { userIdUpdatedAt: now, handleUpdatedAt: now, userIdChangeCount: userIdChangeCount + 1 }
          : handleChanged
            ? { userIdInitializedAt: now }
            : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    await getAdminAuth().updateUser(userId, { displayName: username });
    await syncPublicIdentityReferences({ userId, displayName: username, handle: requestedHandle });

    return NextResponse.json({
      profile: {
        displayName: username,
        handle: requestedHandle,
        description,
        profileDescription: description,
        userIdUpdatedAt: countsAsUserIdChange ? now : lastUserIdUpdate,
        userIdChangeCount: countsAsUserIdChange ? userIdChangeCount + 1 : userIdChangeCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/edit-failed";
    const status = message.startsWith("auth/") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
