"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function AccountStatusGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let unsubscribeProfile: () => void = () => undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();
      unsubscribeProfile = () => undefined;

      if (!user?.uid) return;

      unsubscribeProfile = onSnapshot(doc(db, "userProfiles", user.uid), async (snapshot) => {
        if (signingOutRef.current) return;

        const data = snapshot.data() as
          | { supportStatus?: string; supportDeactivationReason?: string }
          | undefined;

        if (data?.supportStatus !== "deactivated") return;

        signingOutRef.current = true;
        try {
          localStorage.removeItem("auth_user");
          sessionStorage.removeItem("pending_interest");
        } catch {
          // Storage can be unavailable in private browsing contexts.
        }

        await signOut(auth).catch(() => undefined);
        const reason = data.supportDeactivationReason
          ? `&reason=${encodeURIComponent(data.supportDeactivationReason)}`
          : "";
        router.replace(`/sign-in?account=deactivated${reason}`);
      });
    });

    return () => {
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, [pathname, router]);

  return null;
}
