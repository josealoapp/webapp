"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminUserRow from "@/components/admin/AdminUserRow";
import type { AdminReportRow, AdminUserRow as AdminUser } from "@/lib/admin-types";

type DashboardPayload = {
  userCounts: Array<{ date: string; count: number }>;
  selectedDate: string;
  selectedDateCount: number | null;
  users: AdminUser[];
  reports: AdminReportRow[];
};

export default function AdminHomePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userQuery, setUserQuery] = useState("");

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
    setLoading(true);
    setError("");
    const query = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
    fetch(`/api/admin/dashboard${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("admin/dashboard-failed");
        }
        const payload = (await response.json()) as DashboardPayload;
        setData(payload);
      })
      .catch(() => setError("No pudimos cargar el dashboard admin."))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const visibleUsers = useMemo(() => {
    const rows = data?.users || [];
    const normalized = userQuery.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((user) =>
      user.displayName.toLowerCase().includes(normalized) ||
      user.email.toLowerCase().includes(normalized)
    );
  }, [data?.users, userQuery]);

  const recentCounts = (data?.userCounts || []).slice(-14);
  const maxCount = Math.max(1, ...recentCounts.map((entry) => entry.count));

  const handleToggleVerify = async (user: AdminUser) => {
    await fetch("/api/admin/users/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, verified: !user.isVerified }),
    });
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((row) =>
              row.uid === user.uid ? { ...row, isVerified: !row.isVerified } : row
            ),
          }
        : current
    );
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete account for ${user.displayName}?`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid }),
    });
    setData((current) =>
      current ? { ...current, users: current.users.filter((row) => row.uid !== user.uid) } : current
    );
  };

  const handleDeleteItem = async (report: AdminReportRow) => {
    if (!window.confirm(`Delete item "${report.itemTitle}"?`)) return;
    await fetch("/api/admin/items/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: report.listingId }),
    });
    setData((current) =>
      current ? { ...current, reports: current.reports.filter((row) => row.id !== report.id) } : current
    );
  };

  const handleDeleteReportedUser = async (report: AdminReportRow) => {
    if (!report.sellerId) return;
    if (!window.confirm(`Delete user account for seller ${report.sellerId}?`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: report.sellerId }),
    });
    setData((current) =>
      current ? { ...current, reports: current.reports.filter((row) => row.id !== report.id) } : current
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Admin Home</div>
            <div className="text-sm text-neutral-400">Users, verification, and reports</div>
          </div>
          <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200">
            <CalendarDays className="h-5 w-5" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Usuarios por día</div>
              <div className="mt-1 text-sm text-neutral-400">
                {selectedDate
                  ? `${selectedDate}: ${data?.selectedDateCount ?? 0} usuarios`
                  : "Últimos 14 días"}
              </div>
            </div>
          </div>
          <div className="mt-5 flex h-48 items-end gap-2">
            {loading ? (
              <div className="text-sm text-neutral-400">Cargando gráfico…</div>
            ) : (
              recentCounts.map((entry) => (
                <div key={entry.date} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-xl bg-orange-400/90"
                    style={{ height: `${Math.max(12, (entry.count / maxCount) * 160)}px` }}
                  />
                  <div className="text-[10px] text-neutral-500">{entry.date.slice(5)}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold">Lista de usuarios</div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Buscar users"
                className="h-11 w-full rounded-2xl border border-neutral-800 bg-neutral-950 pl-10 pr-4 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
            {visibleUsers.map((user) => (
              <AdminUserRow
                key={user.uid}
                user={user}
                onToggleVerify={handleToggleVerify}
                onDelete={handleDeleteUser}
              />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="text-lg font-semibold">Report list</div>
          <div className="mt-4 space-y-3">
            {(data?.reports || []).map((report) => (
              <div key={report.id} className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-neutral-800">
                    {report.listingImage ? (
                      <img src={report.listingImage} alt={report.itemTitle} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-100">{report.itemTitle}</div>
                    <div className="mt-1 text-xs text-neutral-400">
                      {report.reason} · {report.reporterName}
                    </div>
                    {report.details ? (
                      <div className="mt-2 text-xs text-neutral-500">{report.details}</div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(report)}
                    className="flex-1 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300"
                  >
                    Delete item
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReportedUser(report)}
                    className="flex-1 rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300"
                  >
                    Delete user
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AdminBottomNav active="home" />
    </div>
  );
}
