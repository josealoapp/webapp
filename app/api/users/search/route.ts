import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeListingSearchText } from "@/lib/listing-search-tokens";
import {
  isPostgresProfilesEnabled,
  PublicUserSearchResult,
  searchPublicProfilesInPostgres,
} from "@/lib/postgres-profiles";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;
const FIRESTORE_SCAN_LIMIT = 250;

function cleanText(value: string | null, maxLength = 120) {
  return (value || "").trim().slice(0, maxLength);
}

function cleanLimit(value: string | null) {
  const limit = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function normalizeSearchText(value: string) {
  return normalizeListingSearchText(value);
}

function cleanPublicUser(id: string, data: Record<string, unknown>): PublicUserSearchResult {
  const displayName =
    (typeof data.displayName === "string" && data.displayName) ||
    (typeof data.name === "string" && data.name) ||
    "Usuario";

  return {
    userId: id,
    displayName,
    handle: typeof data.handle === "string" ? data.handle : "",
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
    profileDescription:
      typeof data.profileDescription === "string"
        ? data.profileDescription
        : typeof data.description === "string"
          ? data.description
          : "",
    isVerified: data.isVerified === true,
  };
}

function userMatchesQuery(data: Record<string, unknown>, query: string) {
  const haystack = normalizeSearchText(
    `${data.displayName || ""} ${data.name || ""} ${data.handle || ""} ${data.profileDescription || ""} ${data.description || ""}`
  );

  return haystack.includes(query);
}

export async function GET(request: NextRequest) {
  try {
    const searchQuery = normalizeSearchText(cleanText(request.nextUrl.searchParams.get("q")));
    const limit = cleanLimit(request.nextUrl.searchParams.get("limit"));

    if (!searchQuery) {
      return NextResponse.json({ users: [] });
    }

    if (isPostgresProfilesEnabled()) {
      const users = await searchPublicProfilesInPostgres(searchQuery, limit);
      return NextResponse.json({ users });
    }

    const snapshot = await getAdminDb()
      .collection("userProfiles")
      .orderBy("updatedAt", "desc")
      .limit(FIRESTORE_SCAN_LIMIT)
      .get();

    const users = snapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      .filter(({ data }) => data.supportStatus !== "deactivated")
      .filter(({ data }) => userMatchesQuery(data, searchQuery))
      .slice(0, limit)
      .map(({ id, data }) => cleanPublicUser(id, data));

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "users/search-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
