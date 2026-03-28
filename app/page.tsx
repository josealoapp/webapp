"use client";

import Link from "next/link";
import HomeHeader from "@/components/HomeHeader";
import HomeHero from "@/components/HomeHero";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Listing, subscribeListings } from "@/lib/marketplace";
import { getPostAuthDestination, readAccountProfile } from "@/lib/account-profile";

export default function HomePage() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState("Santo Domingo");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [personalInterests, setPersonalInterests] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todo");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);

      if (user?.emailVerified) {
        const profile = readAccountProfile();
        setPersonalInterests(
          profile.accountType === "personal" && profile.interests.length > 0
            ? profile.interests
            : []
        );
        const destination = getPostAuthDestination("/");
        if (destination !== "/") {
          router.replace(destination);
        }
        return;
      }

      setPersonalInterests([]);
    });
  }, [router]);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, []);

  const myListings = useMemo(
    () => listings.filter((item) => item.ownerId === currentUserId && item.status !== "sold"),
    [currentUserId, listings]
  );
  const marketplaceListings = useMemo(() => {
    const normalizedInterests = personalInterests.map(normalizeCategory);
    const normalizedActiveCategory = normalizeCategory(activeCategory);

    return listings.filter((item) => {
      if (item.ownerId === currentUserId) return false;
      if (item.status === "sold") return false;
      if (normalizeLocation(item.location) !== normalizeLocation(selectedLocation)) return false;

      const listingType = item.type || "article";
      const hasVisibleBazarItems = (item.bazarItems || []).some((entry) => entry.status !== "sold");

      if (normalizedActiveCategory === "bazar") {
        return listingType === "bazar" && hasVisibleBazarItems;
      }

      if (normalizedActiveCategory !== "todo") {
        if (listingType === "bazar") return false;
        return normalizeCategory(item.category?.trim() || "General") === normalizedActiveCategory;
      }

      if (listingType === "bazar") {
        return hasVisibleBazarItems;
      }

      if (normalizedInterests.length === 0) return true;

      return normalizedInterests.includes(normalizeCategory(item.category?.trim() || "General"));
    });
  }, [activeCategory, currentUserId, listings, personalInterests, selectedLocation]);
  const listingsByCategory = useMemo(() => {
    const categories = new Map<string, Listing[]>();

    marketplaceListings.forEach((item) => {
      if ((item.type || "article") === "bazar") return;
      const categoryName = item.category?.trim() || "General";
      const existing = categories.get(categoryName) || [];
      categories.set(categoryName, [...existing, item]);
    });

    return Array.from(categories.entries());
  }, [marketplaceListings]);
  const isBazarView = normalizeCategory(activeCategory) === "bazar";
  const visibleBazaars = useMemo(() => {
    const seen = new Set<string>();

    return marketplaceListings.filter((item) => {
      if ((item.type || "article") !== "bazar") return false;
      const signature = [item.ownerId, item.title.trim().toLowerCase(), item.category.trim().toLowerCase()].join("|");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }, [marketplaceListings]);
  const showBazarSectionInTodo = normalizeCategory(activeCategory) === "todo" && visibleBazaars.length > 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <HomeHeader
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        listings={marketplaceListings}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <div className="pt-40">
        <HomeHero />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-5">
        {currentUserId ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
              <span>Mis publicaciones</span>
              <Link href="/item/new" className="text-xs text-orange-400 hover:text-orange-200">
                Crear nueva
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {myListings.length === 0 ? (
                <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3 text-sm text-neutral-400">
                  Aun no tienes publicaciones. Crea una para verla aqui.
                </div>
              ) : (
                myListings.map((item) => (
                  <Link
                    key={item.id}
                    href={`/item/${item.id}`}
                    className="min-w-[140px] max-w-[160px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 shadow-sm"
                  >
                    <div className="relative mb-2 h-28 w-full overflow-hidden rounded-[18px]">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-neutral-800" />
                      )}
                    </div>
                    <div className="text-xs text-neutral-300 line-clamp-2">{item.title}</div>
                    {item.type === "bazar" ? (
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Bazar</div>
                    ) : null}
                    <div className="mt-1 text-sm font-semibold text-orange-400">
                      RD${item.price.toLocaleString()}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        ) : null}

        {listingsByCategory.length === 0 && !showBazarSectionInTodo ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="text-sm text-neutral-400">
              {personalInterests.length > 0
                ? `No hay publicaciones disponibles en ${selectedLocation} para tus intereses seleccionados.`
                : `No hay publicaciones disponibles en ${selectedLocation}.`}
            </div>
          </section>
        ) : isBazarView ? (
          <div className="space-y-4">
            {visibleBazaars.map((item) => (
              <Link
                key={item.id}
                href={`/item/${item.id}`}
                className="block overflow-hidden rounded-[26px] border border-neutral-800 bg-neutral-950/80 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-400 bg-neutral-200 text-sm font-bold text-neutral-950">
                      {getInitials(item.ownerName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-neutral-100">{item.title}</div>
                      <div className="text-xs text-neutral-400">{item.ownerName}</div>
                    </div>
                  </div>
                  <div className="flex h-11 items-center rounded-xl border border-neutral-700 px-5 text-sm font-semibold text-neutral-100">
                    Seguir
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  {(item.bazarItems || [])
                    .filter((bazarItem) => bazarItem.status !== "sold")
                    .map((bazarItem) => (
                    <div
                      key={bazarItem.id}
                      className="min-w-[168px] max-w-[168px] rounded-[24px] border border-neutral-800 bg-neutral-950 p-3"
                    >
                      <div className="h-36 w-full overflow-hidden rounded-[20px] bg-neutral-800">
                        {bazarItem.image ? (
                          <img src={bazarItem.image} alt={bazarItem.title} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="mt-3 text-base text-neutral-200 line-clamp-2">{bazarItem.title}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
                        {item.bazarCategory || item.category}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-orange-400">
                        RD${Number(bazarItem.price).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            {showBazarSectionInTodo ? (
              <div>
                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
                  <span>Bazar</span>
                  <Link href="/" className="text-xs text-orange-400 hover:text-orange-200" onClick={(e) => {
                    e.preventDefault();
                    setActiveCategory("Bazar");
                  }}>
                    Ver más
                  </Link>
                </div>
                <div className="space-y-4">
                  {visibleBazaars.map((item) => (
                    <Link
                      key={item.id}
                      href={`/item/${item.id}`}
                      className="block overflow-hidden rounded-[26px] border border-neutral-800 bg-neutral-950/80 p-4 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-orange-400 bg-neutral-200 text-sm font-bold text-neutral-950">
                            {getInitials(item.ownerName)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-neutral-100">{item.title}</div>
                            <div className="text-xs text-neutral-400">{item.ownerName}</div>
                          </div>
                        </div>
                        <div className="flex h-11 items-center rounded-xl border border-neutral-700 px-5 text-sm font-semibold text-neutral-100">
                          Seguir
                        </div>
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {(item.bazarItems || [])
                          .filter((bazarItem) => bazarItem.status !== "sold")
                          .map((bazarItem) => (
                          <div
                            key={bazarItem.id}
                            className="min-w-[168px] max-w-[168px] rounded-[24px] border border-neutral-800 bg-neutral-950 p-3"
                          >
                            <div className="h-36 w-full overflow-hidden rounded-[20px] bg-neutral-800">
                              {bazarItem.image ? (
                                <img src={bazarItem.image} alt={bazarItem.title} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="mt-3 text-base text-neutral-200 line-clamp-2">{bazarItem.title}</div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
                              {item.bazarCategory || item.category}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-orange-400">
                              RD${Number(bazarItem.price).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {listingsByCategory.map(([categoryName, categoryListings]) => (
              <section key={categoryName} className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
                  <span>{categoryName}</span>
                  <Link href="/descubre" className="text-xs text-orange-400 hover:text-orange-200">
                    Ver más
                  </Link>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {categoryListings.map((item) => (
                    <Link
                      key={item.id}
                      href={`/item/${item.id}`}
                      className="min-w-[140px] max-w-[160px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 shadow-sm"
                    >
                      <div className="relative mb-2 h-28 w-full overflow-hidden rounded-[18px]">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-neutral-800" />
                        )}
                      </div>
                      <div className="text-xs text-neutral-300 line-clamp-2">{item.title}</div>
                      <div className="mt-1 text-sm font-semibold text-orange-400">
                        RD${item.price.toLocaleString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
          <NavIcon icon={Home} label="Inicio" href="/" active />
          <NavIcon icon={Navigation} label="Descubre" href="/descubre" />
          <NavIcon icon={PlusSquare} label="Crear" href="/item/new" />
          <NavIcon icon={MessageCircle} label="Negociacion" href="/messages" />
          <NavIcon icon={User} label="Perfil" href="/profile/me" />
        </div>
      </nav>
    </div>
  );
}

function normalizeLocation(location: string) {
  const normalized = location.trim().toLowerCase();
  if (normalized === "sdn") return "santo domingo";
  return normalized;
}

function normalizeCategory(category: string) {
  return category
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}

function NavIcon({
  icon: Icon,
  label,
  href,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1 hover:text-white",
    active ? "text-orange-400" : "text-neutral-400",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        <Icon className="h-5 w-5" />
        <span className="text-[11px] hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button className={className} aria-label={label}>
      <Icon className="h-5 w-5" />
      <span className="text-[11px] hidden sm:inline">{label}</span>
    </button>
  );
}
