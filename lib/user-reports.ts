"use client";

import { auth } from "@/lib/firebase";

export const USER_REPORT_REASONS = [
  "Estafa",
  "Tienda falsa",
  "Suplantación de identidad",
  "Acoso o amenazas",
  "Contenido ofensivo",
  "Información falsa",
  "Actividad sospechosa",
  "Venta de artículos prohibidos",
  "Otro",
] as const;

export async function createUserReport(input: {
  targetUserId: string;
  targetUserName: string;
  reason: string;
  details: string;
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
    body: JSON.stringify({
      reportType: "user",
      targetUserId: input.targetUserId,
      targetUserName: input.targetUserName,
      reason: input.reason,
      details: input.details,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "report/user-create-failed");
  }
}
