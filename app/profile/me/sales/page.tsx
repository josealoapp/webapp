"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, ChevronDown, ImageIcon, ReceiptText, Wallet, X } from "lucide-react";
import AppBottomNav from "@/components/AppBottomNav";
import { useThemeSetting } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { onAuthStateChanged } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination } from "@/lib/account-profile";

type Sale = {
  id: string;
  listingId: string;
  bazarItemId: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  soldAt: number;
  soldToUserName: string;
};

type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";

const rangeOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "1m", label: "Último mes" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 año" },
  { value: "all", label: "Todo" },
];

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function ProfileSalesPage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const isLight = theme === "light";
  const [authResolved, setAuthResolved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("6m");
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        if (user.emailVerified) {
          const destination = getPostAuthDestination("/profile/me/sales");
          if (destination !== "/profile/me/sales") {
            router.replace(destination);
            return;
          }
        }
        setCurrentUserId(user.uid);
        setAuthResolved(true);
        return;
      }

      setCurrentUserId("");
      setAuthResolved(true);
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (authResolved && !currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent("/profile/me/sales")}`);
    }
  }, [authResolved, currentUserId, router]);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;
    setLoading(true);
    auth.currentUser
      ?.getIdToken()
      .then((token) =>
        fetch("/api/profile/sales/details", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { sales?: Sale[] } | null;
        if (!cancelled) setSales(Array.isArray(payload?.sales) ? payload.sales : []);
      })
      .catch(() => {
        if (!cancelled) setSales([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const filteredSales = useMemo(() => {
    const startAt = getRangeStart(range);
    return sales
      .filter((sale) => !startAt || sale.soldAt >= startAt)
      .sort((a, b) => b.soldAt - a.soldAt);
  }, [range, sales]);

  const totalAmount = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + Number(sale.price || 0), 0),
    [filteredSales]
  );
  const graphPoints = useMemo(() => buildGraphPoints(filteredSales, range), [filteredSales, range]);
  const recentSales = filteredSales.slice(0, 8);

  if (!authResolved || !currentUserId) {
    return <div className={isLight ? "min-h-screen bg-neutral-100" : "min-h-screen bg-neutral-950"} />;
  }

  return (
    <div className={["min-h-screen", isLight ? "bg-neutral-100 text-slate-950" : "bg-neutral-950 text-neutral-50"].join(" ")}>
      <header className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
        <button
          onClick={() => router.back()}
          className={[
            "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm active:scale-95",
            isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-900/80 text-neutral-50",
          ].join(" ")}
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className={["text-base font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Ventas</div>
        <div className="h-11 w-11" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-[calc(var(--app-bottom-nav-height)+2rem)]">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={[
                "h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition",
                range === option.value
                  ? "border-orange-400 bg-orange-400 text-black"
                  : isLight
                    ? "border-slate-200 bg-transparent text-slate-700 hover:border-orange-400/70"
                    : "border-neutral-800 bg-neutral-900/50 text-neutral-300 hover:border-orange-400/70",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
            <SummaryCard
              isLight={isLight}
              title="Ventas calculadas"
              value={formatMoney(totalAmount)}
              subtitle={`${filteredSales.length} ${filteredSales.length === 1 ? "venta" : "ventas"} en el periodo`}
              icon={<Wallet className="h-5 w-5" />}
              active={selectedSlide === 0}
              onClick={() => setSelectedSlide(0)}
            />
            <GraphCard
              isLight={isLight}
              points={graphPoints}
              active={selectedSlide === 1}
              onClick={() => setSelectedSlide(1)}
            />
          </div>
          <div className="flex justify-center gap-2">
            {[0, 1].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedSlide(index)}
                className={["h-2 rounded-full transition", selectedSlide === index ? "w-8 bg-orange-400" : "w-2 bg-neutral-500/40"].join(" ")}
                aria-label={`Ver tarjeta ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <Card
          className={[
            "gap-0 rounded-[28px] border py-0 shadow-none",
            isLight ? "border-slate-200 bg-transparent text-slate-950" : "border-neutral-800 bg-neutral-900/30 text-neutral-50",
          ].join(" ")}
        >
          <CardContent className="px-4 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className={["text-lg font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Ventas recientes</div>
              <ReceiptText className={["h-5 w-5", isLight ? "text-slate-500" : "text-neutral-400"].join(" ")} />
            </div>

            {loading ? (
              <div className={["rounded-2xl border p-4 text-sm", isLight ? "border-slate-200 text-slate-500" : "border-neutral-800 text-neutral-400"].join(" ")}>
                Cargando ventas...
              </div>
            ) : recentSales.length === 0 ? (
              <div className={["rounded-2xl border p-4 text-sm", isLight ? "border-slate-200 text-slate-600" : "border-neutral-800 text-neutral-400"].join(" ")}>
                Aún no hay ventas en este periodo.
              </div>
            ) : (
              <div className="divide-y divide-neutral-500/15">
                {recentSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => setSelectedSale(sale)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <div className={["h-14 w-14 shrink-0 overflow-hidden rounded-2xl", isLight ? "bg-white" : "bg-neutral-800"].join(" ")}>
                      {sale.image ? (
                        <img src={sale.image} alt={sale.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className={["h-5 w-5", isLight ? "text-slate-400" : "text-neutral-500"].join(" ")} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={["truncate text-sm font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>{sale.title}</div>
                      <div className={["mt-1 text-xs", isLight ? "text-slate-500" : "text-neutral-400"].join(" ")}>{formatDate(sale.soldAt)}</div>
                    </div>
                    <div className={["text-sm font-bold", isLight ? "text-slate-950" : "text-white"].join(" ")}>{formatMoney(sale.price, sale.currency)}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AppBottomNav active="profile" reserveSpace={false} />

      {selectedSale ? (
        <SaleDetailsModal sale={selectedSale} isLight={isLight} onClose={() => setSelectedSale(null)} />
      ) : null}
    </div>
  );
}

function SummaryCard({
  isLight,
  title,
  value,
  subtitle,
  icon,
  active,
  onClick,
}: {
  isLight: boolean;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-full snap-center rounded-[28px] border p-5 text-left transition",
        isLight ? "border-slate-200 bg-white shadow-sm" : "border-neutral-800 bg-neutral-900/30",
        active ? "ring-2 ring-orange-400/40" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className={["flex h-12 w-12 items-center justify-center rounded-2xl", isLight ? "bg-orange-50 text-orange-500" : "bg-neutral-800 text-orange-400"].join(" ")}>
          {icon}
        </div>
        <div className={["text-sm", isLight ? "text-slate-600" : "text-neutral-300"].join(" ")}>{title}</div>
      </div>
      <div className={["mt-8 text-4xl font-bold tracking-normal", isLight ? "text-slate-950" : "text-white"].join(" ")}>{value}</div>
      <div className={["mt-3 text-sm", isLight ? "text-slate-500" : "text-neutral-400"].join(" ")}>{subtitle}</div>
    </button>
  );
}

function GraphCard({
  isLight,
  points,
  active,
  onClick,
}: {
  isLight: boolean;
  points: Array<{ label: string; value: number }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-full snap-center rounded-[28px] border p-5 text-left transition",
        isLight ? "border-slate-200 bg-white shadow-sm" : "border-neutral-800 bg-neutral-900/30",
        active ? "ring-2 ring-orange-400/40" : "",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={["flex items-center gap-2 text-sm font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>
          <BarChart3 className="h-4 w-4 text-orange-400" />
          Gráfica de ventas
        </div>
        <ChevronDown className={["h-4 w-4", isLight ? "text-slate-400" : "text-neutral-500"].join(" ")} />
      </div>
      <SalesChart points={points} isLight={isLight} />
    </button>
  );
}

function SalesChart({ points, isLight }: { points: Array<{ label: string; value: number }>; isLight: boolean }) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const chartPoints = points.map((point, index) => {
    const x = 8 + (index * 84) / Math.max(1, points.length - 1);
    const y = 72 - (point.value / maxValue) * 48;
    return { ...point, x, y };
  });
  const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="h-48">
      <svg viewBox="0 0 100 86" className="h-full w-full" role="img" aria-label="Ventas por periodo">
        {chartPoints.map((point) => (
          <line key={`grid-${point.label}`} x1={point.x} x2={point.x} y1="12" y2="72" stroke={isLight ? "#e2e8f0" : "#262626"} strokeDasharray="2 2" />
        ))}
        <path d={path} fill="none" stroke="#ff8500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {chartPoints.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="2.2" fill="#ff8500" stroke={isLight ? "#ffffff" : "#050505"} strokeWidth="1" />
            <text x={point.x} y="82" textAnchor="middle" fontSize="5" fill={isLight ? "#64748b" : "#a3a3a3"}>
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SaleDetailsModal({ sale, isLight, onClose }: { sale: Sale; isLight: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end bg-black/70 px-4 pb-4 pt-20">
      <div
        className={[
          "mx-auto w-full max-w-md rounded-[28px] border p-5 shadow-2xl",
          isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-950 text-white",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={["text-xs font-semibold uppercase", isLight ? "text-slate-500" : "text-neutral-400"].join(" ")}>Venta</div>
            <div className="mt-2 text-4xl font-bold">{formatMoney(sale.price, sale.currency)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full border",
              isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-900 text-white",
            ].join(" ")}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex gap-4">
          <div className={["h-20 w-20 shrink-0 overflow-hidden rounded-2xl", isLight ? "bg-neutral-100" : "bg-neutral-900"].join(" ")}>
            {sale.image ? (
              <img src={sale.image} alt={sale.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className={["h-6 w-6", isLight ? "text-slate-400" : "text-neutral-500"].join(" ")} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{sale.title}</div>
            <div className={["mt-2 flex items-center gap-2 text-sm", isLight ? "text-slate-600" : "text-neutral-400"].join(" ")}>
              <CalendarDays className="h-4 w-4" />
              {formatDate(sale.soldAt)}
            </div>
            <div className={["mt-2 text-sm", isLight ? "text-slate-600" : "text-neutral-400"].join(" ")}>
              Vendido a: <span className={isLight ? "font-semibold text-slate-950" : "font-semibold text-white"}>{sale.soldToUserName}</span>
            </div>
          </div>
        </div>

        <Button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-2xl bg-orange-400 font-semibold text-black hover:bg-orange-300">
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function getRangeStart(range: RangeKey) {
  if (range === "all") return 0;
  const months = range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function buildGraphPoints(sales: Sale[], range: RangeKey) {
  if (range === "all") {
    const years = new Map<number, number>();
    const currentYear = new Date().getFullYear();
    sales.forEach((sale) => {
      const year = new Date(sale.soldAt).getFullYear();
      years.set(year, (years.get(year) || 0) + sale.price);
    });
    const labels = Array.from(years.keys()).sort((a, b) => a - b);
    const visibleYears = labels.length ? labels : [currentYear];
    return visibleYears.map((year) => ({ label: String(year), value: years.get(year) || 0 }));
  }

  const months = range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const points = Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - index));
    return { year: date.getFullYear(), month: date.getMonth(), label: MONTHS[date.getMonth()], value: 0 };
  });

  sales.forEach((sale) => {
    const date = new Date(sale.soldAt);
    const point = points.find((item) => item.year === date.getFullYear() && item.month === date.getMonth());
    if (point) point.value += sale.price;
  });

  return points.map(({ label, value }) => ({ label, value }));
}

function formatMoney(value: number, currency = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString("es-DO")}`;
}

function formatDate(value: number) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
