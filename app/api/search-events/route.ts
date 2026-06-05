import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type SearchEventRequest = {
  query?: unknown;
  normalizedQuery?: unknown;
  category?: unknown;
  location?: unknown;
  source?: unknown;
};

const SOURCES = new Set(["search", "category", "home"]);

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function cleanText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    let userId = "";

    if (token) {
      const decoded = await getAdminAuth().verifyIdToken(token);
      userId = decoded.uid;
    }

    const body = (await request.json().catch(() => null)) as SearchEventRequest | null;
    const query = cleanText(body?.query, 160);
    const normalizedQuery = normalizeQuery(cleanText(body?.normalizedQuery, 160) || query);
    const category = cleanText(body?.category, 120);
    const location = cleanText(body?.location, 140);
    const source = SOURCES.has(cleanText(body?.source, 40)) ? cleanText(body?.source, 40) : "search";

    if (!normalizedQuery && !category) {
      return NextResponse.json({ error: "search-event/empty" }, { status: 400 });
    }

    await getAdminDb().collection("searchEvents").add({
      query,
      normalizedQuery,
      category,
      location,
      userId,
      source,
      createdAt: Date.now(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "search-event/create-failed";
    const status = message.startsWith("auth/") || message.includes("ID token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
