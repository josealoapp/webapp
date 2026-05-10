"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function getUserProfileDoc(userId: string) {
  return doc(db, "userProfiles", userId);
}

export function subscribeVerifiedUser(userId: string, onData: (verified: boolean) => void) {
  if (!userId) {
    onData(false);
    return () => undefined;
  }

  let cancelled = false;

  const load = async () => {
    try {
      const snapshot = await getDoc(getUserProfileDoc(userId));
      if (cancelled) return;
      const data = snapshot.data() as { isVerified?: boolean } | undefined;
      onData(Boolean(data?.isVerified));
    } catch {
      if (!cancelled) {
        onData(false);
      }
    }
  };

  void load();
  const intervalId = window.setInterval(load, 15000);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}
