"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { GalleryHorizontalEnd, Heart, MapPin, Share2, StretchHorizontal, X } from "lucide-react";
import AppBottomNav from "@/components/AppBottomNav";
import ItemCard from "@/components/ItemCard";
import Navbar from "@/components/Navbar";
import SellerAvatar from "@/components/SellerAvatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { subscribeAccountProfile } from "@/lib/account-profile";
import { normalizeCategoryName } from "@/lib/categories";
import { auth } from "@/lib/firebase";
import { getLikeRecordId, likeItem, subscribeLikeIdsForUser } from "@/lib/likes";
import { getActiveBazarItems, Listing, searchListings } from "@/lib/marketplace";
import { subscribeVerifiedUser } from "@/lib/user-verified";

type DiscoverItem = {
  id: string;
  listingId: string;
  bazarItemId?: string;
  href: string;
  title: string;
  price: number;
  category: string;
  location: string;
  image?: string;
  description?: string;
  tags?: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  createdAt?: number;
};

const SWIPE_HINT_STORAGE_KEY = "josealo_discover_swipe_hint_seen";

function textMatchesSpecificInterests(values: Array<string | undefined>, specificInterestKeys: Set<string>) {
  if (specificInterestKeys.size === 0) return false;

  const searchableText = normalizeCategoryName(values.filter(Boolean).join(" "));

  return Array.from(specificInterestKeys).some((interest) => searchableText.includes(interest));
}

