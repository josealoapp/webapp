"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

function getUserProfileDoc(userId: string) {
  return doc(db, "userProfiles", userId);
}

export function subscribeVerifiedUser(userId: string, onData: (verified: boolean) => void) {
  if (!userId) {
    onData(false);
    return () => undefined;
  }

  return onSnapshot(
    getUserProfileDoc(userId),
    (snapshot) => {
      const data = snapshot.data() as { isVerified?: boolean } | undefined;
      onData(Boolean(data?.isVerified));
    },
    () => {
      onData(false);
    }
  );
}
