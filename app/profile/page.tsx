"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfileRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile/me");
  }, [router]);

  return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
}
