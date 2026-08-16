"use client";

import Link from "next/link";
import AppBottomNav from "@/components/AppBottomNav";
import HomeHeader from "@/components/HomeHeader";
import HomeHero from "@/components/HomeHero";
import HomeBazarCard from "@/components/HomeBazarCard";
import HomeSplashScreen from "@/components/HomeSplashScreen";
import { MapPin, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
import { subscribeFollowingIds } from "@/lib/follows";
import {
  ChatRecord,
  getActiveBazarItems,
  getListingById,
  isListingVisibleInMarketplace,
  isListingVisibleInOwnerProfile,
  Listing,
  searchListings,
  subscribeInboxChatsForUser,
} from "@/lib/marketplace";
import { getPostAuthDestination, loadAccountProfileFromBackend, readAccountProfile } from "@/lib/account-profile";
import {
  getDefaultListingLocation,
  loadStoredUserLocationFromBackend,
  normalizeLocationName,
  readStoredUserLocation,
  requestCurrentSupportedLocation,
  saveManualListingLocation,
  shouldAutoRefreshCurrentLocation,
} from "@/lib/location";
import { formatBazarTimeLeftShort } from "@/lib/bazar-duration";
import { appCategories, getCanonicalCategoryName, normalizeCategoryName } from "@/lib/categories";
import { formatListingAge } from "@/lib/relative-time";
import { useThemeSetting } from "@/components/ThemeProvider";

type PendingReviewRequest = {
  id: string;
  itemTitle: string;
  sellerName: string;
};

type PendingTradeOffer = {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerId?: string;
  sellerName?: string;
  createdAt: number;
};

export default function HomePage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const [selectedLocation, setSelectedLocation] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [recentChats, setRecentChats] = useState<ChatRecord[]>([]);
  const [recentChatListings, setRecentChatListings] = useState<Record<string, Listing>>({});
  const [pendingReviews, setPendingReviews] = useState<PendingReviewRequest[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [pendingTradeOffer, setPendingTradeOffer] = useState<PendingTradeOffer | null>(null);
  const [bazarNow, setBazarNow] = useState(Date.now());
  const [personalInterests, setPersonalInterests] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("Todo");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");

      if (user?.emailVerified) {
        void loadAccountProfileFromBackend(user.uid).then((profile) => {
          setPersonalInterests(
            profile.accountType === "personal" && profile.interests.length > 0
              ? profile.interests
              : []
          );
        });
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
    const intervalId = window.setInterval(() => setBazarNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const loadPendingTradeOffer = () => {
      try {
        const raw = localStorage.getItem("pending_trade_offer");
        if (!raw) {
          setPendingTradeOffer(null);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<PendingTradeOffer>;
        if (!parsed.listingId || !parsed.createdAt || Date.now() - Number(parsed.createdAt) > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem("pending_trade_offer");
          setPendingTradeOffer(null);
          return;
        }

        setPendingTradeOffer({
          listingId: parsed.listingId,
          listingTitle: parsed.listingTitle || "publicación",
          listingPrice: Number(parsed.listingPrice || 0),
          sellerId: parsed.sellerId,
          sellerName: parsed.sellerName,
          createdAt: Number(parsed.createdAt),
        });
      } catch {
        setPendingTradeOffer(null);
      }
    };

    loadPendingTradeOffer();
    window.addEventListener("storage", loadPendingTradeOffer);
    window.addEventListener("focus", loadPendingTradeOffer);

    return () => {
      window.removeEventListener("storage", loadPendingTradeOffer);
      window.removeEventListener("focus", loadPendingTradeOffer);
    };
  }, []);

  useEffect(() => {
    setPreferredLocation(getDefaultListingLocation());

    const storedLocation = readStoredUserLocation();
    if (storedLocation?.name) {
      setPreferredLocation(storedLocation.name);
    }

    if (shouldAutoRefreshCurrentLocation()) {
      requestCurrentSupportedLocation()
        .then((location) => {
          setPreferredLocation(location.name);
        })
        .catch(() => {
          // Keep the saved/manual selection when geolocation is unavailable or denied.
        });
    }

    void loadStoredUserLocationFromBackend().then((location) => {
      if (location?.name) setPreferredLocation(location.name);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const normalizedActiveCategory = normalizeCategory(activeCategory);
    const category =
      normalizedActiveCategory !== "todo" && normalizedActiveCategory !== "bazar"
        ? activeCategory
        : undefined;
    const type = normalizedActiveCategory === "bazar" ? "bazar" : undefined;

    searchListings({
      category,
      location: selectedLocation || undefined,
      status: "active",
      type,
      limit: 80,
    })
      .then((result) => {
        if (!cancelled) setListings(result.items);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory, selectedLocation]);

  useEffect(() => {
    if (!currentUserId) {
      setMyListings([]);
      return;
    }

    let cancelled = false;
    searchListings({
      ownerId: currentUserId,
      status: "active",
      limit: 20,
    })
      .then((result) => {
        if (!cancelled) setMyListings(result.items.filter(isListingVisibleInOwnerProfile));
      })
      .catch(() => {
        if (!cancelled) setMyListings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setFollowingIds(new Set());
      return;
    }

    const unsub = subscribeFollowingIds(currentUserId, setFollowingIds);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setRecentChats([]);
      setPendingReviews([]);
      return;
    }

    return subscribeInboxChatsForUser(
      currentUserId,
      (rows) => setRecentChats(rows.slice(0, 5)),
      () => setRecentChats([])
    );
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    const load = async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch("/api/reviews", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { requests?: PendingReviewRequest[] };
      if (!cancelled) setPendingReviews(payload.requests || []);
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUserId]);

  const activeReview = pendingReviews[0] || null;
  const submitReview = async (action: "submit" | "skip") => {
    if (!activeReview || submittingReview) return;
    if (action === "submit" && !reviewRating) return;
    setSubmittingReview(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: activeReview.id,
          action,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      if (!response.ok) return;
      setPendingReviews((current) => current.filter((request) => request.id !== activeReview.id));
      setReviewRating(0);
      setReviewComment("");
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (recentChats.length === 0) {
      setRecentChatListings({});
      return;
    }

    let cancelled = false;
    const listingIds = Array.from(new Set(recentChats.map((chat) => chat.listingId).filter(Boolean)));

    Promise.all(
      listingIds.map(async (listingId) => {
        const listing = await getListingById(listingId);
        return listing ? [listingId, listing] as const : null;
      })
    )
      .then((rows) => {
        if (cancelled) return;
        setRecentChatListings(
          Object.fromEntries(rows.filter((row): row is readonly [string, Listing] => Boolean(row)))
        );
      })
      .catch(() => {
        if (!cancelled) setRecentChatListings({});
      });

    return () => {
      cancelled = true;
    };
  }, [recentChats]);

  const marketplaceListings = useMemo(() => {
    const normalizedInterests = personalInterests.map(normalizeCategory);
    const normalizedActiveCategory = normalizeCategory(activeCategory);
    const targetLocation = normalizeLocation(selectedLocation || preferredLocation || "");
    const getInterestMatch = (item: Listing) => {
      if (normalizedInterests.length === 0) return 0;
      const category = normalizeCategoryName(item.category?.trim() || "General");
      const bazarCategory = normalizeCategoryName(item.bazarCategory?.trim() || "");
      return normalizedInterests.includes(category) || (bazarCategory ? normalizedInterests.includes(bazarCategory) : false)
        ? 1
        : 0;
    };
    const getLocationMatch = (item: Listing) => {
      if (!targetLocation) return 0;
      return normalizeLocation(item.location) === targetLocation ? 1 : 0;
    };

    return listings
      .filter((item) => {
        if (item.ownerId === currentUserId) return false;
        if (!isListingVisibleInMarketplace(item)) return false;
        if (selectedLocation && normalizeLocation(item.location) !== normalizeLocation(selectedLocation)) return false;

        const listingType = item.type || "article";
        const hasVisibleBazarItems = getActiveBazarItems(item).length > 0;

        if (normalizedActiveCategory === "bazar") {
          return listingType === "bazar" && hasVisibleBazarItems;
        }

        if (normalizedActiveCategory !== "todo") {
          if (listingType === "bazar") return false;
          return normalizeCategoryName(item.category?.trim() || "General") === normalizedActiveCategory;
        }

        if (listingType === "bazar") {
          return hasVisibleBazarItems;
        }

        return true;
      })
      .sort((a, b) => {
        const aFollowed = followingIds.has(a.ownerId) ? 1 : 0;
        const bFollowed = followingIds.has(b.ownerId) ? 1 : 0;
        if (aFollowed !== bFollowed) return bFollowed - aFollowed;

        const aNear = getLocationMatch(a);
        const bNear = getLocationMatch(b);
        if (aNear !== bNear) return bNear - aNear;

        const aInterested = getInterestMatch(a);
        const bInterested = getInterestMatch(b);
        if (aInterested !== bInterested) return bInterested - aInterested;

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [activeCategory, currentUserId, followingIds, listings, personalInterests, preferredLocation, selectedLocation]);
  const visibleRecentChats = useMemo(() => {
    return recentChats.filter((chat) => {
      const listing = recentChatListings[chat.listingId];
      if (!chat.listingId) return true;
      if (!Object.prototype.hasOwnProperty.call(recentChatListings, chat.listingId)) return false;

      return listing?.status !== "sold";
    });
  }, [recentChatListings, recentChats]);
  const listingsByCategory = useMemo(() => {
    const categories = new Map<string, Listing[]>();

    marketplaceListings.forEach((item) => {
      if ((item.type || "article") === "bazar") return;
      const categoryName = getCanonicalCategoryName(item.category?.trim() || "General");
      const existing = categories.get(categoryName) || [];
      categories.set(categoryName, [...existing, item]);
    });

    return Array.from(categories.entries());
  }, [marketplaceListings]);
  const isBazarView = normalizeCategory(activeCategory) === "bazar";
  const visibleBazaars = useMemo(() => {
    return marketplaceListings.filter((item) => {
      if ((item.type || "article") !== "bazar") return false;
      return true;
    });
  }, [marketplaceListings]);
  const showBazarSectionInTodo = normalizeCategory(activeCategory) === "todo" && visibleBazaars.length > 0;
  const lightHomeBackground =
    theme === "light"
      ? {
          background:
            "radial-gradient(circle at 18% 0%, rgba(var(--brand-primary-rgb), 0.34), transparent 34%), radial-gradient(circle at 88% 8%, rgba(255, 218, 172, 0.58), transparent 30%), linear-gradient(180deg, #ffe4bd 0%, #fff2df 26%, #fffaf4 48%, #ffffff 100%)",
        }
      : undefined;

  return (
    <div className="home-page min-h-screen bg-neutral-950 text-neutral-50" style={lightHomeBackground}>
      <HomeSplashScreen />
      <HomeHeader
        selectedLocation={selectedLocation}
        preferredLocation={preferredLocation}
        onLocationChange={(location) => {
          setSelectedLocation(location);
          if (location) {
            setPreferredLocation(location);
            saveManualListingLocation(location);
          }
        }}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <div className="px-4 pt-48 md:mx-auto md:max-w-6xl md:pt-40">
        <HomeHero />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-5">
        {pendingTradeOffer ? (
          <section className="rounded-[22px] border border-orange-400/30 bg-orange-400/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-orange-100">Continúa tu oferta</div>
                <div className="mt-1 truncate text-xs text-orange-100/70">
                  Termina tu oferta para {pendingTradeOffer.listingTitle}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/item/${pendingTradeOffer.listingId}?continueOffer=1`)}
                className="h-11 rounded-2xl bg-orange-400 px-5 text-sm font-semibold text-black hover:bg-orange-300"
              >
                Continuar tu oferta
              </button>
            </div>
          </section>
        ) : null}

        {activeReview ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="text-base font-semibold text-neutral-100">
              ¿Cómo valoras tu experiencia comprando el &quot;{activeReview.itemTitle}&quot; con {activeReview.sellerName}?
            </div>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewRating(value)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-400"
                  aria-label={`${value} estrellas`}
                >
                  <Star className={value <= reviewRating ? "h-5 w-5 fill-orange-400 text-orange-400" : "h-5 w-5"} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Agregar comentario"
              className="mt-3 min-h-20 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-orange-400"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void submitReview("skip")}
                disabled={submittingReview}
                className="h-11 flex-1 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-neutral-200 disabled:opacity-60"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => void submitReview("submit")}
                disabled={submittingReview || !reviewRating}
                className="h-11 flex-1 rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black disabled:opacity-60"
              >
                Publicar
              </button>
            </div>
          </section>
        ) : null}

        {currentUserId && visibleRecentChats.length > 0 ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
              <span>Negociaciones recientes</span>
              <Link href="/messages" className="text-xs text-neutral-400 hover:text-neutral-200">
                Ver todas
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {visibleRecentChats.map((chat) => {
                const listing = recentChatListings[chat.listingId];
                const image = listing?.image || "";
                const price = Number(listing?.price || chat.listingPrice || 0);
                const location = listing?.location || "Santo Domingo";
                const isSelling = chat.sellerId === currentUserId;
                const ageLabel = formatListingAge(Number(listing?.createdAt || chat.createdAt || 0));

                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    className="relative min-w-[160px] max-w-[180px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 shadow-sm"
                  >
                    <div className="relative mb-2 h-28 w-full overflow-hidden rounded-[18px] bg-neutral-800">
                      {image ? (
                        <img src={image} alt={chat.listingTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                          Sin foto
                        </div>
                      )}
                      <span
                        className={[
                          "absolute left-2 top-2 rounded-full border border-orange-400/40 bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm",
                          isSelling ? "text-orange-400" : "text-white",
                        ].join(" ")}
                      >
                        {isSelling ? "vendiendo" : "comprando"}
                      </span>
                    </div>
                    <div className="listing-price text-sm font-bold text-orange-400">
                      RD${price.toLocaleString()}
                    </div>
                    <div className="listing-title mt-1 truncate text-xs font-medium text-neutral-300">{chat.listingTitle}</div>
                    <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-neutral-500">
                      <div className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{location}</span>
                      </div>
                      {ageLabel ? <span className="shrink-0">{ageLabel}</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {currentUserId ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
              <span>Mis publicaciones</span>
              <Link href="/item/new" className="text-xs text-neutral-400 hover:text-neutral-200">
                Crear nueva
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {myListings.length === 0 ? (
                <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/10 p-3 text-sm text-neutral-400">
                  Aun no tienes publicaciones. Crea una para verla aqui.
                </div>
              ) : (
                myListings.map((item) => (
                  (() => {
                    const activeBazarItems = item.type === "bazar" ? getActiveBazarItems(item) : [];
                    const displayPrice =
                      item.type === "bazar"
                        ? activeBazarItems.reduce((sum, bazarItem) => sum + Number(bazarItem.price || 0), 0)
                        : item.price;
                    const bazarTimeLeft =
                      item.type === "bazar" && item.bazarEndsAt
                        ? formatBazarTimeLeftShort(item.bazarEndsAt, bazarNow)
                        : "";
                    const ageLabel = formatListingAge(item.createdAt, bazarNow);

                    return (
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
                      {item.type === "bazar" ? (
                        <div className="absolute bottom-2 right-2 flex h-10 min-w-10 items-center justify-center rounded-[18px] border border-white/15 bg-neutral-900/95 px-3 text-lg font-medium text-white shadow-sm">
                          {activeBazarItems.length}
                        </div>
                      ) : null}
                      {bazarTimeLeft ? (
                        <div className="absolute left-2 top-2 rounded-full border border-orange-400/40 bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-400 shadow-sm">
                          Acaba en {bazarTimeLeft}
                        </div>
                      ) : null}
                    </div>
                    <div className="listing-price text-sm font-bold text-orange-400">
                      RD${displayPrice.toLocaleString()}
                    </div>
                    {item.type === "bazar" ? (
                      <div className="mt-1 flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-300">Bazar</span>
                        <span className="listing-title min-w-0 truncate text-xs font-medium text-neutral-300">{item.title}</span>
                      </div>
                    ) : (
                      <div className="listing-title mt-1 truncate text-xs font-medium text-neutral-300">{item.title}</div>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-neutral-500">
                      <div className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.location || "Santo Domingo"}</span>
                      </div>
                      {ageLabel ? <span className="shrink-0">{ageLabel}</span> : null}
                    </div>
                  </Link>
                    );
                  })()
                ))
              )}
            </div>
          </section>
        ) : null}

        {isBazarView ? (
          visibleBazaars.length === 0 ? (
            <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
              <div className="text-sm text-neutral-400">
                No hay bazares disponibles en {selectedLocation || "todas las ubicaciones"}.
              </div>
            </section>
          ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-neutral-100">Bazar</span>
              <span className="text-orange-400">Live</span>
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
            </div>
            {visibleBazaars.map((item) => (
              <HomeBazarCard
                key={item.id}
                item={item}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                isFollowing={followingIds.has(item.ownerId)}
                onFollowed={(userId) =>
                  setFollowingIds((current) => {
                    const next = new Set(current);
                    next.add(userId);
                    return next;
                  })
                }
              />
            ))}
          </div>
          )
        ) : listingsByCategory.length === 0 && !showBazarSectionInTodo ? (
          <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="text-sm text-neutral-400">
              No hay publicaciones disponibles en {selectedLocation || "todas las ubicaciones"}.
            </div>
          </section>
        ) : (
          <>
            {showBazarSectionInTodo ? (
              <div>
                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
                  <span className="flex items-center gap-2">
                    <span className="text-neutral-100">Bazar</span>
                    <span className="text-orange-400">Live</span>
                    <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                  </span>
                  <Link
                    href="/"
                    className="text-xs text-neutral-400 hover:text-neutral-200"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveCategory("Bazar");
                    }}
                  >
                    Ver más
                  </Link>
                </div>
                <div className="space-y-4">
                  {visibleBazaars.map((item) => (
                    <HomeBazarCard
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                      isFollowing={followingIds.has(item.ownerId)}
                      onFollowed={(userId) =>
                        setFollowingIds((current) => {
                          const next = new Set(current);
                          next.add(userId);
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {listingsByCategory.map(([categoryName, categoryListings]) => (
              <section key={categoryName} className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
                  <span>{categoryName}</span>
                  <Link href={getCategoryHref(categoryName)} className="text-xs text-neutral-400 hover:text-neutral-200">
                    Ver más
                  </Link>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {categoryListings.map((item) => {
                    const ageLabel = formatListingAge(item.createdAt, bazarNow);

                    return (
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
                      <div className="listing-price text-sm font-bold text-orange-400">
                        RD${item.price.toLocaleString()}
                      </div>
                      <div className="listing-title mt-1 truncate text-xs font-medium text-neutral-300">{item.title}</div>
                      <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-neutral-500">
                        <div className="flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.location || "Santo Domingo"}</span>
                        </div>
                        {ageLabel ? <span className="shrink-0">{ageLabel}</span> : null}
                      </div>
                    </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      <AppBottomNav active="home" />
    </div>
  );
}

function normalizeLocation(location: string) {
  return normalizeLocationName(location);
}

function normalizeCategory(category: string) {
  return normalizeCategoryName(category);
}

function getCategoryHref(categoryName: string) {
  const category = appCategories.find(
    (item) => normalizeCategoryName(item.name) === normalizeCategoryName(categoryName)
  );

  return category ? `/categories/${category.id}` : "/categories";
}
