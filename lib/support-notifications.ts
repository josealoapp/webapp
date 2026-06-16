"use client";

import { auth } from "@/lib/firebase";

export type SupportNotification = {
  id: string;
  userId: string;
  type: "item_removed" | "account_deactivated" | "account_reactivated" | "listing_reserved" | "listing_sold";
  title: string;
  message: string;
  reason: string;
  listingId?: string;
  read?: boolean;
  createdAt: number;
};

export function subscribeSupportNotifications(userId: string, onData: (rows: SupportNotification[]) => void) {
  if (!userId) {
    onData([]);
    return () => undefined;
  }

  let cancelled = false;
  const load = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("auth/missing-token");
      const response = await fetch(`/api/support-notifications?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as
        | { notifications?: SupportNotification[] }
        | null;
      if (!cancelled) onData(payload?.notifications || []);
    } catch {
      if (!cancelled) onData([]);
    }
  };

  void load();
  const intervalId = window.setInterval(load, 15000);
  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export async function markSupportNotificationRead(notificationId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");
  await fetch("/api/support-notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notificationId }),
  });
}
