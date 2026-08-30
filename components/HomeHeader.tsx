"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "@/lib/auth-client";
import { Heart, MapPin, Menu, Search } from "lucide-react";
import LocationPickerModal from "./LocationPickerModal";
import { auth } from "@/lib/firebase";
import { followUser, subscribeFollowingIds } from "@/lib/follows";
import { ChatRecord, Listing, searchListings, subscribeInboxChatsForUser } from "@/lib/marketplace";
import { normalizeLocationName } from "@/lib/location";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatar";
import { SupportNotification, subscribeSupportNotifications } from "@/lib/support-notifications";
import { PublicUserSearchResult, searchUsers } from "@/lib/user-search";
import { useThemeSetting } from "@/components/ThemeProvider";
import VerifiedBadge from "@/components/VerifiedBadge";
import logoIcon from "@/app/logo.svg";
import logoOrangeIcon from "@/app/logo-orange.svg";

const categories = [
  { label: "Todo", value: "Todo" },
  { label: "Bazar", value: "Bazar" },
  { label: "Vehículos", value: "Vehículos" },
  { label: "Mujer", value: "Ropa para mujeres" },
  { label: "Hombres", value: "Ropa para hombres" },
  { label: "Zapatos", value: "Zapatos" },
  { label: "Hogar", value: "Hogar" },
];

