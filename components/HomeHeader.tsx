"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "@/lib/auth-client";
import { Heart, MapPin, Menu, Search } from "lucide-react";
import LocationPickerModal from "./LocationPickerModal";
import { auth } from "@/lib/firebase";
import { ChatRecord, Listing, searchListings, subscribeInboxChatsForUser } from "@/lib/marketplace";
import { normalizeLocationName } from "@/lib/location";
import { SupportNotification, subscribeSupportNotifications } from "@/lib/support-notifications";
import { useThemeSetting } from "@/components/ThemeProvider";
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
  const [suggestions, setSuggestions] = useState<Listing[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
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
      if (!user?.uid) {
        setChats([]);
        setSupportNotifications([]);
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

  const trimmedQuery = query.trim();
  const hasUnreadActivity = useMemo(() => {
    if (!currentUserId) return false;
    const unreadMessages = chats.some((chat) => getUnreadCount(chat, currentUserId) > 0);
    const unreadSupport = supportNotifications.some((notification) => !notification.read);
    return unreadMessages || unreadSupport;
  }, [chats, currentUserId, supportNotifications]);

  useEffect(() => {
    if (!trimmedQuery || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setLoadingSuggestions(true);
      searchListings({
        q: trimmedQuery,
        location: selectedLocation || undefined,
        status: "active",
        limit: 8,
      })
        .then((result) => {
          if (!cancelled) {
            setSuggestions(prioritizeByLocation(result.items, selectedLocation || preferredLocation).slice(0, 3));
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
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

  const openResults = () => {
    if (!trimmedQuery) return;
    setShowSuggestions(false);
    const params = new URLSearchParams({ q: trimmedQuery });
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
                  openResults();
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
            ) : suggestions.length > 0 ? (
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
                        <div
                          className={[
                            "listing-title truncate text-sm font-medium",
                            theme === "light" && scrolled
                              ? "text-black"
                              : "text-white",
                          ].join(" ")}
                        >
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">{item.location}</div>
                      </div>
                      <div className="listing-price text-sm font-bold text-orange-400">RD${item.price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openResults}
                  className="mt-3 h-11 w-full rounded-2xl border border-neutral-800 bg-neutral-900/10 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
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
