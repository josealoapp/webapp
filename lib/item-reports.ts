"use client";

import { auth } from "@/lib/firebase";

export const REPORT_REASONS = [
  "Estafa",
  "articulo robado",
  "articulo no esta disponible",
  "Desnudez",
  "derechos de autor",
  "articulo ilegal",
  "otro",
] as const;

export async function createItemReport(input: {
  listingId: string;
  bazarItemId?: string;
  sellerId?: string;
  itemTitle: string;
  reason: string;
  details?: string;
}) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "report/create-failed");
  }
}