export default function HomeHeader({
  selectedLocation,
  preferredLocation,
  onLocationChange,
  activeCategory,
  onCategoryChange,
}: {
  selectedLocation: string;
  preferredLocation?: string;
  onLocationChange: (location: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const [scrolled, setScrolled] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [postSuggestions, setPostSuggestions] = useState<Listing[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<PublicUserSearchResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [supportNotifications, setSupportNotifications] = useState<SupportNotification[]>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || "");
      setCurrentUserName(user?.displayName || "Usuario");
      if (!user?.uid) {
        setChats([]);
        setSupportNotifications([]);
        setFollowingIds(new Set());
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubChats = subscribeInboxChatsForUser(currentUserId, setChats, () => setChats([]));
    const unsubSupport = subscribeSupportNotifications(currentUserId, setSupportNotifications);

    return () => {
      unsubChats();
      unsubSupport();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeFollowingIds(currentUserId, setFollowingIds);
  }, [currentUserId]);

  const trimmedQuery = query.trim();
  const hasUnreadActivity = useMemo(() => {
    if (!currentUserId) return false;
    const unreadMessages = chats.some((chat) => getUnreadCount(chat, currentUserId) > 0);
    const unreadSupport = supportNotifications.some((notification) => !notification.read);
    return unreadMessages || unreadSupport;
  }, [chats, currentUserId, supportNotifications]);

  useEffect(() => {
    if (!trimmedQuery || !showSuggestions) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setLoadingSuggestions(true);
      Promise.all([
        searchUsers({ q: trimmedQuery, limit: 4 }),
        searchListings({
          q: trimmedQuery,
          location: selectedLocation || undefined,
          status: "active",
          limit: 8,
        }),
      ])
        .then(([users, result]) => {
          if (!cancelled) {
            setUserSuggestions(users.slice(0, 4));
            setPostSuggestions(prioritizeByLocation(result.items, selectedLocation || preferredLocation).slice(0, 4));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUserSuggestions([]);
            setPostSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingSuggestions(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [preferredLocation, selectedLocation, showSuggestions, trimmedQuery]);

  const openUserResults = () => {
    if (!trimmedQuery) return;
    setShowSuggestions(false);
    const params = new URLSearchParams({ q: trimmedQuery, view: "users" });
    router.push(`/search?${params.toString()}`);
  };

  const openPostResults = () => {
    if (!trimmedQuery) return;
    setShowSuggestions(false);
    const params = new URLSearchParams({ q: trimmedQuery, view: "posts" });
    if (selectedLocation) params.set("location", selectedLocation);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={`fixed inset-x-0 top-0 z-40 transition-colors ${
        scrolled ? "bg-neutral-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-4">
        {/* Top row */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center text-white"
            aria-label="Josealo"
          >
            <Image
              className="home-logo-image"
              src={theme === "light" && !scrolled ? logoOrangeIcon : logoIcon}
              alt="Josealo logo"
              width={24}
              height={24}
              priority
            />
          </Link>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70" />
            <input
              placeholder="Buscar artículos"
              value={query}
              style={{ fontSize: "16px" }}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  openPostResults();
                }
              }}
              className={[
                "w-full rounded-full py-3 pl-12 pr-4 text-sm outline-none ring-0 focus:border-orange-400",
                theme === "light" && scrolled
                  ? "border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500"
                  : "border border-white/20 bg-black/30 text-white placeholder:text-white/70",
              ].join(" ")}
            />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/activity"
              className="relative flex h-10 w-10 items-center justify-center text-white drop-shadow"
              aria-label="Actividad"
            >
              <Heart
                className={[
                  "h-6 w-6 border-current",
                  theme === "light" && !scrolled ? "text-orange-500" : "text-white",
                ].join(" ")}
              />
              {hasUnreadActivity ? (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
              ) : null}
            </Link>
          </div>
        </div>

        {showSuggestions && trimmedQuery ? (
          <div
            className={[
              "mt-3 rounded-3xl p-3 shadow-2xl backdrop-blur",
              theme === "light"
                ? "border border-neutral-200 bg-white"
                : "border border-white/10 bg-neutral-950/95",
            ].join(" ")}
          >
            {loadingSuggestions ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-sm text-neutral-300">
                Buscando publicaciones...
              </div>
            ) : userSuggestions.length > 0 || postSuggestions.length > 0 ? (
              <div className="space-y-4">
                {userSuggestions.length > 0 ? (
                  <section>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2
                        className={[
                          "text-base font-semibold",
                          theme === "light" && scrolled ? "text-black" : "text-white",
                        ].join(" ")}
                      >
                        Usuarios
                      </h2>
                      <button
                        type="button"
                        onClick={openUserResults}
                        className="text-sm font-bold text-orange-400"
                      >
                        Ver todos
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {userSuggestions.map((user) => {
                        const isSelf = currentUserId === user.userId;
                        const isFollowing = followingIds.has(user.userId);

                        return (
                          <div key={user.userId} className="min-w-0 text-center">
                            <Link
                              href={`/profile/${user.userId}?name=${encodeURIComponent(user.displayName)}`}
                              onClick={() => setShowSuggestions(false)}
                              className="block"
                            >
                              <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-neutral-900">
                                <img
                                  src={user.avatarUrl || DEFAULT_PROFILE_AVATAR}
                                  alt={user.displayName}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div
                                className={[
                                  "listing-title mt-2 flex min-w-0 items-center justify-center gap-1 truncate text-sm font-semibold",
                                  theme === "light" && scrolled ? "text-black" : "text-white",
                                ].join(" ")}
                              >
                                <span className="min-w-0 truncate">{user.displayName}</span>
                                {user.isVerified ? <VerifiedBadge className="h-3.5 w-3.5 shrink-0" /> : null}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-neutral-400">
                                {user.handle ? `@${user.handle}` : "Usuario"}
                              </div>
                            </Link>
                            {!isSelf ? (
                              <button
                                type="button"
                                disabled={isFollowing}
                                onClick={async () => {
                                  if (!currentUserId) {
                                    router.push("/sign-in");
                                    return;
                                  }
                                  await followUser({
                                    followerId: currentUserId,
                                    followerName: currentUserName,
                                    followeeId: user.userId,
                                    followeeName: user.displayName,
                                  });
                                  setFollowingIds((current) => {
                                    const next = new Set(current);
                                    next.add(user.userId);
                                    return next;
                                  });
                                }}
                                className="mt-2 h-8 w-full rounded-xl border border-orange-500 px-2 text-xs font-bold text-orange-400 disabled:border-neutral-700 disabled:text-neutral-500"
                              >
                                {isFollowing ? "Siguiendo" : "Seguir"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {postSuggestions.length > 0 ? (
                  <section>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2
                        className={[
                          "text-base font-semibold",
                          theme === "light" && scrolled ? "text-black" : "text-white",
                        ].join(" ")}
                      >
                        Posts
                      </h2>
                      <button
                        type="button"
                        onClick={openPostResults}
                        className="text-sm font-bold text-orange-400"
                      >
                        Ver todos
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {postSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            router.push(`/item/${item.id}`);
                          }}
                          className="flex min-w-[230px] max-w-[260px] items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/5"
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
                            <div
                              className={[
                                "listing-title truncate text-sm font-medium",
                                theme === "light" && scrolled ? "text-black" : "text-white",
                              ].join(" ")}
                            >
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-neutral-400">{item.location}</div>
                          </div>
                          <div className="listing-price text-sm font-bold text-orange-400">
                            RD${item.price.toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-sm text-neutral-300">
                No encontramos resultados para “{trimmedQuery}”.
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
                        ? "border border-neutral-500 bg-neutral-900/70 text-white shadow-[0_0_0_1px_rgba(115,115,115,0.25)]"
                        : "border border-transparent bg-black/20 text-white hover:text-neutral-300"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <Link
              href="/categories"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl  bg-black/30 text-white backdrop-blur hover:text-neutral-300"
              aria-label="Categorías"
            >
              <Menu className="h-5 w-5" />
            </Link>
          </div>

          {/* Listing location selector */}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left backdrop-blur hover:border-neutral-500"
          >
            <span className="text-sm text-white/90">Ubicaciones de búsqueda</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-neutral-300">
              <MapPin className="h-4 w-4" />
              {selectedLocation || "Todas"}
            </span>
          </button>
        </div>
      </div>

      <LocationPickerModal
        open={locationModalOpen}
        currentLocation={selectedLocation}
        allowAllLocations
        onClose={() => setLocationModalOpen(false)}
        onSelect={onLocationChange}
      />
    </header>
  );
}

function getUnreadCount(chat: ChatRecord, userId: string) {
  if (!userId) return 0;
  const unreadBy = chat.unreadBy || {};
  const hasStoredUnread = Object.prototype.hasOwnProperty.call(unreadBy, userId);
  const storedUnread = Math.max(0, Number(unreadBy[userId] || 0));
  if (hasStoredUnread) return storedUnread;

  const readAt = Number(chat.readBy?.[userId] || 0);
  const lastMessageAt = Number(chat.updatedAt || 0);
  if (chat.lastMessageSenderId && chat.lastMessageSenderId !== userId && lastMessageAt > readAt) {
    return 1;
  }

  return 0;
}

function prioritizeByLocation(items: Listing[], preferredLocation?: string) {
  if (!preferredLocation) return items;
  const target = normalizeLocation(preferredLocation);

  return [...items].sort((a, b) => {
    const aNear = normalizeLocation(a.location) === target ? 1 : 0;
    const bNear = normalizeLocation(b.location) === target ? 1 : 0;
    if (aNear !== bNear) return bNear - aNear;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

function normalizeLocation(location: string) {
  return normalizeLocationName(location);
}
