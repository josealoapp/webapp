"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MapPin, Menu, Search } from "lucide-react";
import LocationPickerModal from "./LocationPickerModal";
import { Listing } from "@/lib/marketplace";

const categories = [
  { label: "Todo", value: "Todo" },
  { label: "Mujer", value: "Mujer" },
  { label: "Hombres", value: "Hombre" },
  { label: "Bazar", value: "Bazar" },
  { label: "Electrónicos", value: "Electrónicos" },
  { label: "Zapatos", value: "Zapatos" },
  { label: "Hogar", value: "Hogar" },
];

export default function HomeHeader({
  selectedLocation,
  onLocationChange,
  listings,
  activeCategory,
  onCategoryChange,
}: {
  selectedLocation: string;
  onLocationChange: (location: string) => void;
  listings: Listing[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const trimmedQuery = query.trim();
  const suggestions = useMemo(() => {
    if (!trimmedQuery) {
      return [] as Listing[];
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    return listings
      .filter((item) => item.title.toLowerCase().includes(normalizedQuery))
      .slice(0, 3);
  }, [listings, trimmedQuery]);

  const openResults = () => {
    if (!trimmedQuery) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}&location=${encodeURIComponent(selectedLocation)}`);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors ${
        scrolled ? "bg-neutral-950/85 backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-4">
        {/* Top row */}
        <div className="flex items-center gap-3">
          <Link
            href="/activity"
            className="flex h-10 w-10 items-center justify-center text-white drop-shadow"
            aria-label="Actividad"
          >
            <Heart className="h-6 w-6" />
          </Link>
          <div className="relative flex-1">
            <input
              placeholder="Search for items"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  openResults();
                }
              }}
              className="w-full rounded-full border border-white/20 bg-black/30 px-4 py-3 pr-12 text-sm text-white outline-none ring-0 placeholder:text-white/70 focus:border-orange-400"
            />
            <button
              type="button"
              onClick={openResults}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>

          </div>
        </div>

        {showSuggestions && trimmedQuery ? (
          <div className="mt-3 rounded-3xl border border-white/10 bg-neutral-950/95 p-3 shadow-2xl backdrop-blur">
            {suggestions.length > 0 ? (
              <>
                <div className="space-y-2">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        router.push(`/item/${item.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/5"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-neutral-900">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-neutral-400">{item.location}</div>
                      </div>
                      <div className="text-sm font-semibold text-orange-400">RD${item.price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openResults}
                  className="mt-3 h-11 w-full rounded-2xl border border-neutral-800 bg-neutral-900 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
                >
                  Ver todos
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-sm text-neutral-300">
                No encontramos publicaciones para “{trimmedQuery}”.
              </div>
            )}
          </div>
        ) : null}

        <div
          className={`overflow-hidden transition-all duration-300 ${
            scrolled || (showSuggestions && trimmedQuery)
              ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
              : "mt-3 max-h-48 opacity-100"
          }`}
        >
          {/* Categories + menu */}
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const isActive = cat.value === activeCategory;
                return (
                  <button
                    key={cat.value}
                    onClick={() => onCategoryChange(cat.value)}
                    className={`whitespace-nowrap rounded-3xl px-4 py-2 text-sm font-semibold transition  ${
                      isActive
                        ? "border border-orange-400 text-orange-400 shadow-[0_0_0_1px_rgba(255,184,79,0.25)]"
                        : "border border-transparent bg-black/20 text-white hover:text-orange-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <Link
              href="/categories"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl  bg-black/30 text-white backdrop-blur hover:text-orange-200"
              aria-label="Categorías"
            >
              <Menu className="h-5 w-5" />
            </Link>
          </div>

          {/* Listing location selector */}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left backdrop-blur hover:border-orange-400/50"
          >
            <span className="text-sm text-white/90">Listing Locations</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <MapPin className="h-4 w-4" />
              {selectedLocation || "Detectando ubicación"}
            </span>
          </button>
        </div>
      </div>

      <LocationPickerModal
        open={locationModalOpen}
        currentLocation={selectedLocation}
        onClose={() => setLocationModalOpen(false)}
        onSelect={onLocationChange}
      />
    </header>
  );
}
