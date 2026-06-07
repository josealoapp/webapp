"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, ShieldAlert, Search, X } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminUserRow from "@/components/admin/AdminUserRow";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminReportRow, AdminUserRow as AdminUser } from "@/lib/admin-types";

const moderationReasons = [
  "Artículo no disponible",
  "Derechos de autor",
  "Artículo ilegal",
  "Desnudez",
  "Estafa",
  "Artículo robado",
  "Tienda falsa",
  "Moderación de soporte",
];
const LIST_PAGE_SIZE = 5;
const salesRangeOptions = [
  { value: "last_week", label: "Última semana" },
  { value: "last_month", label: "Último mes" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_year", label: "Último año" },
  { value: "all_time", label: "Todo el tiempo" },
];
const userRangeOptions = [
  { value: "last_week", label: "Última semana" },
  { value: "last_month", label: "Último mes" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_year", label: "Último año" },
  { value: "all_time", label: "Todo el tiempo" },
];

function getReportedUserId(report: AdminReportRow) {
  return report.targetUserId || report.sellerId || "";
}

function markLocalReportHandled(
  report: AdminReportRow,
  action: "delete_item" | "delete_user" | "omit",
  reason: string
): AdminReportRow {
  return {
    ...report,
    status: "handled",
    handledAction: action,
    handledReason: reason,
    handledAt: Date.now(),
  };
}

function getHandledActionLabel(report: AdminReportRow) {
  if (report.handledAction === "delete_item") return "Artículo eliminado";
  if (report.handledAction === "delete_user") return "Usuario desactivado";
  if (report.handledAction === "omit") return "Reporte omitido";
  return "Acción aplicada";
}

function formatDop(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getRangeLabel(value: string, options = userRangeOptions) {
  return options.find((option) => option.value === value)?.label || "Última semana";
}

function matchesUserSearch(user: AdminUser, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${user.displayName} ${user.email} ${user.uid} ${user.supportDeactivationReason || ""}`
    .toLowerCase()
    .includes(normalized);
}

function matchesReportSearch(report: AdminReportRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    report.itemTitle,
    report.reportedUserEmail,
    report.targetUserName,
    getReportedUserId(report),
    report.reason,
    report.reporterName,
    report.details,
    report.handledReason,
    getHandledActionLabel(report),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function paginateRows<T>(rows: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * LIST_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + LIST_PAGE_SIZE),
    page: safePage,
    totalPages,
  };
}

type ModerationAction =
  | { type: "item"; report: AdminReportRow; title: string }
  | { type: "user"; user: AdminUser; title: string }
  | { type: "reported-user"; report: AdminReportRow; title: string };

type DashboardPayload = {
  userCounts: Array<{ date: string; count: number }>;
  weeklyUserCounts: Array<{ date: string; label?: string; count: number }>;
  selectedDate: string;
  selectedDateCount: number | null;
  soldSourceStats: {
    soldWithJosealo: number;
    soldOutside: number;
    total: number;
  };
  appSalesSummary: {
    timeframe: string;
    totalAmount: number;
    itemCount: number;
  };
  users: AdminUser[];
  reports: AdminReportRow[];
};

export default function AdminHomePage() {
  const router = useRouter();
  const [userRange, setUserRange] = useState("last_week");
  const [salesRange, setSalesRange] = useState("all_time");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [deactivatedQuery, setDeactivatedQuery] = useState("");
  const [activeReportQuery, setActiveReportQuery] = useState("");
  const [historicalReportQuery, setHistoricalReportQuery] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [deactivatedPage, setDeactivatedPage] = useState(1);
  const [deactivatedMenuUserId, setDeactivatedMenuUserId] = useState("");
  const [activeReportsPage, setActiveReportsPage] = useState(1);
  const [historicalReportsPage, setHistoricalReportsPage] = useState(1);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [submittingModeration, setSubmittingModeration] = useState(false);

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
    const params = new URLSearchParams({ salesRange, userRange });
    const query = `?${params.toString()}`;
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
  }, [salesRange, userRange]);

  const visibleUsers = useMemo(() => {
    const rows = data?.users || [];
    return rows
      .filter((user) => user.supportStatus !== "deactivated")
      .filter((user) => matchesUserSearch(user, userQuery));
  }, [data?.users, userQuery]);
  const deactivatedUsers = useMemo(
    () =>
      (data?.users || [])
        .filter((user) => user.supportStatus === "deactivated")
        .filter((user) => matchesUserSearch(user, deactivatedQuery)),
    [data?.users, deactivatedQuery]
  );
  const activeReports = useMemo(
    () =>
      (data?.reports || [])
        .filter((report) => report.status !== "handled")
        .filter((report) => matchesReportSearch(report, activeReportQuery)),
    [activeReportQuery, data?.reports]
  );
  const historicalReports = useMemo(
    () =>
      (data?.reports || [])
        .filter((report) => report.status === "handled")
        .filter((report) => matchesReportSearch(report, historicalReportQuery)),
    [data?.reports, historicalReportQuery]
  );
  const paginatedUsers = useMemo(() => paginateRows(visibleUsers, usersPage), [usersPage, visibleUsers]);
  const paginatedDeactivatedUsers = useMemo(
    () => paginateRows(deactivatedUsers, deactivatedPage),
    [deactivatedPage, deactivatedUsers]
  );
  const paginatedActiveReports = useMemo(
    () => paginateRows(activeReports, activeReportsPage),
    [activeReports, activeReportsPage]
  );
  const paginatedHistoricalReports = useMemo(
    () => paginateRows(historicalReports, historicalReportsPage),
    [historicalReportQuery, historicalReports, historicalReportsPage]
  );

  const weeklyCounts = data?.weeklyUserCounts || [];
  const maxWeeklyCount = Math.max(1, ...weeklyCounts.map((entry) => entry.count));
  const soldSourceStats = data?.soldSourceStats || { soldWithJosealo: 0, soldOutside: 0, total: 0 };
  const appSalesSummary = data?.appSalesSummary || { timeframe: salesRange, totalAmount: 0, itemCount: 0 };

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
              row.uid === user.uid
                ? {
                    ...row,
                    isVerified: !row.isVerified,
                    businessVerificationStatus:
                      row.accountType === "business" ? (!row.isVerified ? "verified" : "pending") : row.businessVerificationStatus,
                  }
                : row
            ),
          }
        : current
    );
  };

  const handleDeleteUser = async (user: AdminUser) => {
    setModerationReason("");
    setModerationAction({ type: "user", user, title: `Desactivar cuenta de ${user.displayName}` });
  };

  const submitDeleteUser = async (user: AdminUser, reason: string) => {
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, reason }),
    });
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((row) =>
              row.uid === user.uid
                ? { ...row, supportStatus: "deactivated", supportDeactivationReason: reason }
                : row
            ),
          }
        : current
    );
  };

  const handleDeleteItem = async (report: AdminReportRow) => {
    setModerationReason("");
    setModerationAction({ type: "item", report, title: `Eliminar artículo "${report.itemTitle}"` });
  };

  const submitDeleteItem = async (report: AdminReportRow, reason: string) => {
    await fetch("/api/admin/items/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: report.listingId, reason, reportId: report.id }),
    });
    const handledReport = markLocalReportHandled(report, "delete_item", reason);
    setData((current) =>
      current
        ? {
            ...current,
            reports: current.reports.map((row) => (row.id === report.id ? handledReport : row)),
          }
        : current
    );
  };

  const handleDeleteReportedUser = async (report: AdminReportRow) => {
    if (!getReportedUserId(report)) return;
    setModerationReason("");
    setModerationAction({
      type: "reported-user",
      report,
      title: `Desactivar cuenta reportada ${report.itemTitle || report.sellerId}`,
    });
  };

  const submitDeleteReportedUser = async (report: AdminReportRow, reason: string) => {
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getReportedUserId(report), reason, reportId: report.id }),
    });
    const handledReport = markLocalReportHandled(report, "delete_user", reason);
    setData((current) =>
      current
        ? {
            ...current,
            reports: current.reports.map((row) => (row.id === report.id ? handledReport : row)),
          }
        : current
    );
  };

  const handleOmitReport = async (report: AdminReportRow) => {
    const reason = "Omitido por soporte";
    await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "omit", reason }),
    });
    const handledReport = markLocalReportHandled(report, "omit", reason);
    setData((current) =>
      current
        ? {
            ...current,
            reports: current.reports.map((row) => (row.id === report.id ? handledReport : row)),
          }
        : current
    );
  };

  const submitModerationAction = async () => {
    if (!moderationAction || !moderationReason || submittingModeration) return;

    setSubmittingModeration(true);
    try {
      if (moderationAction.type === "item") {
        await submitDeleteItem(moderationAction.report, moderationReason);
      } else if (moderationAction.type === "user") {
        await submitDeleteUser(moderationAction.user, moderationReason);
      } else {
        await submitDeleteReportedUser(moderationAction.report, moderationReason);
      }
      setModerationAction(null);
      setModerationReason("");
    } finally {
      setSubmittingModeration(false);
    }
  };

  const handleReactivateUser = async (user: AdminUser) => {
    if (!window.confirm(`Reactivar cuenta de ${user.displayName}?`)) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, action: "reactivate" }),
    });
    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.map((row) =>
              row.uid === user.uid
                ? { ...row, supportStatus: "active", supportDeactivationReason: "" }
                : row
            ),
          }
        : current
    );
  };

  const handlePermanentDeleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Eliminar permanentemente la cuenta de ${user.displayName}? Esta acción borrará el usuario y sus datos de la base de datos.`
    );
    if (!confirmed) return;

    setDeactivatedMenuUserId("");
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid, action: "permanent_delete" }),
    });

    if (!response.ok) {
      window.alert("No pudimos eliminar permanentemente esta cuenta. Intenta de nuevo.");
      return;
    }

    setData((current) =>
      current
        ? {
            ...current,
            users: current.users.filter((row) => row.uid !== user.uid),
          }
        : current
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-7xl">
          <div>
            <div className="text-lg font-semibold">Admin Home</div>
            <div className="text-sm text-neutral-400">Users, verification, and reports</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5">
        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.7fr)_minmax(320px,0.7fr)]">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Usuarios registrados</div>
                <div className="mt-1 text-sm text-neutral-400">
                  {getRangeLabel(userRange)}
                </div>
              </div>
              <Select value={userRange} onValueChange={setUserRange}>
                <SelectTrigger className="h-11 w-[190px] rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                  <CalendarIcon className="mr-2 h-4 w-4 text-orange-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-neutral-800 bg-neutral-950 text-neutral-100">
                  {userRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="focus:bg-neutral-900 focus:text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-5 flex h-48 items-end gap-2">
              {loading ? (
                <div className="text-sm text-neutral-400">Cargando gráfico…</div>
              ) : (
                weeklyCounts.map((entry) => (
                  <div key={entry.date} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-xl bg-orange-400/90"
                      style={{ height: `${Math.max(12, (entry.count / maxWeeklyCount) * 160)}px` }}
                    />
                    <div className="text-xs font-semibold text-neutral-200">{entry.count}</div>
                    <div className="text-[10px] text-neutral-500">{entry.label || entry.date.slice(5)}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="text-lg font-semibold">Ventas marcadas por origen</div>
            <div className="mt-1 text-sm text-neutral-400">
              Comparación de artículos vendidos usando Josealo contra ventas fuera de la plataforma.
            </div>
            <div className="mt-5 space-y-4">
              <SoldSourceBar
                label="Vendido usando Josealo"
                value={soldSourceStats.soldWithJosealo}
                total={soldSourceStats.total}
                colorClass="bg-orange-400"
              />
              <SoldSourceBar
                label="Vendido fuera de Josealo"
                value={soldSourceStats.soldOutside}
                total={soldSourceStats.total}
                colorClass="bg-sky-400"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Ventas usando Josealo</div>
                <div className="mt-1 text-sm text-neutral-400">Total en pesos de ventas hechas por la app.</div>
              </div>
              <CalendarIcon className="mt-1 h-5 w-5 shrink-0 text-orange-400" />
            </div>

            <div className="mt-5">
              <Select value={salesRange} onValueChange={setSalesRange}>
                <SelectTrigger className="h-11 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent className="z-[70] border-neutral-800 bg-neutral-950 text-neutral-100">
                  {salesRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="focus:bg-neutral-900 focus:text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-950/70 p-5">
              <div className="text-3xl font-semibold text-neutral-50">
                {formatDop(appSalesSummary.totalAmount)}
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                ventas en {appSalesSummary.itemCount} {appSalesSummary.itemCount === 1 ? "item" : "items"}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold">Lista de usuarios</div>
            <SearchInput
              value={userQuery}
              onChange={(value) => {
                setUserQuery(value);
                setUsersPage(1);
              }}
              placeholder="Buscar usuarios"
            />
          </div>
          <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
            {paginatedUsers.rows.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                No hay usuarios para esta búsqueda.
              </div>
            ) : paginatedUsers.rows.map((user) => (
              <AdminUserRow
                key={user.uid}
                user={user}
                onToggleVerify={handleToggleVerify}
                onDelete={handleDeleteUser}
              />
            ))}
          </div>
          <PaginationControls
            className="mt-4"
            page={paginatedUsers.page}
            totalPages={paginatedUsers.totalPages}
            totalItems={visibleUsers.length}
            onPageChange={setUsersPage}
          />
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Cuentas desactivadas</div>
              <div className="mt-1 text-sm text-neutral-400">Cuentas pausadas por soporte que pueden reactivarse.</div>
            </div>
            <SearchInput
              value={deactivatedQuery}
              onChange={(value) => {
                setDeactivatedQuery(value);
                setDeactivatedPage(1);
              }}
              placeholder="Buscar cuentas"
            />
          </div>
          <div className="mt-4 space-y-3">
            {paginatedDeactivatedUsers.rows.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                No hay cuentas desactivadas para esta búsqueda.
              </div>
            ) : (
              paginatedDeactivatedUsers.rows.map((user) => (
                <div key={user.uid} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-100">{user.displayName}</div>
                      <div className="mt-1 truncate text-xs text-neutral-400">{user.email || user.uid}</div>
                      <div className="mt-1 truncate text-xs text-neutral-500">{user.supportDeactivationReason || "Sin razón registrada"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReactivateUser(user)}
                        className="rounded-2xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300"
                      >
                        Reactivar
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setDeactivatedMenuUserId((current) => (current === user.uid ? "" : user.uid))
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200"
                          aria-label="Opciones de cuenta desactivada"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {deactivatedMenuUserId === user.uid ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[210px] rounded-2xl border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
                            <button
                              type="button"
                              onClick={() => handlePermanentDeleteUser(user)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-300 hover:bg-neutral-900"
                            >
                              Eliminar permanente
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <PaginationControls
            className="mt-4"
            page={paginatedDeactivatedUsers.page}
            totalPages={paginatedDeactivatedUsers.totalPages}
            totalItems={deactivatedUsers.length}
            onPageChange={setDeactivatedPage}
          />
        </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-lg font-semibold">Report list</div>
            <SearchInput
              value={activeReportQuery}
              onChange={(value) => {
                setActiveReportQuery(value);
                setActiveReportsPage(1);
              }}
              placeholder="Buscar reportes"
            />
          </div>
          <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {paginatedActiveReports.rows.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                No hay reportes pendientes para esta búsqueda.
              </div>
            ) : paginatedActiveReports.rows.map((report) => {
              const isUserReport = report.reportType === "user";
              return (
                <div key={report.id} className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800 text-neutral-500">
                      {report.listingImage ? (
                        <img src={report.listingImage} alt={report.itemTitle} className="h-full w-full object-cover" />
                      ) : (
                        <ShieldAlert className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-neutral-100">{report.itemTitle}</div>
                      <div className="mt-1 truncate text-xs text-neutral-500">
                        Cuenta reportada: {report.reportedUserEmail || report.targetUserName || getReportedUserId(report) || "Sin email"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-400">
                        {report.reason} · {report.reporterName}
                      </div>
                      {report.details ? (
                        <div className="mt-3 line-clamp-2 text-sm text-neutral-500">{report.details}</div>
                      ) : null}
                    </div>
                    <Link
                      href={`/admin/reports/${report.id}`}
                      className="shrink-0 rounded-2xl border border-neutral-100 px-6 py-3 text-sm font-semibold text-neutral-100 hover:bg-neutral-100 hover:text-neutral-950"
                    >
                      Detalles
                    </Link>
                  </div>
                  <div className="mt-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 px-5 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
                        >
                          Acciones
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-56 rounded-2xl border-neutral-800 bg-neutral-950 p-2 text-neutral-100"
                      >
                        <button
                          type="button"
                          onClick={() => handleDeleteReportedUser(report)}
                          className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-orange-300 hover:bg-orange-500/10"
                        >
                          Eliminar usuario
                        </button>
                        {!isUserReport ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(report)}
                            className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-300 hover:bg-red-500/10"
                          >
                            Eliminar item
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleOmitReport(report)}
                          className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-neutral-300 hover:bg-neutral-900"
                        >
                          Omitir
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              );
            })}
          </div>
          <PaginationControls
            className="mt-4"
            page={paginatedActiveReports.page}
            totalPages={paginatedActiveReports.totalPages}
            totalItems={activeReports.length}
            onPageChange={setActiveReportsPage}
          />
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Histórico de reportes</div>
              <div className="mt-1 text-sm text-neutral-400">
                Reportes cerrados después de una acción de soporte.
              </div>
            </div>
            <SearchInput
              value={historicalReportQuery}
              onChange={(value) => {
                setHistoricalReportQuery(value);
                setHistoricalReportsPage(1);
              }}
              placeholder="Buscar histórico"
            />
          </div>
          <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {paginatedHistoricalReports.rows.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                No hay reportes en histórico para esta búsqueda.
              </div>
            ) : paginatedHistoricalReports.rows.map((report) => (
              <div key={report.id} className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800 text-neutral-500">
                    {report.listingImage ? (
                      <img src={report.listingImage} alt={report.itemTitle} className="h-full w-full object-cover" />
                    ) : (
                      <ShieldAlert className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-neutral-100">{report.itemTitle}</div>
                    <div className="mt-1 truncate text-xs text-neutral-500">
                      Cuenta reportada: {report.reportedUserEmail || report.targetUserName || getReportedUserId(report) || "Sin email"}
                    </div>
                    <div className="mt-1 text-sm text-neutral-400">
                      {report.reason} · {report.reporterName}
                    </div>
                    <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3 text-xs text-neutral-400">
                      {getHandledActionLabel(report)}
                      {report.handledReason ? ` · Razón: ${report.handledReason}` : ""}
                      {report.handledAt ? ` · ${new Date(report.handledAt).toLocaleString("es-DO")}` : ""}
                    </div>
                    {report.details ? (
                      <div className="mt-3 line-clamp-2 text-sm text-neutral-500">{report.details}</div>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/reports/${report.id}`}
                    className="shrink-0 rounded-2xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-200 hover:border-neutral-100 hover:text-white"
                  >
                    Detalles
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            className="mt-4"
            page={paginatedHistoricalReports.page}
            totalPages={paginatedHistoricalReports.totalPages}
            totalItems={historicalReports.length}
            onPageChange={setHistoricalReportsPage}
          />
        </section>
        </div>
      </main>

      {moderationAction ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">{moderationAction.title}</div>
                <div className="mt-1 text-sm text-neutral-400">
                  Selecciona la razón antes de continuar.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModerationAction(null);
                  setModerationReason("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 flex flex-col gap-2">
              <span className="text-xs text-neutral-400">Razón</span>
              <Select value={moderationReason} onValueChange={setModerationReason}>
                <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                  <SelectValue placeholder="Selecciona una razón" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
                  {moderationReasons.map((reason) => (
                    <SelectItem key={reason} value={reason} className="focus:bg-neutral-900 focus:text-white">
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModerationAction(null);
                  setModerationReason("");
                }}
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={submitModerationAction}
                disabled={!moderationReason || submittingModeration}
                className="h-12 rounded-2xl bg-orange-400 text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {submittingModeration ? "Procesando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminBottomNav active="home" />
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-neutral-800 bg-neutral-950 pl-10 pr-4 text-sm outline-none focus:border-orange-400"
      />
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPageChange,
  className = "",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 text-xs text-neutral-400 ${className}`}>
      <span>
        {totalItems} {totalItems === 1 ? "resultado" : "resultados"} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SoldSourceBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-neutral-100">{label}</span>
        <span className="shrink-0 text-neutral-400">
          {value} · {percent}%
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-neutral-950 ring-1 ring-neutral-800">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.max(total > 0 ? 4 : 0, percent)}%` }}
        />
      </div>
    </div>
  );
}
