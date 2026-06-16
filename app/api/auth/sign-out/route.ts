import { NextRequest, NextResponse } from "next/server";
import { revokePostgresAuthToken } from "@/lib/postgres-auth";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (token) await revokePostgresAuthToken(token).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
