"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Info, Plus, X } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { AdminMarketplaceStats, AdminSoldItem, AdminStatsLocation } from "@/lib/admin-stats";
import { appCategories, getCategoryInputKind } from "@/lib/categories";

const COLORS = ["#fb923c", "#22c55e", "#38bdf8", "#facc15", "#f472b6", "#a78bfa", "#f87171", "#2dd4bf"];
const MAP_BOUNDS = {
  minLat: 17.45,
  maxLat: 20.15,
  minLon: -72.05,
  maxLon: -68.25,
};

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const ALL_CATEGORIES_VALUE = "__all_categories__";
const EMPTY_AREA_VALUE = "__empty_area__";
type FilterType = "category" | "article";
type ItemView = "active" | "sold";
type CalculatorItem = {
  id: string;
  category: string;
  name: string;
  quantity: number;
  condition: string;
  year: string;
  brand: string;
  model: string;
  size: string;
};
type CalculatorEstimate = {
  id: string;
  title: string;
  category: string;
  quantity: number;
  dpv: number | null;
  buyerInterest: number;
  sampleUsers: number;
  estimatedDays: number | null;
  suggestedPrice: string;
  recommended: boolean;
};

const DOMINICAN_PROVINCES = [
  "Santo Domingo",
  "Distrito Nacional",
  "Santiago",
  "San Cristóbal",
  "La Vega",
  "La Altagracia",
  "San Pedro de Macorís",
  "Puerto Plata",
  "Duarte",
  "Espaillat",
  "Peravia",
  "Azua",
  "Barahona",
  "Samaná",
  "Monte Cristi",
  "Valverde",
  "Hermanas Mirabal",
  "María Trinidad Sánchez",
  "Monseñor Nouel",
  "San Juan",
  "Sánchez Ramírez",
  "Monte Plata",
  "Hato Mayor",
  "El Seibo",
  "La Romana",
  "San José de Ocoa",
  "Bahoruco",
  "Independencia",
  "Pedernales",
  "Dajabón",
  "Elías Piña",
  "Santiago Rodríguez",
];

const CONDITION_OPTIONS = ["Nuevo", "Como nuevo", "Bueno", "Usado", "Para reparar"];

function createCalculatorItem(index: number): CalculatorItem {
  return {
    id: `${Date.now()}-${index}`,
    category: "",
    name: "",
    quantity: 1,
    condition: "Bueno",
    year: "",
    brand: "",
    model: "",
    size: "",
  };
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  removeLayer: (layer: LeafletLayer) => LeafletMap;
  remove: () => void;
};

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindTooltip?: (content: string, options?: Record<string, unknown>) => LeafletLayer;
  on?: (eventName: string, handler: () => void) => LeafletLayer;
};

type LeafletNamespace = {
  map: (
    element: HTMLElement,
    options?: { zoomControl?: boolean; attributionControl?: boolean }
  ) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  circleMarker: (
    latlng: [number, number],
    options?: Record<string, unknown>
  ) => LeafletLayer;
  circle: (latlng: [number, number], options?: Record<string, unknown>) => LeafletLayer;
  control: {
    zoom: (options?: Record<string, unknown>) => LeafletLayer;
  };
};

