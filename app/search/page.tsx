"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Listing, subscribeListings } from "@/lib/marketplace";
import LocationPickerModal from "@/components/LocationPickerModal";
import { getDefaultListingLocation, normalizeLocationName, readStoredUserLocation } from "@/lib/location";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, []);

  useEffect(() => {
    const queryLocation = searchParams.get("location");
    if (queryLocation) {
      setSelectedLocation(queryLocation);
      return;
    }

    setSelectedLocation(getDefaultListingLocation());

    if (searchParams.get("location")) return;
    const storedLocation = readStoredUserLocation();
    if (storedLocation?.name) {
      setSelectedLocation(storedLocation.name);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings.filter((item) => {
      if (item.status === "sold") return false;
      if (selectedLocation && normalizeLocation(item.location) !== normalizeLocation(selectedLocation)) return false;
      if (!normalizedQuery) return true;
      return item.title.toLowerCase().includes(normalizedQuery);
    });
  }, [listings, query, selectedLocation]);

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
            <span className="text-sm text-neutral-300">Listing Locations</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <MapPin className="h-4 w-4" />
              {selectedLocation}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            No encontramos resultados para “{query.trim() || "tu búsqueda"}” en {selectedLocation}.
          </div>
        ) : (
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
        )}
      </main>

      <LocationPickerModal
        open={locationModalOpen}
        currentLocation={selectedLocation}
        onClose={() => setLocationModalOpen(false)}
        onSelect={setSelectedLocation}
      />
    </div>
  );
}

function normalizeLocation(location: string) {
  return normalizeLocationName(location);
}
