"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, ImageIcon, SlidersHorizontal, Wallet, X } from "lucide-react";
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
  category: string;
  image: string;
  soldAt: number;
  soldToUserName: string;
};

type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";
type CurrencyKey = "DOP" | "USD";

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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [summaryCurrency, setSummaryCurrency] = useState<CurrencyKey>("DOP");
  const [graphCurrency, setGraphCurrency] = useState<CurrencyKey>("DOP");

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
    () =>
      filteredSales
        .filter((sale) => normalizeCurrency(sale.currency) === summaryCurrency)
        .reduce((sum, sale) => sum + Number(sale.price || 0), 0),
    [filteredSales, summaryCurrency]
  );
  const summarySalesCount = useMemo(
    () => filteredSales.filter((sale) => normalizeCurrency(sale.currency) === summaryCurrency).length,
    [filteredSales, summaryCurrency]
  );
  const graphPoints = useMemo(
    () => buildGraphPoints(filteredSales.filter((sale) => normalizeCurrency(sale.currency) === graphCurrency), range),
    [filteredSales, graphCurrency, range]
  );
  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(filteredSales.map((sale) => sale.category || "Sin categoría")));
    return ["Todos", ...categories.sort((a, b) => a.localeCompare(b, "es"))];
  }, [filteredSales]);
  const activeCategory = categoryOptions.includes(selectedCategory) ? selectedCategory : "Todos";
  const visibleSales = useMemo(
    () =>
      activeCategory === "Todos"
        ? filteredSales
        : filteredSales.filter((sale) => (sale.category || "Sin categoría") === activeCategory),
    [activeCategory, filteredSales]
  );
  const recentSales = visibleSales.slice(0, 8);

  const handleCarouselTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleCarouselTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      setSelectedSlide((current) => (deltaX < 0 ? Math.min(1, current + 1) : Math.max(0, current - 1)));
    }
    setTouchStartX(null);
  };

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
        <button
          type="button"
          onClick={() => setRangeMenuOpen(true)}
          className={[
            "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm active:scale-95",
            isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-900/80 text-neutral-50",
          ].join(" ")}
          aria-label="Ajustar rango"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-[calc(var(--app-bottom-nav-height)+2rem)]">
        <section>
          <div className="overflow-hidden" onTouchStart={handleCarouselTouchStart} onTouchEnd={handleCarouselTouchEnd}>
            <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${selectedSlide * 100}%)` }}>
              <SummaryCard
                isLight={isLight}
                title="Ganancias totales"
                value={formatMoney(totalAmount, summaryCurrency)}
                subtitle={`${summarySalesCount} ${summarySalesCount === 1 ? "venta" : "ventas"} · ${getRangeLabel(range)}`}
                icon={<Wallet className="h-5 w-5" />}
                currency={summaryCurrency}
                onCurrencyChange={setSummaryCurrency}
                onClick={() => setSelectedSlide(0)}
              />
              <GraphCard
                isLight={isLight}
                points={graphPoints}
                currency={graphCurrency}
                onCurrencyChange={setGraphCurrency}
                onClick={() => setSelectedSlide(1)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
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
              <button type="button" onClick={() => setRangeMenuOpen(true)} className="text-sm font-semibold text-orange-400">
                Ver todo
              </button>
            </div>

            {categoryOptions.length > 1 ? (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {categoryOptions.map((category) => {
                  const active = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={[
                        "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
                        active
                          ? "border-orange-400 bg-orange-400 text-black"
                          : isLight
                            ? "border-slate-200 bg-white text-slate-700"
                            : "border-neutral-800 bg-neutral-950 text-neutral-300",
                      ].join(" ")}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {loading ? (
              <div className={["rounded-2xl border p-4 text-sm", isLight ? "border-slate-200 text-slate-500" : "border-neutral-800 text-neutral-400"].join(" ")}>
                Cargando ventas...
              </div>
            ) : recentSales.length === 0 ? (
              <div className={["rounded-2xl border p-4 text-sm", isLight ? "border-slate-200 text-slate-600" : "border-neutral-800 text-neutral-400"].join(" ")}>
                Aún no hay ventas en {activeCategory === "Todos" ? "este periodo" : activeCategory}.
              </div>
            ) : (
              <div className={["rounded-[24px] border px-4", isLight ? "border-slate-200" : "border-neutral-800"].join(" ")}>
                {recentSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => setSelectedSale(sale)}
                    className="flex w-full items-center gap-3 border-b border-neutral-500/15 py-4 text-left last:border-b-0"
                  >
                    <div className={["h-16 w-16 shrink-0 overflow-hidden rounded-2xl", isLight ? "bg-white" : "bg-neutral-800"].join(" ")}>
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
                      <div className={["mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", isLight ? "border-orange-200 bg-orange-50 text-orange-600" : "border-orange-400/30 bg-orange-400/10 text-orange-300"].join(" ")}>
                        {sale.category || "Sin categoría"}
                      </div>
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
      {rangeMenuOpen ? (
        <RangeMenu
          value={range}
          isLight={isLight}
          onChange={(nextRange) => {
            setRange(nextRange);
            setRangeMenuOpen(false);
          }}
          onClose={() => setRangeMenuOpen(false)}
        />
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
  currency,
  onCurrencyChange,
  onClick,
}: {
  isLight: boolean;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  currency: CurrencyKey;
  onCurrencyChange: (currency: CurrencyKey) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-[272px] min-w-full flex-col rounded-[28px] border px-4 py-5 text-left transition",
        isLight ? "border-slate-200 bg-white shadow-sm" : "border-neutral-800 bg-neutral-950 shadow-[inset_0_0_36px_rgba(255,255,255,0.03)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 px-3 pt-2">
        <MetricCardTitle isLight={isLight} icon={icon} title={title} />
        <CurrencyToggle value={currency} isLight={isLight} onChange={onCurrencyChange} />
      </div>
      <div className="mt-auto px-3">
        <div className={["text-[44px] font-bold leading-none tracking-normal", isLight ? "text-slate-950" : "text-white"].join(" ")}>{value}</div>
        <div className={["mt-3 text-sm", isLight ? "text-slate-500" : "text-neutral-400"].join(" ")}>{subtitle}</div>
      </div>
    </button>
  );
}

function CurrencyToggle({
  value,
  isLight,
  onChange,
}: {
  value: CurrencyKey;
  isLight: boolean;
  onChange: (currency: CurrencyKey) => void;
}) {
  return (
    <div
      className={[
        "grid h-9 shrink-0 grid-cols-2 rounded-full border p-1",
        isLight ? "border-slate-200 bg-slate-100" : "border-neutral-800 bg-neutral-900",
      ].join(" ")}
    >
      {(["DOP", "USD"] as CurrencyKey[]).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(option);
            }}
            className={[
              "min-w-12 rounded-full px-2 text-xs font-bold transition",
              active
                ? "bg-orange-400 text-black"
                : isLight
                  ? "text-slate-500"
                  : "text-neutral-400",
            ].join(" ")}
          >
            {option === "DOP" ? "RD$" : "USD"}
          </button>
        );
      })}
    </div>
  );
}

function GraphCard({
  isLight,
  points,
  currency,
  onCurrencyChange,
  onClick,
}: {
  isLight: boolean;
  points: Array<{ label: string; value: number }>;
  currency: CurrencyKey;
  onCurrencyChange: (currency: CurrencyKey) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-full rounded-[28px] border px-2 py-5 text-left transition",
        isLight ? "border-slate-200 bg-white shadow-sm" : "border-neutral-800 bg-neutral-950 shadow-[inset_0_0_36px_rgba(255,255,255,0.03)]",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-3 px-3 pt-2">
        <MetricCardTitle isLight={isLight} icon={<BarChart3 className="h-5 w-5" />} title="Gráfica de ventas" />
        <CurrencyToggle value={currency} isLight={isLight} onChange={onCurrencyChange} />
      </div>
      <SalesChart points={points} isLight={isLight} />
    </button>
  );
}

function MetricCardTitle({ isLight, icon, title }: { isLight: boolean; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
          isLight ? "bg-orange-50 text-orange-500" : "bg-neutral-800 text-orange-400",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className={["text-sm font-medium", isLight ? "text-slate-600" : "text-neutral-300"].join(" ")}>
        {title}
      </div>
    </div>
  );
}

function SalesChart({ points, isLight }: { points: Array<{ label: string; value: number }>; isLight: boolean }) {
  const chartWidth = 160;
  const plotLeft = 20;
  const plotRight = 154;
  const plotTop = 14;
  const plotBottom = 72;
  const rawMaxValue = Math.max(0, ...points.map((point) => point.value));
  const { maxValue, ticks } = buildChartScale(rawMaxValue);
  const chartPoints = points.map((point, index) => {
    const x = plotLeft + (index * (plotRight - plotLeft)) / Math.max(1, points.length - 1);
    const y = plotBottom - (point.value / maxValue) * (plotBottom - plotTop);
    return { ...point, x, y };
  });
  const path = buildSmoothPath(chartPoints);
  const activePoint =
    chartPoints.findLast?.((point) => point.value > 0) ||
    chartPoints[chartPoints.length - 1] ||
    { x: 50, y: 40, label: "", value: 0 };

  return (
    <div className="h-52 w-full px-0">
      <svg viewBox={`0 0 ${chartWidth} 86`} className="h-full w-full" role="img" aria-label="Ventas por periodo">
        <rect x={Math.max(plotLeft, Math.min(plotRight - 18, activePoint.x - 9))} y={plotTop} width="18" height={plotBottom - plotTop} rx="2" fill="#ff8500" opacity={isLight ? "0.12" : "0.18"} />
        {ticks.map((tick) => {
          const y = plotBottom - (tick / maxValue) * (plotBottom - plotTop);
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={y}
                y2={y}
                stroke={isLight ? "#e2e8f0" : "#262626"}
                strokeDasharray="2 2"
              />
              <text x={plotLeft - 3} y={y + 1.7} textAnchor="end" fontSize="4.2" fill={isLight ? "#64748b" : "#a3a3a3"}>
                {formatAxisMoney(tick)}
              </text>
            </g>
          );
        })}
        {chartPoints.map((point) => (
          <line key={`grid-${point.label}`} x1={point.x} x2={point.x} y1={plotTop} y2={plotBottom} stroke={isLight ? "#e2e8f0" : "#262626"} strokeDasharray="2 2" />
        ))}
        <path d={path} fill="none" stroke="#ff8500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <g>
          <rect x={Math.min(chartWidth - 50, Math.max(8, activePoint.x - 25))} y="8" width="50" height="10" rx="2.5" fill={isLight ? "#ffffff" : "#171717"} stroke={isLight ? "#e2e8f0" : "#2a2a2a"} />
          <text x={Math.min(chartWidth - 25, Math.max(33, activePoint.x))} y="14.8" textAnchor="middle" fontSize="4.2" fill={isLight ? "#475569" : "#a3a3a3"}>
            <tspan fill="#ff8500" fontWeight="700">{formatCompactMoney(activePoint.value)}</tspan>
            <tspan>{`: ${activePoint.label}`}</tspan>
          </text>
        </g>
        {chartPoints.map((point) => (
          <g key={point.label}>
            <text x={point.x} y="82" textAnchor="middle" fontSize="5" fill={isLight ? "#64748b" : "#a3a3a3"}>
              {point.label}
            </text>
          </g>
        ))}
        <circle cx={activePoint.x} cy={activePoint.y} r="3" fill="#ffffff" stroke="#ff8500" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function buildChartScale(maxValue: number) {
  const step = getChartStep(maxValue);
  const axisMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const tickCount = Math.min(5, Math.max(1, Math.floor(axisMax / step)));
  const ticks = Array.from({ length: tickCount }, (_, index) => axisMax - index * step).filter((tick) => tick > 0);

  return {
    maxValue: axisMax,
    ticks,
  };
}

function getChartStep(maxValue: number) {
  if (maxValue <= 50_000) return 10_000;
  if (maxValue <= 250_000) return 50_000;
  if (maxValue <= 1_000_000) return 100_000;
  if (maxValue <= 5_000_000) return 500_000;

  const exponent = Math.floor(Math.log10(maxValue));
  const magnitude = 10 ** exponent;
  const normalized = maxValue / magnitude;

  if (normalized <= 2) return magnitude / 5;
  if (normalized <= 5) return magnitude;
  return magnitude * 2;
}

function RangeMenu({
  value,
  isLight,
  onChange,
  onClose,
}: {
  value: RangeKey;
  isLight: boolean;
  onChange: (range: RangeKey) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end bg-black/60 px-4 pb-4">
      <div
        className={[
          "mx-auto w-full max-w-md rounded-[28px] border p-5 shadow-2xl",
          isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-950 text-white",
        ].join(" ")}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold">Ajustar periodo</div>
          <button
            type="button"
            onClick={onClose}
            className={[
              "flex h-10 w-10 items-center justify-center rounded-full border",
              isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-900 text-white",
            ].join(" ")}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "flex h-12 items-center justify-between rounded-2xl border px-4 text-sm font-semibold",
                value === option.value
                  ? "border-orange-400 bg-orange-400 text-black"
                  : isLight
                    ? "border-slate-200 bg-transparent text-slate-950"
                    : "border-neutral-800 bg-neutral-900/40 text-neutral-100",
              ].join(" ")}
            >
              {option.label}
              {value === option.value ? <span className="h-2 w-2 rounded-full bg-black" /> : null}
            </button>
          ))}
        </div>
      </div>
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
            <div className={["mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", isLight ? "border-orange-200 bg-orange-50 text-orange-600" : "border-orange-400/30 bg-orange-400/10 text-orange-300"].join(" ")}>
              {sale.category || "Sin categoría"}
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

function getRangeLabel(range: RangeKey) {
  return rangeOptions.find((option) => option.value === range)?.label || "Periodo";
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
  const prefix = normalizeCurrency(currency) === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString("es-DO")}`;
}

function normalizeCurrency(currency?: string): CurrencyKey {
  return currency === "USD" ? "USD" : "DOP";
}

function formatCompactMoney(value: number) {
  return Number(value || 0).toLocaleString("es-DO", { maximumFractionDigits: 0 });
}

function formatAxisMoney(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return String(value);
}

function formatDate(value: number) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
