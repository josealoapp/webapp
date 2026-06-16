"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";

export default function AccountStatusGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let stopProfilePolling: () => void = () => undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      stopProfilePolling();
      stopProfilePolling = () => undefined;

      if (!user?.uid) return;

      const checkStatus = async () => {
        if (signingOutRef.current) return;

        const response = await fetch(`/api/profile?scope=public&userId=${encodeURIComponent(user.uid)}`, {
          cache: "no-store",
        }).catch(() => null);
        const payload = response
          ? ((await response.json().catch(() => null)) as
              | { profile?: { supportStatus?: string; supportDeactivationReason?: string } | null }
              | null)
          : null;
        const data = payload?.profile as
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
      };

      void checkStatus();
      const intervalId = window.setInterval(checkStatus, 15000);
      stopProfilePolling = () => window.clearInterval(intervalId);
    });

    return () => {
      stopProfilePolling();
      unsubscribeAuth();
    };
  }, [pathname, router]);

  return null;
}
