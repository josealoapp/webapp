"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SupportNotification = {
  id: string;
  userId: string;
  type: "item_removed" | "account_deactivated" | "account_reactivated";
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

  const q = query(collection(db, "supportNotifications"), where("userId", "==", userId));

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SupportNotification, "id">),
        })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      );
    },
    () => onData([])
  );
}

export async function markSupportNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "supportNotifications", notificationId), {
    read: true,
    readAt: Date.now(),
    readAtServer: serverTimestamp(),
  });
}
