"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import type { AdminReportDetails } from "@/lib/admin-types";

export default function AdminReportHistoryPage() {
  const router = useRouter();
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId || "";
  const [details, setDetails] = useState<AdminReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/auth/session`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { authenticated: boolean };
        if (!payload.authenticated) router.replace("/admin/sign-in");
      })
      .catch(() => router.replace("/admin/sign-in"));
  }, [router]);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("admin/report-history-failed");
        const payload = (await response.json()) as { details: AdminReportDetails };
        setDetails(payload.details);
      })
      .catch(() => setError("No pudimos cargar el historial de reportes."))
      .finally(() => setLoading(false));
  }, [reportId]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link
            href={`/admin/reports/${reportId}`}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-lg font-semibold">Historial de reportes</div>
            <div className="text-sm text-neutral-400">
              {details?.user.displayName || "Usuario reportado"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5">
        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
            Cargando reportes...
          </div>
        ) : details ? (
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="text-lg font-semibold">Reportes previos</div>
            <div className="mt-1 text-sm text-neutral-400">
              {details.relatedReports.length} reportes registrados para este usuario
            </div>

            <div className="mt-4 space-y-3">
              {details.relatedReports.map((report) => (
                <div key={report.id} className="rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-500">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-neutral-100">
                        {report.reportType === "user" ? "Reporte de usuario" : "Reporte de artículo"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-400">
                        {report.reason} · {report.reporterName}
                      </div>
                      {report.details ? (
                        <div className="mt-3 text-sm leading-6 text-neutral-500">{report.details}</div>
                      ) : null}
                      <div className="mt-3 text-xs text-neutral-600">
                        {report.createdAt ? new Date(report.createdAt).toLocaleString("es-DO") : "Sin fecha"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <AdminBottomNav active="home" />
    </div>
  );
}