export default function DiscoverPage() {
  const router = useRouter();
  const [items, setItems] = useState<Listing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [authResolved, setAuthResolved] = useState(false);
  const [specificInterestKeys, setSpecificInterestKeys] = useState<Set<string>>(new Set());
  const [interestsLoaded, setInterestsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "swipe">("list");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [likedRecordIds, setLikedRecordIds] = useState<Set<string>>(new Set());
  const [swipeSessionTotal, setSwipeSessionTotal] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [heartBurstId, setHeartBurstId] = useState("");
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await searchListings({ status: "active", limit: 160 });
      if (!cancelled) setItems(result.items);
    };

    void load().catch(() => {
      if (!cancelled) setItems([]);
    });
    const intervalId = window.setInterval(() => {
      void load().catch(() => {});
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const unsub = subscribeLikeIdsForUser(currentUserId, setLikedRecordIds);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    const unsub = subscribeAccountProfile((profile) => {
      setSpecificInterestKeys(
        new Set(profile.specificInterests.map((interest) => normalizeCategoryName(interest)).filter(Boolean))
      );
      setInterestsLoaded(true);
    });

    return () => unsub();
  }, []);

  const hasSelectedInterests = specificInterestKeys.size > 0;

  const renderedItems = useMemo(() => {
    return items
      .flatMap<DiscoverItem>((item) => {
        if (item.ownerId === currentUserId || item.status === "sold") return [];

        const listingType = item.type || "article";
        const listingCategory = item.bazarCategory || item.category;

        if (listingType === "bazar") {
          return getActiveBazarItems(item)
            .filter((bazarItem) => {
              return textMatchesSpecificInterests(
                [
                  bazarItem.title,
                  bazarItem.description,
                  listingCategory,
                  item.title,
                  item.description,
                  ...(item.tags || []),
                ],
                specificInterestKeys
              );
            })
            .map((bazarItem) => ({
              id: `${item.id}__${bazarItem.id}`,
              listingId: item.id,
              bazarItemId: bazarItem.id,
              href: `/item/${item.id}?bazarItemId=${bazarItem.id}`,
              title: bazarItem.title,
              price: bazarItem.price,
              category: listingCategory,
              location: item.location,
              image: bazarItem.image,
              description: bazarItem.description,
              tags: item.tags,
              sellerId: item.ownerId,
              sellerName: item.ownerName,
              sellerAvatar: item.ownerAvatar,
              createdAt: item.createdAt,
            }));
        }

        if (
          !textMatchesSpecificInterests(
            [item.title, item.description, item.category, ...(item.tags || [])],
            specificInterestKeys
          )
        ) {
          return [];
        }

        return [
          {
            id: item.id,
            listingId: item.id,
            href: `/item/${item.id}`,
            title: item.title,
            price: item.price,
            category: item.category,
            location: item.location,
            image: item.image,
            description: item.description,
            tags: item.tags,
            sellerId: item.ownerId,
            sellerName: item.ownerName,
            sellerAvatar: item.ownerAvatar,
            createdAt: item.createdAt,
          },
        ];
      });
  }, [currentUserId, items, specificInterestKeys]);

  const swipeItems = useMemo(
    () =>
      renderedItems.filter((item) => {
        if (dismissedIds.has(item.id)) return false;
        if (!currentUserId) return true;
        return !likedRecordIds.has(getLikeRecordId(currentUserId, item.listingId, item.bazarItemId));
      }),
    [currentUserId, dismissedIds, likedRecordIds, renderedItems]
  );
  const activeItem = swipeItems[0];
  const effectiveSwipeTotal = swipeSessionTotal || renderedItems.length;
  const swipedCount = Math.min(dismissedIds.size, effectiveSwipeTotal);
  const swipeCounterText = `${swipedCount}/${effectiveSwipeTotal}`;

  const toggleSwipeMode = () => {
    const nextMode = viewMode === "list" ? "swipe" : "list";
    setViewMode(nextMode);
    setDragX(0);

    if (nextMode !== "swipe") return;

    setDismissedIds(new Set());
    setSwipeSessionTotal(
      renderedItems.filter((item) => {
        if (!currentUserId) return true;
        return !likedRecordIds.has(getLikeRecordId(currentUserId, item.listingId, item.bazarItemId));
      }).length
    );
    const hasSeenSwipeHint = window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === "true";
    if (!hasSeenSwipeHint) {
      window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, "true");
      setShowSwipeHint(true);
    }
  };

  const dismissItem = (itemId: string) => {
    setDismissedIds((current) => new Set(current).add(itemId));
    setDragX(0);
  };

  const handleLike = async (item: DiscoverItem) => {
    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent("/descubre")}`);
      return;
    }

    setHeartBurstId(item.id);
    await likeItem({
      actorId: currentUserId,
      actorName: currentUserName,
      ownerId: item.sellerId,
      ownerName: item.sellerName,
      listingId: item.listingId,
      ...(item.bazarItemId ? { bazarItemId: item.bazarItemId } : {}),
      itemTitle: item.title,
      image: item.image || "",
      price: item.price,
      location: item.location,
      href: item.href,
    });

    window.setTimeout(() => {
      dismissItem(item.id);
      setHeartBurstId("");
    }, 220);
  };

  const handleShare = async (item: DiscoverItem) => {
    const url = `${window.location.origin}${item.href}`;
    if (navigator.share) {
      await navigator.share({
        title: item.title,
        text: item.description || item.title,
        url,
      });
      return;
    }

    await navigator.clipboard?.writeText(url);
  };

  const handlePointerDown = (event: PointerEvent) => {
    pointerStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerStartXRef.current === null) return;
    const nextDragX = event.clientX - pointerStartXRef.current;
    setDragX(Math.max(-150, Math.min(150, nextDragX)));
  };

  const handlePointerUp = async () => {
    if (!activeItem) return;

    const finalDragX = dragX;
    pointerStartXRef.current = null;

    if (finalDragX <= -90) {
      dismissItem(activeItem.id);
      return;
    }

    if (finalDragX >= 90) {
      await handleLike(activeItem);
      return;
    }

    if (Math.abs(finalDragX) < 8) {
      router.push(activeItem.href);
      return;
    }

    setDragX(0);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar
        rightAction={
          authResolved && currentUserId && interestsLoaded && hasSelectedInterests ? (
            <button
              type="button"
              onClick={toggleSwipeMode}
              className="hidden h-10 w-10 items-center justify-center text-neutral-300 transition hover:text-white max-md:flex"
              aria-label={viewMode === "list" ? "Ver tarjetas" : "Ver lista"}
            >
              {viewMode === "list" ? (
                <GalleryHorizontalEnd className="h-5 w-5" />
              ) : (
                <StretchHorizontal className="h-5 w-5" />
              )}
            </button>
          ) : null
        }
      />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-24">
        {!authResolved || !interestsLoaded ? null : !currentUserId ? (
          <SignedOutDiscoverEmptyState />
        ) : !hasSelectedInterests ? (
          <ConfigureInterestsEmptyState />
        ) : (
            <>
              <section className={viewMode === "swipe" ? "hidden md:block" : ""}>
                {renderedItems.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800/5 bg-neutral-900/5 px-4 py-5 text-sm text-neutral-300">
                    No hay publicaciones disponibles para descubrir ahora mismo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {renderedItems.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>

              <section className={viewMode === "swipe" ? "md:hidden" : "hidden"} aria-label="Sugerencias">
                {activeItem ? (
                  <div className="relative mx-auto flex max-w-md flex-col items-center">
                    <div className="relative h-[calc(100vh-18rem)] min-h-[440px] w-full max-h-[620px]">
                      {swipeItems.slice(0, 3).map((item, index) => {
                        const isActive = index === 0;
                        const stackTransform = isActive
                          ? `translateX(${dragX}px) rotate(${dragX / 18}deg)`
                          : `translateY(${index * 12}px) scale(${1 - index * 0.04})`;
                        const swipeFade = Math.max(0, 1 - Math.abs(dragX) / 150);
                        const stackOpacity = isActive ? swipeFade : 1 - index * 0.12;

                        return (
                          <SwipeCard
                            key={item.id}
                            item={item}
                            active={isActive}
                            style={{
                              transform: stackTransform,
                              opacity: stackOpacity,
                              zIndex: 10 - index,
                            }}
                            onPointerDown={isActive ? handlePointerDown : undefined}
                            onPointerMove={isActive ? handlePointerMove : undefined}
                            onPointerUp={isActive ? handlePointerUp : undefined}
                            onPointerCancel={isActive ? handlePointerUp : undefined}
                            onShare={() => void handleShare(item)}
                          />
                        );
                      })}
                    </div>

                    <div className="relative z-30 -mt-9 flex items-center justify-center gap-4 pb-4">
                      <button
                        type="button"
                        onClick={() => dismissItem(activeItem.id)}
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-950/10 text-neutral-100 shadow-[0_18px_45px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-md transition active:scale-95"
                        aria-label="Descartar"
                      >
                        <X className="h-10 w-10" />
                      </button>
                      <div className="min-w-14 rounded-full bg-neutral-950 px-3 py-1.5 text-center text-xs font-semibold text-neutral-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                        {swipeCounterText}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleLike(activeItem)}
                        className={[
                          "flex h-20 w-20 items-center justify-center rounded-full bg-neutral-950/10 text-orange-400 shadow-[0_18px_45px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-md transition active:scale-95",
                          heartBurstId === activeItem.id ? "scale-110" : "",
                        ].join(" ")}
                        aria-label="Guardar like"
                      >
                        <Heart
                          className={[
                            "h-10 w-10 transition-all duration-200",
                            heartBurstId === activeItem.id
                              ? "scale-125 fill-current  drop-shadow-[0_0_14px_rgba(251,146,60,0.85)]"
                              : "",
                          ].join(" ")}
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="discover-empty-card mx-auto flex min-h-[calc(100vh-14rem)] max-w-md flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/70 px-6 text-center">
                    <div className="text-lg font-semibold text-neutral-50">No hay mas sugerencias para ti hoy</div>
                    <p className="mt-3 text-sm leading-6 text-neutral-400">
                      Haz click en Ver Likes para ver todos tus articulos guardados.
                    </p>
                    <Link
                      href="/activity?tab=likes"
                      className="mt-6 rounded-2xl bg-orange-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-300"
                    >
                      Ver Likes
                    </Link>
                  </div>
                )}
              </section>
          </>
        )}
      </main>

      {showSwipeHint ? <SwipeHintOverlay onDismiss={() => setShowSwipeHint(false)} /> : null}
      <AppBottomNav active="discover" />
    </div>
  );
}

function ConfigureInterestsEmptyState() {
  return (
    <div className="discover-empty-card mx-auto flex min-h-[calc(100vh-14rem)] max-w-md flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/70 px-6 text-center">
      <div className="text-lg font-semibold text-neutral-50">Configura tu Para ti</div>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Agrega intereses específicos para que esta sección muestre artículos relacionados con lo que estás buscando.
      </p>
      <Link
        href="/settings/interests"
        className="mt-6 rounded-2xl bg-orange-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-300"
      >
        Configurar "Para ti"
      </Link>
    </div>
  );
}

function SignedOutDiscoverEmptyState() {
  return (
    <div className="discover-empty-card mx-auto flex min-h-[calc(100vh-14rem)] max-w-md flex-col items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900/70 px-6 text-center">
      <div className="text-lg font-semibold text-neutral-50">No has iniciado sesión aún</div>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Haz click en acceder para entrar o crear tu cuenta.
      </p>
      <Link
        href={`/sign-in?next=${encodeURIComponent("/descubre")}`}
        className="mt-6 rounded-2xl bg-orange-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-orange-300"
      >
        Acceder
      </Link>
    </div>
  );
}

function SwipeHintOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      className="fixed inset-0 z-[80] bg-black/50"
      onClick={onDismiss}
      aria-label="Cerrar guia de swipe"
    >
      <span className="swipe-prompt-box" aria-hidden="true">
        <span className="swipe-tapperoo" />
        <svg
          className="swipe-tap-gesture"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          fill="#fff"
        >
          <path d="M416,149.333c-8.768,0-16.939,2.667-23.723,7.211C386.432,139.947,370.581,128,352,128c-8.768,0-16.939,2.667-23.723,7.211c-5.845-16.597-21.696-28.544-40.277-28.544c-7.765,0-15.061,2.091-21.333,5.739V42.667C266.667,19.136,247.531,0,224,0s-42.667,19.136-42.667,42.667v249.408l-58.645-29.333C113.856,258.325,103.957,256,94.08,256c-22.485,0-40.747,18.283-40.747,40.875c0,10.901,4.245,21.12,11.947,28.821l137.941,137.941C234.389,494.827,275.883,512,320,512c76.459,0,138.667-62.208,138.667-138.667V192C458.667,168.469,439.531,149.333,416,149.333z M437.333,373.333c0,64.704-52.651,117.333-117.355,117.333c-38.421,0-74.517-14.955-101.653-42.133L80.363,310.592c-3.669-3.648-5.696-8.533-5.696-13.845c0-10.709,8.704-19.413,19.413-19.413c6.592,0,13.163,1.557,19.072,4.501l74.091,37.035c3.307,1.643,7.253,1.472,10.368-0.469c3.136-1.941,5.056-5.376,5.056-9.067V42.667c0-11.755,9.557-21.333,21.333-21.333s21.333,9.579,21.333,21.333v202.667c0,5.888,4.779,10.667,10.667,10.667c5.888,0,10.667-4.779,10.667-10.667v-96c0-11.755,9.557-21.333,21.333-21.333s21.333,9.579,21.333,21.333v96c0,5.888,4.779,10.667,10.667,10.667s10.667-4.779,10.667-10.667v-74.667c0-11.755,9.557-21.333,21.333-21.333s21.333,9.579,21.333,21.333v74.667c0,5.888,4.779,10.667,10.667,10.667c5.888,0,10.667-4.779,10.667-10.667V192c0-11.755,9.557-21.333,21.333-21.333s21.333,9.579,21.333,21.333V373.333z" />
        </svg>
      </span>

      <style>{`
        .swipe-prompt-box {
          height: 100px;
          width: 100px;
          transform: translate(-50%, -50%);
          position: absolute;
          top: 50%;
          left: 55%;
          opacity: 1;
          transition: 300ms;
          pointer-events: none;
          z-index: 1000;
          display: block;
        }

        .swipe-tapperoo {
          height: 48px;
          width: 100px;
          position: absolute;
          top: -5px;
          left: 50px;
          border-radius: 100px;
          background-color: #fff;
          z-index: -1;
          animation: swipe-tapperoo 3s infinite;
          display: block;
        }

        .swipe-tap-gesture {
          position: absolute;
          inset: 0;
          transform: rotate(30deg);
          animation: swipe-hand-move 3s infinite;
        }

        @keyframes swipe-tapperoo {
          0% {
            height: 25%;
            width: 25%;
          }

          50% {
            height: 5%;
            width: 35%;
            opacity: 0;
            transform: translate(-250%);
          }

          100% {
            opacity: 0;
          }
        }

        @keyframes swipe-hand-move {
          0% {
            transform: rotate(30deg);
          }

          50% {
            transform: translate(-60%, -10%) rotate(-30deg) scale(0.9);
          }

          100% {
            transform: rotate(30deg);
          }
        }
      `}</style>
    </button>
  );
}

function SwipeCard({
  item,
  active,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onShare,
}: {
  item: DiscoverItem;
  active: boolean;
  style: CSSProperties;
  onPointerDown?: (event: PointerEvent) => void;
  onPointerMove?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
  onPointerCancel?: (event: PointerEvent) => void;
  onShare: () => void;
}) {
  const [sellerVerified, setSellerVerified] = useState(false);

  useEffect(() => {
    const unsub = subscribeVerifiedUser(item.sellerId, setSellerVerified);
    return () => unsub();
  }, [item.sellerId]);

  return (
    <article
      className={[
        "absolute inset-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 shadow-2xl transition-[opacity,transform]",
        active ? "touch-none duration-150" : "pointer-events-none duration-300",
      ].join(" ")}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between">
        <Link
          href={`/profile/${item.sellerId}?name=${encodeURIComponent(item.sellerName)}`}
          className="flex min-w-0 items-center gap-3 rounded-full bg-black/55 px-3 py-2 backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <SellerAvatar
            userId={item.sellerId}
            name={item.sellerName}
            avatarUrl={item.sellerAvatar}
            className="h-9 w-9"
            initialsClassName="text-xs font-bold"
            imageClassName="object-cover"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <div className="truncate text-sm font-semibold text-white">{item.sellerName}</div>
              {sellerVerified ? <VerifiedBadge className="h-3.5 w-3.5" /> : null}
            </div>
            <div className="text-xs text-neutral-300">Vendedor</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={onShare}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-orange-400 backdrop-blur transition hover:scale-105"
          aria-label="Compartir"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {item.image ? (
        <img src={item.image} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-neutral-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/20" />

      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] bg-neutral-950 px-6 pb-6 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-2xl font-bold text-black dark:text-white">{item.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
              <MapPin className="h-4 w-4 text-neutral-500" />
              <span className="truncate">{item.location || "Santo Domingo"}</span>
            </div>
          </div>
          <div className="shrink-0 text-2xl font-bold text-orange-400">
            RD${Number(item.price).toLocaleString()}
          </div>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-neutral-400">
          {item.description || "High quality goods"}
        </p>
      </div>
    </article>
  );
}
