"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminUserRow from "@/components/admin/AdminUserRow";
import type { AdminUserRow as AdminUser } from "@/lib/admin-types";

export default function AdminUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);

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

  useEffect(() => {
    const search = query ? `?query=${encodeURIComponent(query)}` : "";
    fetch(`/api/admin/users${search}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("admin/users-failed");
        const payload = (await response.json()) as { users: AdminUser[] };
        setUsers(payload.users);
      })
      .catch(() => setUsers([]));
  }, [query]);

  const handleToggleVerify = async (user: AdminUser) => {
    await fetch("/api/admin/users/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, verified: !user.isVerified }),
    });
    setUsers((current) =>
      current.map((row) =>
        row.uid === user.uid
          ? {
              ...row,
              isVerified: !row.isVerified,
              businessVerificationStatus:
                row.accountType === "business" ? (!row.isVerified ? "verified" : "pending") : row.businessVerificationStatus,
            }
          : row
      )
    );
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete account for ${user.displayName}?`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid }),
    });
    setUsers((current) => current.filter((row) => row.uid !== user.uid));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="text-lg font-semibold">Users</div>
          <div className="mt-1 text-sm text-neutral-400">Search users and manage verification.</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="text-lg font-semibold">Invite admins</div>
          <div className="mt-1 text-sm text-neutral-400">This input is visible for the MVP, but it does not work yet.</div>
          <div className="mt-4 flex gap-3">
            <div className="relative flex-1">
              <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Add admin email"
                className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-950 pl-10 pr-4 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <button
              type="button"
              className="rounded-2xl border border-neutral-800 bg-neutral-900 px-5 text-sm font-semibold text-neutral-400"
            >
              Invite
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users"
              className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-950 pl-10 pr-4 text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <AdminUserRow
                key={user.uid}
                user={user}
                onToggleVerify={handleToggleVerify}
                onDelete={handleDeleteUser}
              />
            ))}
          </div>
        </section>
      </main>

      <AdminBottomNav active="users" />
    </div>
  );
}
