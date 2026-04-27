import { buildAdminSignOutResponse } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST() {
  return buildAdminSignOutResponse();
}
