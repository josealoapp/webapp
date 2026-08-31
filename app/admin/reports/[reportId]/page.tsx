"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileWarning, MapPin, MessageCircle, Package, ShieldAlert, Store, Timer } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import type { AdminReportDetails } from "@/lib/admin-types";
import { formatMoney } from "@/lib/money";

export default function AdminReportDetailsPage() {
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
        if (!response.ok) throw new Error("admin/report-details-failed");
        const payload = (await response.json()) as { details: AdminReportDetails };
        setDetails(payload.details);
      })
      .catch(() => setError("No pudimos cargar los detalles del reporte."))
      .finally(() => setLoading(false));
  }, [reportId]);

  const accountAgeLabel = useMemo(() => {
    const days = details?.metrics.accountAgeDays ?? 0;
    if (days < 1) return "Hoy";
    if (days === 1) return "1 día";
    if (days < 30) return `${days} días`;
    const months = Math.floor(days / 30);
    if (months === 1) return "1 mes";
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    return years === 1 ? "1 año" : `${years} años`;
  }, [details?.metrics.accountAgeDays]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-lg font-semibold">Detalles del reporte</div>
            <div className="text-sm text-neutral-400">Perfil, actividad y publicaciones del usuario reportado</div>
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
            Cargando detalles...
          </div>
        ) : details ? (
          <>
            <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-500">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-white">{details.user.displayName}</div>
                  <div className="mt-1 text-sm text-neutral-400">
                    {details.report.reason} · reportado por {details.report.reporterName}
                  </div>
                  {details.report.details ? (
                    <div className="mt-3 text-sm leading-6 text-neutral-300">{details.report.details}</div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                icon={<FileWarning />}
                label="Número de reportes"
                value={String(details.metrics.reportCount)}
                href={`/admin/reports/${reportId}/historial`}
              />
              <MetricCard icon={<MessageCircle />} label="Número de interacciones" value={String(details.metrics.interactionCount)} />
              <MetricCard icon={<Timer />} label="Antigüedad de cuenta" value={accountAgeLabel} />
              <MetricCard icon={<MapPin />} label="Ubicación de cuenta" value={details.metrics.location} />
              <MetricCard icon={<Store />} label="Categoría de ventas" value={details.metrics.salesCategory} />
            </section>

            <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Publicaciones del usuario</div>
                  <div className="mt-1 text-sm text-neutral-400">
                    {details.listings.length} publicaciones encontradas
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {details.listings.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                    Este usuario no tiene publicaciones registradas.
                  </div>
                ) : (
                  details.listings.map((item) => (
                    <Link
                      key={item.id}
                      href={`/item/${item.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 hover:border-orange-400"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-800 text-neutral-500">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="listing-title truncate text-sm font-medium text-neutral-100">{item.title}</div>
                        <div className="mt-1 text-xs text-neutral-400">
                          {item.category} · {item.location || "Sin ubicación"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="listing-price text-sm font-bold text-orange-300">{formatMoney(item.price, item.currency)}</div>
                        <div className="mt-1 text-xs capitalize text-neutral-500">{item.status}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      <AdminBottomNav active="home" />
    </div>
  );
}

function MetricCard({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-950 text-orange-300">
        {icon}
      </div>
      <div className="mt-4 text-xs text-neutral-500">{label}</div>
      <div className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block hover:opacity-90">
      {content}
    </Link>
  );
}
