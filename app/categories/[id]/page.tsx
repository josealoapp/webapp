"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarIcon, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { appCategories, getCategoryInputKind, normalizeCategoryName } from "@/lib/categories";
import {
  getActiveBazarItems,
  isListingVisibleInMarketplace,
  searchListings,
  type Listing,
} from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { recordSearchEvent } from "@/lib/search-analytics";
import LocationPickerModal from "@/components/LocationPickerModal";
import {
  getDefaultListingLocation,
  normalizeLocationName,
  readStoredUserLocation,
  saveManualListingLocation,
} from "@/lib/location";
import { formatListingAge } from "@/lib/relative-time";

type CategoryFilters = {
  minPrice: string;
  maxPrice: string;
  listedAfter: string;
  year: string;
  size: string;
  shoeSize: string;
};

const emptyFilters: CategoryFilters = {
  minPrice: "",
  maxPrice: "",
  listedAfter: "",
  year: "",
  size: "",
  shoeSize: "",
};

type CategoryResult = {
  id: string;
  href: string;
  title: string;
  price: number;
  type?: "article" | "bazar";
  image: string;
  location: string;
  category: string;
  createdAt: number;
  vehicleYear?: number;
  clothingSize?: string;
  shoeSize?: string;
};

function hasActiveFilters(filters: CategoryFilters) {
  return Object.values(filters).some(Boolean);
}

function dateInputToDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function dateToInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatListedAfter(value: string) {
  const date = dateInputToDate(value);
  if (!date) return "Seleccionar fecha";
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function listingMatchesCategory(listing: Listing, categoryName: string) {
  const selected = normalizeCategoryName(categoryName);
  return [listing.category, listing.bazarCategory].some((value) => normalizeCategoryName(value || "") === selected);
}

function flattenCategoryListings(listings: Listing[], categoryName: string): CategoryResult[] {
  return listings.flatMap((listing) => {
    if (!isListingVisibleInMarketplace(listing) || !listingMatchesCategory(listing, categoryName)) {
      return [];
    }

    if ((listing.type || "article") === "bazar") {
      return getActiveBazarItems(listing).map((item) => ({
        id: `${listing.id}:${item.id}`,
        href: `/item/${listing.id}?bazarItemId=${encodeURIComponent(item.id)}`,
        title: item.title,
        price: Number(item.price || 0),
        type: "bazar",
        image: item.image || listing.image || "",
        location: listing.location,
        category: listing.bazarCategory || listing.category,
        createdAt: listing.createdAt,
        vehicleYear: item.vehicleYear,
        clothingSize: item.clothingSize,
        shoeSize: item.shoeSize,
      }));
    }

    return [
      {
        id: listing.id,
        href: `/item/${listing.id}`,
        title: listing.title,
        price: Number(listing.price || 0),
        type: listing.type || "article",
        image: listing.image || "",
        location: listing.location,
        category: listing.category,
        createdAt: listing.createdAt,
        vehicleYear: listing.vehicleYear,
        clothingSize: listing.clothingSize,
        shoeSize: listing.shoeSize,
      },
    ];
  });
}

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [filters, setFilters] = useState<CategoryFilters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<CategoryFilters>(emptyFilters);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const category = useMemo(() => appCategories.find((c) => c.id === params?.id), [params?.id]);
  const filterKind = getCategoryInputKind(category?.name);
  const categoryItems = useMemo(
    () => (category ? flattenCategoryListings(listings, category.name) : []),
    [category, listings]
  );

  useEffect(() => {
    const queryLocation = searchParams.get("location");
    if (queryLocation) {
      setSelectedLocation(queryLocation);
      setPreferredLocation(queryLocation);
      return;
    }

    setSelectedLocation("");
    setPreferredLocation(getDefaultListingLocation());

    const storedLocation = readStoredUserLocation();
    if (storedLocation?.name) {
      setPreferredLocation(storedLocation.name);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!category) return;

    let cancelled = false;
    setLoading(true);
    searchListings({
      category: category.name,
      location: selectedLocation || undefined,
      status: "active",
      limit: 60,
    })
      .then((result) => {
        if (cancelled) return;
        setListings(result.items);
        setNextCursor(result.nextCursor);
        void recordSearchEvent({
          query: q,
          category: category.name,
          location: selectedLocation || preferredLocation,
          source: "category",
        }).catch(() => {});
      })
      .catch(() => {
        if (cancelled) return;
        setListings([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, preferredLocation, selectedLocation]);

  useEffect(() => {
    if (!category || !q.trim()) return;

    const timeoutId = window.setTimeout(() => {
      void recordSearchEvent({
        query: q,
        category: category.name,
        location: selectedLocation || preferredLocation,
        source: "category",
      }).catch(() => {});
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [category, preferredLocation, q, selectedLocation]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const minPrice = Number(filters.minPrice);
    const maxPrice = Number(filters.maxPrice);
    const listedAfterTime = filters.listedAfter ? new Date(`${filters.listedAfter}T00:00:00`).getTime() : 0;
    const location = normalizeLocation(selectedLocation);
    const year = Number(filters.year);
    const shoeSize = filters.shoeSize.trim().toLowerCase();
    const size = filters.size.trim().toLowerCase();

    return categoryItems.filter((item) => {
      if (term && !item.title.toLowerCase().includes(term)) return false;
      if (location && normalizeLocation(item.location) !== location) return false;
      if (minPrice && item.price < minPrice) return false;
      if (maxPrice && item.price > maxPrice) return false;
      if (listedAfterTime && item.createdAt < listedAfterTime) return false;
      if (filterKind === "vehicle" && year && item.vehicleYear !== year) return false;
      if (filterKind === "clothing" && size && item.clothingSize?.toLowerCase() !== size) return false;
      if (filterKind === "shoes" && shoeSize && item.shoeSize?.toLowerCase() !== shoeSize) return false;
      return true;
    }).sort((a, b) => {
      if (selectedLocation || !preferredLocation) return 0;
      const targetLocation = normalizeLocation(preferredLocation);
      const aNear = normalizeLocation(a.location) === targetLocation ? 1 : 0;
      const bNear = normalizeLocation(b.location) === targetLocation ? 1 : 0;
      if (aNear !== bNear) return bNear - aNear;
      return b.createdAt - a.createdAt;
    });
  }, [categoryItems, filterKind, filters, preferredLocation, q, selectedLocation]);

  if (!category) return notFound();

  const openFilters = () => {
    setDraftFilters(filters);
    setIsFilterOpen(true);
  };

  const updateDraftFilter = (key: keyof CategoryFilters, value: string) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setIsFilterOpen(false);
  };

  const loadMore = async () => {
    if (!category || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await searchListings({
        category: category.name,
        location: selectedLocation || undefined,
        status: "active",
        limit: 60,
        cursor: nextCursor,
      });
      setListings((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    if (location) {
      setPreferredLocation(location);
      saveManualListingLocation(location);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (location) {
      nextParams.set("location", location);
    } else {
      nextParams.delete("location");
    }
    const nextUrl = nextParams.toString()
      ? `/categories/${category.id}?${nextParams.toString()}`
      : `/categories/${category.id}`;
    router.replace(nextUrl, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/0 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link
            href="/categories"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar en ${category.name}`}
              className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 pr-12 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <button
          type="button"
          onClick={() => setLocationModalOpen(true)}
          className="mb-4 flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left hover:border-neutral-600"
        >
          <span className="text-sm text-neutral-300">Ubicaciones de búsqueda</span>
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-orange-400">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{selectedLocation || "Todas"}</span>
          </span>
        </button>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-400">
            {loading ? "Cargando publicaciones..." : `${filtered.length} resultados en ${category.name}`}
          </div>
          <button
            type="button"
            onClick={openFilters}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-neutral-900 text-neutral-300 transition hover:text-white",
              hasActiveFilters(filters) ? "border-orange-400 text-orange-300" : "border-neutral-800",
            ].join(" ")}
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            Cargando publicaciones reales...
          </div>
        ) : filtered.length ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((item) => {
                const ageLabel = formatListingAge(item.createdAt);

                return (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 shadow-sm transition hover:border-orange-400"
              >
                <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-neutral-800">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">Sin foto</div>
                  )}
                </div>
                <div className="listing-price text-sm font-bold text-orange-400">RD${item.price.toLocaleString()}</div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  {item.type === "bazar" ? (
                    <span className="shrink-0 text-xs font-bold uppercase text-blue-400">Bazar</span>
                  ) : null}
                  <span className="listing-title min-w-0 truncate text-sm font-medium text-neutral-100">{item.title}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <div className="flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.location || "Santo Domingo"}</span>
                  </div>
                  {ageLabel ? <span className="shrink-0">{ageLabel}</span> : null}
                </div>
              </Link>
                );
              })}
            </div>
            {nextCursor ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-4 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 disabled:text-neutral-500"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            No hay publicaciones activas para esta categoría con los filtros seleccionados.
          </div>
        )}
      </main>

      {isFilterOpen ? (
        <div className="fixed inset-0 z-[3000] bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-md flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-neutral-100">Filtros</div>
                <div className="text-xs text-neutral-500">{category.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-300"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Precio mínimo</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={draftFilters.minPrice}
                    onChange={(e) => updateDraftFilter("minPrice", e.target.value)}
                    placeholder="RD$"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Precio máximo</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={draftFilters.maxPrice}
                    onChange={(e) => updateDraftFilter("maxPrice", e.target.value)}
                    placeholder="RD$"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-neutral-500">Publicado desde</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={[
                        "h-12 w-full justify-between rounded-xl border-neutral-800 bg-neutral-900 px-3 text-left font-normal text-neutral-100 hover:bg-neutral-900 hover:text-neutral-100",
                        !draftFilters.listedAfter ? "text-neutral-500 hover:text-neutral-500" : "",
                      ].join(" ")}
                    >
                      <span>{formatListedAfter(draftFilters.listedAfter)}</span>
                      <CalendarIcon className="h-4 w-4 text-neutral-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto rounded-2xl border-neutral-800 bg-neutral-950 p-0 text-neutral-100"
                  >
                    <Calendar
                      mode="single"
                      selected={dateInputToDate(draftFilters.listedAfter)}
                      onSelect={(date) => updateDraftFilter("listedAfter", date ? dateToInputValue(date) : "")}
                      disabled={{ after: new Date() }}
                      captionLayout="label"
                    />
                    <div className="flex items-center justify-between border-t border-neutral-800 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => updateDraftFilter("listedAfter", "")}
                        className="text-sm font-semibold text-neutral-400 hover:text-neutral-100"
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraftFilter("listedAfter", dateToInputValue(new Date()))}
                        className="text-sm font-semibold text-orange-300 hover:text-orange-200"
                      >
                        Hoy
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {filterKind === "vehicle" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Año del vehículo</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1900"
                    max="2026"
                    value={draftFilters.year}
                    onChange={(e) => updateDraftFilter("year", e.target.value)}
                    placeholder="Ej. 2022"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                  />
                </label>
              ) : null}

              {filterKind === "clothing" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Talla</span>
                  <select
                    value={draftFilters.size}
                    onChange={(e) => updateDraftFilter("size", e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                  >
                    <option value="">Cualquier talla</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </label>
              ) : null}

              {filterKind === "shoes" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Talla de zapatos</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={draftFilters.shoeSize}
                    onChange={(e) => updateDraftFilter("shoeSize", e.target.value)}
                    placeholder="Ej. 40"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                  />
                </label>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-neutral-800 px-5 py-4">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-neutral-950"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LocationPickerModal
        open={locationModalOpen}
        currentLocation={selectedLocation}
        allowAllLocations
        onClose={() => setLocationModalOpen(false)}
        onSelect={handleLocationSelect}
      />
    </div>
  );
}

function normalizeLocation(location: string) {
  return normalizeLocationName(location);
}
