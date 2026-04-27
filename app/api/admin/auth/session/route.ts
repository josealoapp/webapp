import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USERNAME, assertAdminRequest, ensureSuperAdminConfig } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await ensureSuperAdminConfig();
  const session = assertAdminRequest(request);
  return NextResponse.json({
    authenticated: Boolean(session),
    username: session?.username || ADMIN_USERNAME,
  });
}