declare global {
  interface Window {
    L?: LeafletNamespace;
    josealoLeafletPromise?: Promise<void>;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function projectPoint(latitude: number, longitude: number) {
  const x = ((longitude - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * 100;
  const y = 100 - ((latitude - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return {
    x: Math.min(95, Math.max(5, x)),
    y: Math.min(92, Math.max(8, y)),
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const startLat = toRadians(a.latitude);
  const endLat = toRadians(b.latitude);
  const inner =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
}

function getTopGroups(items: AdminSoldItem[], groupBy: "category" | "brand" | "model") {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const name = groupBy === "brand" ? item.brand : groupBy === "model" ? item.model : item.category;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, COLORS.length)
    .map(([name, count], index) => ({ name, count, color: COLORS[index] }));
}

function getDotColor(location: AdminStatsLocation, legend: ReturnType<typeof getTopGroups>) {
  const name = location.topCategory;
  return legend.find((entry) => entry.name === name)?.color || "#94a3b8";
}

function calculateDpv(items: AdminSoldItem[]) {
  const values = items
    .filter((item) => item.status === "sold")
    .map((item) => item.daysToSell)
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function priceRange(items: AdminSoldItem[]) {
  if (!items.length) return "Sin ventas";
  const prices = items.map((item) => item.price);
  return `${formatCurrency(Math.min(...prices))} - ${formatCurrency(Math.max(...prices))}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getCalculatorMatches(item: CalculatorItem, location: string, soldItems: AdminSoldItem[]) {
  const category = normalizeText(item.category);
  const nameTokens = normalizeText(`${item.name} ${item.brand} ${item.model}`)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  const locationName = normalizeText(location);

  return soldItems.filter((soldItem) => {
    const soldText = normalizeText(`${soldItem.title} ${soldItem.brand} ${soldItem.model}`);
    const sameLocation = normalizeText(soldItem.location) === locationName;
    const sameCategory = category ? normalizeText(soldItem.category) === category : true;
    const titleMatch = nameTokens.length === 0 || nameTokens.some((token) => soldText.includes(token));

    return sameLocation && sameCategory && titleMatch;
  });
}

function buildCalculatorEstimates(items: CalculatorItem[], location: string, soldItems: AdminSoldItem[]) {
  const candidates = items
    .filter((item) => item.category || item.name.trim())
    .map((item) => {
      const matches = getCalculatorMatches(item, location, soldItems);
      const fallbackMatches = matches.length
        ? matches
        : soldItems.filter((soldItem) => normalizeText(soldItem.category) === normalizeText(item.category));
      const days = fallbackMatches.map((row) => row.daysToSell).filter((value): value is number => value !== null);
      const prices = fallbackMatches.map((row) => row.price).filter((value) => Number.isFinite(value) && value > 0);
      const dpv = days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : null;
      const quantity = Math.max(1, item.quantity || 1);
      const sampleUsers = fallbackMatches.reduce(
        (sum, row) =>
          sum +
          Math.max(
            row.views || 0,
            row.interactions || 0,
            row.interactionUsers.length || 0,
            row.searchCount || 0,
            row.searchUsers?.length || 0
          ),
        0
      );
      const buyerInterest = fallbackMatches.reduce(
        (sum, row) => sum + (row.views || 0) + (row.searchCount || 0) * 3 + row.interactions * 5,
        0
      );

      return {
        id: item.id,
        title: item.name.trim() || item.category || "Artículo",
        category: item.category || "Sin categoría",
        quantity,
        dpv,
        buyerInterest,
        sampleUsers,
        estimatedDays: dpv ? dpv * quantity : null,
        suggestedPrice: prices.length ? priceRange(fallbackMatches) : "Sin ventas comparables",
        recommended: false,
      };
    });

  const best = candidates
    .filter((estimate) => estimate.dpv !== null)
    .sort((a, b) => {
      const reliability = b.sampleUsers - a.sampleUsers;
      if (Math.abs(reliability) > 4) return reliability;
      return (a.estimatedDays || 9999) - (b.estimatedDays || 9999) || b.buyerInterest - a.buyerInterest;
    })[0];

  return candidates.map((estimate) => ({ ...estimate, recommended: estimate.id === best?.id }));
}

function buildMapLocations(items: AdminSoldItem[], baseLocations: AdminStatsLocation[]) {
  const baseLocationMap = new Map(baseLocations.map((location) => [location.name, location]));
  const grouped = items.reduce((map, item) => {
    map.set(item.location, [...(map.get(item.location) || []), item]);
    return map;
  }, new Map<string, AdminSoldItem[]>());

  return Array.from(grouped.entries())
    .map(([name, rows]) => {
      const base = baseLocationMap.get(name);
      const prices = rows.map((item) => item.price);
      const days = rows.map((item) => item.daysToSell).filter((value): value is number => value !== null);

      return {
        name,
        latitude: base?.latitude ?? rows[0]?.latitude ?? 0,
        longitude: base?.longitude ?? rows[0]?.longitude ?? 0,
        soldCount: rows.length,
        topCategory: getTopGroups(rows, "category")[0]?.name || "Sin datos",
        topBrand: getTopGroups(rows, "brand")[0]?.name || "Sin datos",
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        avgDaysToSell: days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : null,
        items: rows,
      };
    })
    .sort((a, b) => b.soldCount - a.soldCount) as AdminStatsLocation[];
}

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("leaflet/no-window"));
  if (window.L) return Promise.resolve();
  if (window.josealoLeafletPromise) return window.josealoLeafletPromise;

  window.josealoLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("leaflet/load-failed"));
    document.head.appendChild(script);
  });

  return window.josealoLeafletPromise;
}

export default function AdminStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminMarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("category");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [articleDraft, setArticleDraft] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [itemView, setItemView] = useState<ItemView>("sold");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [calculatorLocation, setCalculatorLocation] = useState("Santo Domingo");
  const [calculatorItems, setCalculatorItems] = useState<CalculatorItem[]>(() => [createCalculatorItem(1)]);
  const [calculatorEstimates, setCalculatorEstimates] = useState<CalculatorEstimate[]>([]);

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
    let cancelled = false;

    const loadStats = (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      fetch("/api/admin/stats", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("admin/stats-failed");
          const payload = (await response.json()) as AdminMarketplaceStats;
          if (cancelled) return;
          setStats(payload);
          setSelectedLocation((current) => current || payload.locations[0]?.name || "");
          setCalculatorLocation((current) => current || payload.locations[0]?.name || "Santo Domingo");
          setError("");
        })
        .catch(() => {
          if (!cancelled) setError("No pudimos cargar las estadísticas del marketplace.");
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoading(false);
        });
    };

    loadStats(true);
    const intervalId = window.setInterval(() => loadStats(false), 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const sourceItems = [...(stats?.items || []), ...(stats?.activeItems || [])];
    const soldCategories = new Set(sourceItems.map((item) => item.category).filter(Boolean));
    const allCategories = [...appCategories.map((category) => category.name), ...Array.from(soldCategories)]
      .filter((category, index, rows) => rows.indexOf(category) === index)
      .sort((a, b) => a.localeCompare(b, "es"));

    return allCategories;
  }, [stats?.activeItems, stats?.items]);

  const applyItemFilters = useMemo(
    () => (items: AdminSoldItem[]) => {
      const selectedCategorySet = new Set(selectedCategories);
      const normalizedArticles = selectedArticles.map((article) => article.trim().toLowerCase()).filter(Boolean);

      return items.filter((item) => {
      const matchesCategory = selectedCategories.length === 0 || selectedCategorySet.has(item.category);
      const title = item.title.toLowerCase();
      const matchesArticle =
        normalizedArticles.length === 0 || normalizedArticles.some((article) => title.includes(article));

        return matchesCategory && matchesArticle;
      });
    },
    [selectedArticles, selectedCategories]
  );

  const sourceItems = itemView === "active" ? stats?.activeItems || [] : stats?.items || [];
  const filteredItems = useMemo(() => applyItemFilters(sourceItems), [applyItemFilters, sourceItems]);
  const filteredSoldItems = useMemo(() => applyItemFilters(stats?.items || []), [applyItemFilters, stats?.items]);

  const mapLocations = useMemo(
    () => buildMapLocations(filteredItems, stats?.locations || []),
    [filteredItems, stats?.locations]
  );

  useEffect(() => {
    if (!mapLocations.length) return;
    if (!selectedLocation || !mapLocations.some((location) => location.name === selectedLocation)) {
      setSelectedLocation(mapLocations[0].name);
    }
  }, [mapLocations, selectedLocation]);

  const selectedCenter = useMemo(
    () => mapLocations.find((location) => location.name === selectedLocation) || mapLocations[0] || stats?.locations[0] || null,
    [mapLocations, selectedLocation, stats?.locations]
  );

  const radiusItems = useMemo(() => {
    if (!selectedCenter) return [];
    return filteredItems.filter((item) => distanceKm(selectedCenter, item) <= radiusKm);
  }, [filteredItems, radiusKm, selectedCenter]);

  const radiusSoldItems = useMemo(() => {
    if (!selectedCenter) return [];
    return filteredSoldItems.filter((item) => distanceKm(selectedCenter, item) <= radiusKm);
  }, [filteredSoldItems, radiusKm, selectedCenter]);

  const visibleItems = radiusItems;
  const selectedItem = visibleItems.find((item) => item.id === selectedItemId) || null;
  const legend = useMemo(() => getTopGroups(visibleItems, "category"), [visibleItems]);
  const totalInView = visibleItems.length;
  const dpvInView = calculateDpv(radiusSoldItems);
  const availableCategoryOptions = categoryOptions.filter((category) => !selectedCategories.includes(category));
  const canAddFilter = filterType === "category" ? Boolean(categoryDraft) : Boolean(articleDraft.trim());
  const calculatorLocationOptions = useMemo(() => {
    return Array.from(
      new Set([
        calculatorLocation,
        selectedLocation,
        ...(stats?.locations || []).map((location) => location.name),
        ...DOMINICAN_PROVINCES,
      ].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [calculatorLocation, selectedLocation, stats?.locations]);

  useEffect(() => {
    if (!selectedItemId) return;
    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId("");
    }
  }, [selectedItemId, visibleItems]);

  const handleAddFilter = () => {
    if (filterType === "category") {
      if (!categoryDraft || selectedCategories.includes(categoryDraft)) return;
      setSelectedCategories((current) => [...current, categoryDraft]);
      setCategoryDraft("");
      return;
    }

    const normalizedArticle = articleDraft.trim();
    if (!normalizedArticle) return;
    const alreadySelected = selectedArticles.some((article) => article.toLowerCase() === normalizedArticle.toLowerCase());
    if (alreadySelected) return;
    setSelectedArticles((current) => [...current, normalizedArticle]);
    setArticleDraft("");
  };

  const handleRemoveCategory = (category: string) => {
    setSelectedCategories((current) => current.filter((entry) => entry !== category));
  };

  const handleRemoveArticle = (article: string) => {
    setSelectedArticles((current) => current.filter((entry) => entry !== article));
  };

  const updateCalculatorItem = <Key extends keyof CalculatorItem>(
    id: string,
    key: Key,
    value: CalculatorItem[Key]
  ) => {
    setCalculatorItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [key]: value };
        if (key === "category") {
          next.year = "";
          next.brand = "";
          next.model = "";
          next.size = "";
        }
        return next;
      })
    );
    setCalculatorEstimates([]);
  };

  const handleAddCalculatorItem = () => {
    setCalculatorItems((current) => [...current, createCalculatorItem(current.length + 1)]);
    setCalculatorEstimates([]);
  };

  const handleClearCalculator = () => {
    setCalculatorItems([createCalculatorItem(1)]);
    setCalculatorEstimates([]);
  };

  const handleEstimateInvestment = () => {
    setCalculatorEstimates(buildCalculatorEstimates(calculatorItems, calculatorLocation, stats?.items || []));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-orange-400" />
            <div>
              <div className="text-lg font-semibold leading-tight">Marketplace Stats</div>
              <div className="mt-1 text-sm text-neutral-400">Ventas por zona, categoría, marca y velocidad.</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500">Vendidos</div>
            <div className="font-mono text-xl font-semibold text-neutral-100">{loading ? "..." : stats?.totalSold || 0}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-40 pt-9">
        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/30">
          <div className="border-b border-neutral-800 p-4">
            <div className="grid gap-4 xl:grid-cols-[220px_minmax(360px,1.2fr)_minmax(260px,0.9fr)_280px] xl:items-end">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-500">Tipo</Label>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
                  <SelectTrigger className="h-14 rounded-2xl border-neutral-800 bg-neutral-950 px-5 text-base text-neutral-100 shadow-none focus:ring-orange-400/20 focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                    <SelectItem value="category" className="focus:bg-neutral-900 focus:text-neutral-100">
                      Categoría
                    </SelectItem>
                    <SelectItem value="article" className="focus:bg-neutral-900 focus:text-neutral-100">
                      Artículo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-500">
                  {filterType === "category" ? "Categoría" : "Artículo"}
                </Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_145px]">
                  {filterType === "category" ? (
                    <Select
                      value={categoryDraft || ALL_CATEGORIES_VALUE}
                      onValueChange={(value) => setCategoryDraft(value === ALL_CATEGORIES_VALUE ? "" : value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl border-orange-500 bg-neutral-950 px-5 text-base text-neutral-100 shadow-none focus:ring-orange-400/20 focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
                        <SelectItem value={ALL_CATEGORIES_VALUE} className="focus:bg-neutral-900 focus:text-neutral-100">
                          Todas
                        </SelectItem>
                        {availableCategoryOptions.map((category) => (
                          <SelectItem key={category} value={category} className="focus:bg-neutral-900 focus:text-neutral-100">
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={articleDraft}
                      onChange={(event) => setArticleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddFilter();
                        }
                      }}
                      placeholder="Nombre del artículo"
                      className="h-14 rounded-2xl border-orange-500 bg-neutral-950 px-5 text-base text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
                    />
                  )}
                  <Button
                    type="button"
                    onClick={handleAddFilter}
                    disabled={!canAddFilter}
                    className="h-14 rounded-2xl bg-orange-400 px-5 text-sm font-semibold text-black shadow-none hover:bg-orange-300 disabled:border disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100"
                    aria-label="Agregar filtro"
                  >
                    <span>Agregar</span>
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-500">Radio de análisis · {radiusKm} km</Label>
                <div className="flex h-14 items-center rounded-2xl border border-neutral-800 bg-neutral-950 px-4">
                  <Slider
                    min={1}
                    max={240}
                    step={1}
                    value={[radiusKm]}
                    onValueChange={(value) => setRadiusKm(value[0] || 1)}
                    className="[&_[data-slot=slider-range]]:bg-orange-400 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-orange-400 [&_[data-slot=slider-thumb]]:bg-orange-400 [&_[data-slot=slider-track]]:bg-neutral-700"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-500">Área</Label>
                <Select
                  value={selectedLocation || EMPTY_AREA_VALUE}
                  onValueChange={(value) => {
                    if (value !== EMPTY_AREA_VALUE) setSelectedLocation(value);
                  }}
                >
                  <SelectTrigger className="h-14 rounded-2xl border-neutral-800 bg-neutral-950 px-5 text-base text-neutral-100 shadow-none focus:ring-orange-400/20 focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
                    {(mapLocations.length ? mapLocations : stats?.locations || []).length ? (
                      (mapLocations.length ? mapLocations : stats?.locations || []).map((location) => (
                        <SelectItem key={location.name} value={location.name} className="focus:bg-neutral-900 focus:text-neutral-100">
                          {location.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={EMPTY_AREA_VALUE} disabled className="focus:bg-neutral-900 focus:text-neutral-100">
                        Sin áreas
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedCategories.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleRemoveCategory(category)}
                    className="flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200"
                    aria-label={`Quitar ${category}`}
                  >
                    <span className="truncate">{category}</span>
                    <X className="h-3.5 w-3.5 text-neutral-500" />
                  </button>
                ))}
              </div>
            ) : null}
            {selectedArticles.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedArticles.map((article) => (
                  <button
                    key={article}
                    type="button"
                    onClick={() => handleRemoveArticle(article)}
                    className="flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200"
                    aria-label={`Quitar ${article}`}
                  >
                    <span className="truncate">{article}</span>
                    <X className="h-3.5 w-3.5 text-neutral-500" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid lg:grid-cols-[1.9fr_1fr]">
            <div className="border-b border-neutral-800 bg-transparent p-4 lg:border-b-0 lg:border-r">
              <LeafletSalesMap
                legend={legend}
                locations={mapLocations}
                radiusKm={radiusKm}
                selectedCenter={selectedCenter}
                selectedLocation={selectedLocation}
                onSelectLocation={setSelectedLocation}
              />
            </div>

            <aside className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <SmallStat label="Ventas vistas" value={String(totalInView)} />
                <SmallStat label="Rango precio" value={priceRange(visibleItems)} />
                <SmallStat
                  label="DPV"
                  value={dpvInView ? `${dpvInView} días` : "Sin datos"}
                  tooltip="Días promedio de venta: sumatoria de los días que tomó vender cada artículo seleccionado, dividido entre la cantidad de artículos vendidos en la zona."
                />
                <SmallStat label="Zonas" value={String(mapLocations.length)} />
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Items</div>
                    <div className="mt-1 font-mono text-xs text-neutral-500">{visibleItems.length}</div>
                  </div>
                  <div className="flex rounded-2xl border border-neutral-800 bg-neutral-950 p-1">
                    <button
                      type="button"
                      onClick={() => setItemView("active")}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        itemView === "active" ? "bg-orange-400 text-black" : "text-neutral-400 hover:text-neutral-100",
                      ].join(" ")}
                    >
                      En venta
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemView("sold")}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition",
                        itemView === "sold" ? "bg-orange-400 text-black" : "text-neutral-400 hover:text-neutral-100",
                      ].join(" ")}
                    >
                      Vendidos
                    </button>
                  </div>
                </div>
                <div className="stats-dark-scroll mt-3 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                  {visibleItems.length ? (
                    visibleItems.map((item) => (
                      <SoldItemRow
                        key={item.id}
                        item={item}
                        selected={selectedItem?.id === item.id}
                        onSelect={() => setSelectedItemId((current) => (current === item.id ? "" : item.id))}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">
                      No hay items {itemView === "active" ? "en venta" : "vendidos"} dentro de este radio.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-sm font-semibold">{selectedLocation || "Área"} · {radiusKm} km</div>
                <div className="mt-3 space-y-2">
                  {legend.length ? (
                    legend.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="truncate text-neutral-200">{entry.name}</span>
                        </div>
                        <span className="font-mono text-xs text-neutral-400">{entry.count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-neutral-400">No hay ventas para este filtro.</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-neutral-800 bg-neutral-950/30 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-lg font-semibold">Calculadora de inversión</div>
              <div className="mt-1 max-w-2xl text-sm text-neutral-500">
                Estima dónde invertir según ventas reales, DPV, precio vendido e interés visible en el marketplace.
              </div>
            </div>
            <div className="w-full lg:w-80">
              <Label className="mb-2 text-xs font-medium text-neutral-500">Ubicación</Label>
              <Select value={calculatorLocation} onValueChange={setCalculatorLocation}>
                <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
                  {calculatorLocationOptions.map((location) => (
                    <SelectItem key={location} value={location} className="focus:bg-neutral-900 focus:text-neutral-100">
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {calculatorItems.map((item, index) => (
              <InvestmentItemCard
                key={item.id}
                item={item}
                index={index}
                categoryOptions={categoryOptions}
                onChange={updateCalculatorItem}
              />
            ))}
            <button
              type="button"
              onClick={handleAddCalculatorItem}
              className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-neutral-700 bg-neutral-950/40 text-neutral-500 transition hover:border-orange-400/70 hover:text-orange-300"
              aria-label="Agregar otro artículo"
            >
              <span className="flex items-center gap-3 text-sm font-semibold">
                <Plus className="h-5 w-5" />
                Agregar artículo
              </span>
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleEstimateInvestment}
              className="h-12 rounded-2xl bg-orange-400 px-5 text-sm font-semibold text-black shadow-none hover:bg-orange-300"
            >
              Estimar inversión
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearCalculator}
              className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-5 text-sm text-neutral-300 shadow-none hover:bg-neutral-900 hover:text-neutral-100"
            >
              Clear
            </Button>
          </div>

          {calculatorEstimates.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {calculatorEstimates.map((estimate) => (
                <InvestmentEstimateCard key={estimate.id} estimate={estimate} />
              ))}
            </div>
          ) : null}
        </section>

      </main>

      <AdminBottomNav active="stats" />
    </div>
  );
}

function LeafletSalesMap({
  legend,
  locations,
  radiusKm,
  selectedCenter,
  selectedLocation,
  onSelectLocation,
}: {
  legend: ReturnType<typeof getTopGroups>;
  locations: AdminStatsLocation[];
  radiusKm: number;
  selectedCenter: AdminStatsLocation | null;
  selectedLocation: string;
  onSelectLocation: (location: string) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRefs = useRef<LeafletLayer[]>([]);
  const [ready, setReady] = useState(Boolean(typeof window !== "undefined" && window.L));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No pudimos cargar Leaflet. Mostrando mapa básico.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const leaflet = window.L;
    if (!ready || !mapElementRef.current || mapRef.current || !leaflet) return;

    const map = leaflet.map(mapElementRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    map.setView([18.7357, -70.1627], 8);

    leaflet
      .tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
      })
      .addTo(map);
    leaflet.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    const leaflet = window.L;
    const map = mapRef.current;
    if (!ready || !leaflet || !map) return;

    layerRefs.current.forEach((layer) => map.removeLayer(layer));
    layerRefs.current = [];

    if (selectedCenter) {
      const radiusLayer = leaflet.circle([selectedCenter.latitude, selectedCenter.longitude], {
        radius: radiusKm * 1000,
        fillColor: "#fb923c",
        fillOpacity: 0.14,
        color: "#fb923c",
        opacity: 0.85,
        weight: 2,
        interactive: false,
      }).addTo(map);
      layerRefs.current.push(radiusLayer);
    }

    const markerLayers = locations.map((location) => {
      const isSelected = location.name === selectedLocation;
      const marker = leaflet
        .circleMarker([location.latitude, location.longitude], {
          radius: Math.min(18, 8 + location.soldCount * 1.5),
          fillColor: getDotColor(location, legend),
          fillOpacity: isSelected ? 0.95 : 0.78,
          color: isSelected ? "#fff7ed" : "#111827",
          weight: isSelected ? 3 : 1,
          interactive: true,
        })
        .bindTooltip?.(`${location.name}: ${location.soldCount} ventas`, {
          direction: "top",
          opacity: 0.92,
          sticky: true,
        });

      marker?.on?.("click", () => onSelectLocation(location.name));
      marker?.addTo(map);
      return marker || leaflet.circleMarker([location.latitude, location.longitude]).addTo(map);
    });
    layerRefs.current.push(...markerLayers);

    if (selectedCenter) {
      map.setView([selectedCenter.latitude, selectedCenter.longitude], 9);
    }
  }, [legend, locations, onSelectLocation, radiusKm, ready, selectedCenter, selectedLocation]);

  if (loadError) {
    return (
      <>
        <SvgSalesMap
          legend={legend}
          locations={locations}
          radiusKm={radiusKm}
          selectedCenter={selectedCenter}
          selectedLocation={selectedLocation}
          onSelectLocation={onSelectLocation}
        />
        <div className="mt-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-100">
          {loadError}
        </div>
      </>
    );
  }

  return (
    <div className="relative z-0 h-[min(58vh,430px)] min-h-[300px] overflow-hidden rounded-2xl border border-neutral-800 bg-transparent">
      <div ref={mapElementRef} className="h-full w-full" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 px-4 text-center text-sm text-neutral-300">
          Cargando mapa...
        </div>
      ) : null}
    </div>
  );
}

function SvgSalesMap({
  legend,
  locations,
  radiusKm,
  selectedCenter,
  selectedLocation,
  onSelectLocation,
}: {
  legend: ReturnType<typeof getTopGroups>;
  locations: AdminStatsLocation[];
  radiusKm: number;
  selectedCenter: AdminStatsLocation | null;
  selectedLocation: string;
  onSelectLocation: (location: string) => void;
}) {
  return (
    <div className="relative z-0 h-[min(58vh,430px)] min-h-[300px] overflow-hidden rounded-2xl border border-neutral-800 bg-transparent">
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Mapa de ventas por ubicación">
        <path
          d="M7 53 C13 38 27 22 47 14 C62 8 78 13 89 28 C98 41 94 58 82 69 C68 82 46 89 28 82 C13 76 2 66 7 53 Z"
          fill="#1f2937"
          stroke="#334155"
          strokeWidth="0.8"
        />
        <path d="M12 55 C28 48 46 49 64 42 C78 37 86 31 91 24" fill="none" stroke="#475569" strokeWidth="0.35" />
        <path d="M28 81 C35 67 42 55 51 45 C59 35 69 27 80 18" fill="none" stroke="#475569" strokeWidth="0.35" />
        {selectedCenter ? <RadiusCircle location={selectedCenter} radiusKm={radiusKm} /> : null}
        {locations.map((location) => {
          const point = projectPoint(location.latitude, location.longitude);
          const isSelected = location.name === selectedLocation;
          const size = Math.min(13, 5 + location.soldCount * 1.5);
          return (
            <g
              key={location.name}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => onSelectLocation(location.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelectLocation(location.name);
                }
              }}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={size / 2}
                fill={getDotColor(location, legend)}
                fillOpacity={isSelected ? "0.95" : "0.78"}
                stroke={isSelected ? "#fff7ed" : "#0f172a"}
                strokeWidth={isSelected ? "1.5" : "0.7"}
              />
              <text x={point.x + 3.5} y={point.y - 3} fill="#e5e7eb" fontSize="2.5">
                {location.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RadiusCircle({ location, radiusKm }: { location: AdminStatsLocation; radiusKm: number }) {
  const point = projectPoint(location.latitude, location.longitude);
  const degreesPerKm = 1 / 111;
  const radiusDegrees = radiusKm * degreesPerKm;
  const radiusX = (radiusDegrees / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * 100;
  const radiusY = (radiusDegrees / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  const radius = Math.max(4, (radiusX + radiusY) / 2);

  return <circle cx={point.x} cy={point.y} r={radius} fill="#fb923c" fillOpacity="0.12" stroke="#fb923c" strokeDasharray="2 2" strokeWidth="0.8" />;
}

function SmallStat({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span>{label}</span>
        {tooltip ? (
          <span className="group relative inline-flex">
            <Info className="h-3.5 w-3.5 text-neutral-500" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-left text-xs leading-snug text-neutral-200 shadow-2xl group-hover:block">
              {tooltip}
            </span>
          </span>
        ) : null}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function articleNumber(index: number) {
  const names = ["uno", "dos", "tres", "cuatro", "cinco", "seis"];
  return names[index] || String(index + 1);
}

function InvestmentItemCard({
  item,
  index,
  categoryOptions,
  onChange,
}: {
  item: CalculatorItem;
  index: number;
  categoryOptions: string[];
  onChange: <Key extends keyof CalculatorItem>(id: string, key: Key, value: CalculatorItem[Key]) => void;
}) {
  const inputKind = getCategoryInputKind(item.category);

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Artículo {articleNumber(index)}</div>
          <div className="mt-1 text-xs text-neutral-500">Datos para comparar demanda, precio y tiempo.</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-neutral-500">Categoría</Label>
          <Select value={item.category || ALL_CATEGORIES_VALUE} onValueChange={(value) => onChange(item.id, "category", value === ALL_CATEGORIES_VALUE ? "" : value)}>
            <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
              <SelectItem value={ALL_CATEGORIES_VALUE} className="focus:bg-neutral-900 focus:text-neutral-100">
                Seleccionar
              </SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category} className="focus:bg-neutral-900 focus:text-neutral-100">
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-neutral-500">Nombre de artículo</Label>
          <Input
            value={item.name}
            onChange={(event) => onChange(item.id, "name", event.target.value)}
            placeholder="Ej: iPhone 16"
            className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-neutral-500">Cantidad</Label>
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(event) => onChange(item.id, "quantity", Math.max(1, Number(event.target.value) || 1))}
            className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-neutral-500">Condición</Label>
          <Select value={item.condition} onValueChange={(value) => onChange(item.id, "condition", value)}>
            <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
              {CONDITION_OPTIONS.map((condition) => (
                <SelectItem key={condition} value={condition} className="focus:bg-neutral-900 focus:text-neutral-100">
                  {condition}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {inputKind === "vehicle" ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-500">Año</Label>
              <Input
                inputMode="numeric"
                value={item.year}
                onChange={(event) => onChange(item.id, "year", event.target.value)}
                placeholder="2020"
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-500">Marca</Label>
              <Input
                value={item.brand}
                onChange={(event) => onChange(item.id, "brand", event.target.value)}
                placeholder="Hyundai"
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-medium text-neutral-500">Modelo</Label>
              <Input
                value={item.model}
                onChange={(event) => onChange(item.id, "model", event.target.value)}
                placeholder="Tucson"
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
              />
            </div>
          </>
        ) : null}

        {inputKind === "clothing" || inputKind === "shoes" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-medium text-neutral-500">Talla</Label>
            <Input
              value={item.size}
              onChange={(event) => onChange(item.id, "size", event.target.value)}
              placeholder={inputKind === "shoes" ? "Ej: 9 US" : "Ej: M"}
              className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 shadow-none placeholder:text-neutral-600 focus-visible:border-orange-400 focus-visible:ring-orange-400/20"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InvestmentEstimateCard({ estimate }: { estimate: CalculatorEstimate }) {
  return (
    <div className="relative rounded-3xl border border-neutral-800 bg-neutral-950/70 p-4">
      {estimate.recommended ? (
        <div className="absolute right-4 top-4 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300">
          Recomendado
        </div>
      ) : null}
      <div className="pr-28">
        <div className="text-sm font-semibold text-neutral-100">{estimate.title}</div>
        <div className="mt-1 text-xs text-neutral-500">
          {estimate.category} · cantidad {estimate.quantity}
        </div>
      </div>
      <div className="mt-4 inline-flex rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
        Basado en {estimate.sampleUsers} usuarios
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SmallStat label="DPV" value={estimate.dpv ? `${estimate.dpv} días` : "Sin datos"} />
        <SmallStat label="Interés de compradores" value={String(estimate.buyerInterest)} />
        <SmallStat
          label="Tiempo estimado de venta"
          value={estimate.estimatedDays ? `${estimate.estimatedDays} días` : "Sin datos"}
          tooltip="Esta data no es exacta; es un tiempo sugerido de venta total."
        />
        <SmallStat label="Precio sugerido" value={estimate.suggestedPrice} />
      </div>
    </div>
  );
}

function SoldItemRow({
  item,
  selected,
  onSelect,
}: {
  item: AdminSoldItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-neutral-900/60 transition",
        selected ? "border-orange-400/70" : "border-neutral-800 hover:border-orange-400/50",
      ].join(" ")}
    >
      <button type="button" onClick={onSelect} className="flex w-full gap-3 p-3 text-left">
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-600">Sin foto</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-neutral-100">{item.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-400">
            <span>{item.category}</span>
            <span>{item.brand}</span>
            <span>{item.model}</span>
            <span>{item.location}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-orange-300">{formatCurrency(item.price)}</span>
            <span className="text-xs text-neutral-500">
              {item.status === "active" ? "En venta" : item.daysToSell ? `${item.daysToSell} días` : "Sin tiempo"}
            </span>
          </div>
        </div>
      </button>
      {selected ? (
        <div className="border-t border-neutral-800 px-3 pb-3 pt-3">
          <ItemEngagementChart item={item} />
          <Link href={item.href} className="mt-3 inline-flex text-xs font-semibold text-orange-300 hover:text-orange-200">
            Ver post
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ItemEngagementChart({ item }: { item: AdminSoldItem }) {
  const views = Math.max(0, item.views || 0);
  const interactions = Math.max(0, item.interactions || 0);
  const xMax = Math.max(views, 10);
  const yMax = Math.max(interactions, 1);
  const x = 28 + (views / xMax) * 220;
  const y = 104 - (interactions / yMax) * 74;
  const interactionRate = views > 0 ? Math.round((interactions / views) * 100) : 0;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-100">Views vs interacciones</div>
          <div className="mt-1 text-xs text-neutral-500">X = views · Y = mensajes de compradores</div>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div>{views} views</div>
          <div>{interactions} interacciones</div>
        </div>
      </div>
      <svg viewBox="0 0 280 130" className="mt-3 h-36 w-full overflow-visible">
        <line x1="28" y1="104" x2="258" y2="104" stroke="#404040" strokeWidth="1" />
        <line x1="28" y1="24" x2="28" y2="104" stroke="#404040" strokeWidth="1" />
        {[0, 1, 2, 3].map((step) => {
          const gy = 104 - step * 24;
          return <line key={step} x1="28" y1={gy} x2="258" y2={gy} stroke="#262626" strokeWidth="1" />;
        })}
        <path d={`M28 104 L${x} ${y}`} fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" />
        <circle cx={x} cy={y} r="6" fill="#fb923c" stroke="#fff7ed" strokeWidth="3" />
        <text x="28" y="122" fill="#737373" fontSize="10">0</text>
        <text x="226" y="122" fill="#737373" fontSize="10">{xMax} views</text>
        <text x="2" y="30" fill="#737373" fontSize="10">{yMax}</text>
        <text x="2" y="108" fill="#737373" fontSize="10">0</text>
      </svg>
      <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-3">
        <div className="rounded-xl bg-neutral-900 p-2">
          <div className="text-neutral-500">Ratio</div>
          <div className="mt-1 font-semibold text-neutral-100">{views ? `${interactionRate}%` : "Sin views"}</div>
        </div>
        <div className="rounded-xl bg-neutral-900 p-2">
          <div className="text-neutral-500">Chats</div>
          <div className="mt-1 font-semibold text-neutral-100">{interactions}</div>
        </div>
        <div className="rounded-xl bg-neutral-900 p-2">
          <div className="text-neutral-500">Usuarios</div>
          <div className="mt-1 truncate font-semibold text-neutral-100">
            {item.interactionUsers.length ? item.interactionUsers.slice(0, 2).join(", ") : "Sin chats"}
          </div>
        </div>
      </div>
      {!views ? (
        <div className="mt-2 text-xs text-neutral-500">
          Este gráfico se actualizará cuando compradores abran la publicación. Las vistas del dueño no se cuentan.
        </div>
      ) : null}
    </div>
  );
}
