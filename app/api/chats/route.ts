import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresChatsEnabled } from "@/lib/postgres";
import { listChatsFromPostgres } from "@/lib/postgres-chats";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: string | null, maxLength = 160) {
  return (value || "").trim().slice(0, maxLength);
}

function cleanLimit(value: string | null) {
  const limit = Number(value || 25);
  if (!Number.isFinite(limit)) return 25;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const userId = cleanText(request.nextUrl.searchParams.get("userId"));
    const role = request.nextUrl.searchParams.get("role") === "seller" ? "seller" : "buyer";
    const cursor = Number(request.nextUrl.searchParams.get("cursor") || 0) || null;
    const limit = cleanLimit(request.nextUrl.searchParams.get("limit"));

    if (!userId) {
      return NextResponse.json({ error: "chat/missing-user-id" }, { status: 400 });
    }

    if (userId !== decoded.uid) {
      return NextResponse.json({ error: "chat/forbidden" }, { status: 403 });
    }

    if (isPostgresChatsEnabled()) {
      const result = await listChatsFromPostgres({ userId, role, cursor, pageSize: limit });
      return NextResponse.json(result);
    }

    const field = role === "buyer" ? "buyerId" : "sellerId";
    const snap = await getAdminDb().collection("chats").where(field, "==", userId).get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as { id: string; updatedAt?: number }))
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, limit);

    return NextResponse.json({
      chats: rows,
      nextCursor: rows.length === limit ? Number(rows[rows.length - 1]?.updatedAt || 0) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chat/list-failed";
    const status = message.startsWith("auth/") || message.includes("ID token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
