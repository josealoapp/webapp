"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Listing, searchListings } from "@/lib/marketplace";
import LocationPickerModal from "@/components/LocationPickerModal";
import VerifiedBadge from "@/components/VerifiedBadge";
import {
  getDefaultListingLocation,
  normalizeLocationName,
  readStoredUserLocation,
  saveManualListingLocation,
} from "@/lib/location";
import { formatMoney } from "@/lib/money";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatar";
import { recordSearchEvent } from "@/lib/search-analytics";
import { PublicUserSearchResult, searchUsers } from "@/lib/user-search";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<PublicUserSearchResult[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const resultView = searchParams.get("view") === "users" ? "users" : "posts";
  const isUsersView = resultView === "users";

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

  const updateView = (view: "users" | "posts") => {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    params.set("view", view);
    if (view === "users") params.delete("location");
    router.replace(`/search?${params.toString()}`, { scroll: false });
  };

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

  const loadUsers = useCallback(async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setUsers([]);
      setSearchError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError("");

    try {
      const result = await searchUsers({ q: normalizedQuery, limit: 40 });
      setUsers(result);
    } catch {
      setUsers([]);
      setSearchError("No pudimos cargar los usuarios. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (isUsersView) {
        void loadUsers();
      } else {
        void loadResults("replace");
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isUsersView, loadResults, loadUsers]);

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

  const filtered = useMemo(() => listings.filter((item) => {
    if (item.status === "sold") return false;
    if (selectedLocation && normalizeLocation(item.location) !== normalizeLocation(selectedLocation)) return false;
    return true;
  }), [listings, selectedLocation]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/0 backdrop-blur">
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
                placeholder={isUsersView ? "Buscar usuarios" : "Buscar publicaciones"}
                style={{ fontSize: "16px" }}
                className="w-full rounded-full border border-neutral-800 bg-neutral-900/0 px-4 py-3 pr-12 text-sm text-neutral-100 outline-none placeholder:text-neutral-400 focus:border-orange-400"
              />
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateView("users")}
              className={[
                "h-11 rounded-2xl border px-4 text-sm font-semibold",
                isUsersView
                  ? "border-orange-500 bg-orange-500 text-black"
                  : "border-neutral-800 bg-neutral-900 text-neutral-300",
              ].join(" ")}
            >
              Usuarios
            </button>
            <button
              type="button"
              onClick={() => updateView("posts")}
              className={[
                "h-11 rounded-2xl border px-4 text-sm font-semibold",
                !isUsersView
                  ? "border-orange-500 bg-orange-500 text-black"
                  : "border-neutral-800 bg-neutral-900 text-neutral-300",
              ].join(" ")}
            >
              Posts
            </button>
          </div>

          {!isUsersView ? (
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
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-5">
        {searchError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-5 text-sm text-red-200">
            {searchError}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 px-4 py-5 text-sm text-neutral-300">
            Buscando {isUsersView ? "usuarios" : "publicaciones"}...
          </div>
        ) : !query.trim() ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 px-4 py-5 text-sm text-neutral-300">
            Escribe lo que quieres buscar para ver resultados.
          </div>
        ) : isUsersView ? (
          users.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 px-4 py-5 text-sm text-neutral-300">
              No encontramos usuarios para “{query.trim() || "tu búsqueda"}”.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <Link
                  key={user.userId}
                  href={`/profile/${user.userId}?name=${encodeURIComponent(user.displayName)}`}
                  className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/20 p-3 hover:border-orange-400"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-neutral-800 bg-neutral-900">
                    <img
                      src={user.avatarUrl || DEFAULT_PROFILE_AVATAR}
                      alt={user.displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="listing-title truncate text-base font-semibold text-neutral-100">{user.displayName}</div>
                      {user.isVerified ? <VerifiedBadge className="h-4 w-4 shrink-0" /> : null}
                    </div>
                    <div className="mt-1 truncate text-sm text-neutral-400">
                      {user.handle ? `@${user.handle}` : "Usuario"}
                    </div>
                    {user.profileDescription ? (
                      <div className="mt-1 line-clamp-1 text-xs text-neutral-500">{user.profileDescription}</div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 px-4 py-5 text-sm text-neutral-300">
            No encontramos resultados para “{query.trim() || "tu búsqueda"}” en {selectedLocation || "todas las ubicaciones"}.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={`/item/${item.id}`}
                  className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/20 hover:border-orange-400"
                >
                  <div className="aspect-square w-full bg-neutral-800">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="listing-title line-clamp-2 min-h-10 text-sm font-semibold text-neutral-100">{item.title}</div>
                    <div className="mt-2 truncate text-xs text-neutral-400">{item.location}</div>
                    <div className="listing-price mt-2 text-sm font-bold text-orange-400">
                      {formatMoney(item.price, item.currency)}
                    </div>
                  </div>
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
