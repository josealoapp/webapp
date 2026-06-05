"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Listing, searchListings } from "@/lib/marketplace";
import LocationPickerModal from "@/components/LocationPickerModal";
import {
  getDefaultListingLocation,
  normalizeLocationName,
  readStoredUserLocation,
  saveManualListingLocation,
} from "@/lib/location";
import { recordSearchEvent } from "@/lib/search-analytics";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const queryLocation = searchParams.get("location");
    if (queryLocation) {
      setSelectedLocation(queryLocation);
      setPreferredLocation(queryLocation);
      return;
    }

    setSelectedLocation("");
    setPreferredLocation(getDefaultListingLocation());

    if (searchParams.get("location")) return;
    const storedLocation = readStoredUserLocation();
    if (storedLocation?.name) {
      setPreferredLocation(storedLocation.name);
    }
  }, [searchParams]);

  const loadResults = useCallback(
    async (mode: "replace" | "append", cursor?: string | null) => {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        setListings([]);
        setNextCursor(null);
        setSearchError("");
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (mode === "replace") {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setSearchError("");

      try {
        const result = await searchListings({
          q: normalizedQuery,
          location: selectedLocation || undefined,
          status: "active",
          limit: 24,
          cursor,
        });

        const sortedItems =
          selectedLocation || !preferredLocation
            ? result.items
            : prioritizeByLocation(result.items, preferredLocation);
        setListings((current) => (mode === "append" ? [...current, ...sortedItems] : sortedItems));
        setNextCursor(result.nextCursor);

        if (mode === "replace") {
          void recordSearchEvent({
            query: normalizedQuery,
            location: selectedLocation || preferredLocation,
            source: "search",
          }).catch(() => {});
        }
      } catch {
        setSearchError("No pudimos cargar los resultados. Intenta de nuevo.");
        if (mode === "replace") {
          setListings([]);
          setNextCursor(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [preferredLocation, query, selectedLocation]
  );

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      void loadResults("replace");
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadResults]);

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    void loadResults("append", nextCursor);
  };

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    if (location) {
      setPreferredLocation(location);
      saveManualListingLocation(location);
    }

    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (location) {
      params.set("location", location);
    } else {
      params.delete("location");
    }
    const nextUrl = params.toString() ? `/search?${params.toString()}` : "/search";
    router.replace(nextUrl, { scroll: false });
  };

  const filtered = listings.filter((item) => {
    if (item.status === "sold") return false;
    if (selectedLocation && normalizeLocation(item.location) !== normalizeLocation(selectedLocation)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 pb-4 pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar publicaciones"
                className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 pr-12 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-orange-400"
              />
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left"
          >
            <span className="text-sm text-neutral-300">Ubicaciones de búsqueda</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <MapPin className="h-4 w-4" />
              {selectedLocation || "Todas"}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-5">
        {searchError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-5 text-sm text-red-200">
            {searchError}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            Buscando publicaciones...
          </div>
        ) : !query.trim() ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            Escribe lo que quieres buscar para ver resultados.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            No encontramos resultados para “{query.trim() || "tu búsqueda"}” en {selectedLocation || "todas las ubicaciones"}.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={`/item/${item.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 hover:border-orange-400"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-800">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-neutral-100">{item.title}</div>
                    <div className="mt-1 text-sm text-neutral-400">{item.location}</div>
                    <div className="mt-1 text-xs text-neutral-500">{item.category}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-orange-400">RD${item.price.toLocaleString()}</div>
                </Link>
              ))}
            </div>

            {nextCursor ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="mt-4 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 disabled:text-neutral-500"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            ) : null}
          </>
        )}
      </main>

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

function prioritizeByLocation(items: Listing[], preferredLocation: string) {
  const target = normalizeLocation(preferredLocation);

  return [...items].sort((a, b) => {
    const aNear = normalizeLocation(a.location) === target ? 1 : 0;
    const bNear = normalizeLocation(b.location) === target ? 1 : 0;
    if (aNear !== bNear) return bNear - aNear;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}
