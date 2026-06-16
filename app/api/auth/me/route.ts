import { NextRequest, NextResponse } from "next/server";
import { verifyPostgresAuthToken } from "@/lib/postgres-auth";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const user = await verifyPostgresAuthToken(token);
    return NextResponse.json({ token, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/session-invalid";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
