"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";

export default function AdminProfilePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/admin/auth/session`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { authenticated: boolean };
        if (!payload.authenticated) {
          router.replace("/admin/sign-in");
        }
      })
      .catch(() => router.replace("/admin/sign-in"));
  }, [router]);

  const handleSignOut = async () => {
    await fetch("/api/admin/auth/sign-out", { method: "POST" });
    router.replace("/admin/sign-in");
  };

  const handleChangePassword = async () => {
    setStatus("");
    const response = await fetch("/api/admin/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      setStatus("Password must contain at least 8 characters.");
      return;
    }

    setPassword("");
    setStatus("Password updated.");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="text-lg font-semibold">Admin Profile</div>
          <div className="mt-1 text-sm text-neutral-400">Manage your admin session.</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-orange-400" />
            Change password
          </div>
          <div className="mt-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm outline-none focus:border-orange-400"
            />
          </div>
          {status ? <div className="mt-3 text-sm text-neutral-300">{status}</div> : null}
          <button
            type="button"
            onClick={handleChangePassword}
            className="mt-4 h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300"
          >
            Change password
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <LogOut className="h-5 w-5 text-red-300" />
            Session
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 h-12 w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-300"
          >
            Sign out
          </button>
        </section>
      </main>

      <AdminBottomNav active="profile" />
    </div>
  );
}
