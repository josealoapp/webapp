"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { ArrowLeft, Bell, Heart, MessageCircle, Search, Sparkles } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import SellerAvatar from "@/components/SellerAvatar";
import { auth } from "@/lib/firebase";
import { subscribeFollowing } from "@/lib/follows";
import {
  ChatRecord,
  Listing,
  subscribeInboxChatsForUser,
  subscribeListings,
} from "@/lib/marketplace";
import {
  LikeRecord,
  subscribeIncomingLikesForOwner,
  subscribeLikesForUser,
  unlikeItem,
} from "@/lib/likes";
import { getPostAuthDestination } from "@/lib/account-profile";
import { getOrCreateUserHandle } from "@/lib/user-handle";

type ActivityEntry = {
  id: string;
  href: string;
  createdAt: number;
  type: "like" | "listing" | "message";
  title: string;
  subtitle: string;
  avatarUserId?: string;
  avatarName: string;
  avatarUrl?: string;
};

export default function ActivityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"activity" | "likes">("activity");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [authResolved, setAuthResolved] = useState(false);
  const [query, setQuery] = useState("");
  const [likes, setLikes] = useState<LikeRecord[]>([]);
  const [incomingLikes, setIncomingLikes] = useState<LikeRecord[]>([]);
  const [following, setFollowing] = useState<ReturnType<typeof subscribeFollowingRows>>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [chats, setChats] = useState<ChatRecord[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        if (user.emailVerified) {
          const destination = getPostAuthDestination("/activity");
          if (destination !== "/activity") {
            router.replace(destination);
            return;
          }
        }

        setCurrentUserId(user.uid);
        setCurrentUserName(user.displayName?.trim() || user.email?.trim() || "Usuario");
        setAuthResolved(true);
        return;
      }

      setCurrentUserId("");
      setCurrentUserName("Usuario");
      setAuthResolved(true);
    });
  }, [router]);

  useEffect(() => {
    if (authResolved && !currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent("/activity")}`);
    }
  }, [authResolved, currentUserId, router]);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubLikes = subscribeLikesForUser(currentUserId, setLikes);
    const unsubIncomingLikes = subscribeIncomingLikesForOwner(currentUserId, setIncomingLikes);
    const unsubFollowing = subscribeFollowing(currentUserId, (rows) =>
      setFollowing(subscribeFollowingRows(rows))
    );
    const unsubListings = subscribeListings(setListings);
    const unsubChats = subscribeInboxChatsForUser(currentUserId, setChats);

    return () => {
      unsubLikes();
      unsubIncomingLikes();
      unsubFollowing();
      unsubListings();
      unsubChats();
    };
  }, [currentUserId]);

  const activityEntries = useMemo(() => {
    const likeEntries: ActivityEntry[] = incomingLikes.map((entry) => ({
      id: `like:${entry.id}`,
      href: entry.href,
      createdAt: entry.createdAt,
      type: "like",
      title: `@${getOrCreateUserHandle({ uid: entry.actorId, name: entry.actorName })} le dio like a tu publicación`,
      subtitle: entry.itemTitle,
      avatarUserId: entry.actorId,
      avatarName: entry.actorName,
    }));

    const followedPostEntries: ActivityEntry[] = listings
      .filter((listing) => {
        if (!listing.ownerId || listing.ownerId === currentUserId) return false;
        const followRecord = following.find((entry) => entry.followeeId === listing.ownerId);
        if (!followRecord) return false;
        return (listing.createdAt ?? 0) >= (followRecord.createdAt ?? 0);
      })
      .map((listing) => ({
        id: `listing:${listing.id}`,
        href: `/item/${listing.id}`,
        createdAt: listing.createdAt ?? 0,
        type: "listing",
        title: `@${getOrCreateUserHandle({ uid: listing.ownerId, name: listing.ownerName })} publicó un nuevo artículo`,
        subtitle: listing.title,
        avatarUserId: listing.ownerId,
        avatarName: listing.ownerName,
        avatarUrl: listing.ownerAvatar,
      }));

    const messageEntries: ActivityEntry[] = chats.map((chat) => {
      const counterpartId = chat.sellerId === currentUserId ? chat.buyerId : chat.sellerId;
      const counterpartName = chat.sellerId === currentUserId ? chat.buyerName : chat.sellerName;

      return {
        id: `message:${chat.id}`,
        href: `/chat/${chat.id}`,
        createdAt: chat.updatedAt ?? chat.createdAt ?? 0,
        type: "message",
        title: "Tienes una conversación activa",
        subtitle: `${counterpartName} • ${chat.listingTitle}`,
        avatarUserId: counterpartId,
        avatarName: counterpartName,
      };
    });

    return [...likeEntries, ...followedPostEntries, ...messageEntries].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );
  }, [chats, currentUserId, following, incomingLikes, listings]);

  const filteredActivity = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return activityEntries;

    return activityEntries.filter((entry) =>
      `${entry.title} ${entry.subtitle}`.toLowerCase().includes(normalizedQuery)
    );
  }, [activityEntries, query]);

  const filteredLikes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return likes;

    return likes.filter((entry) =>
      `${entry.itemTitle} ${entry.ownerName} ${entry.location}`.toLowerCase().includes(normalizedQuery)
    );
  }, [likes, query]);

  if (!authResolved || !currentUserId) {
    return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white">Activity</div>
              <div className="text-xs text-neutral-400">@{getOrCreateUserHandle({ uid: currentUserId, name: currentUserName })}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 p-1">
            {([
              { id: "activity", label: "Activity", icon: Bell },
              { id: "likes", label: "Likes", icon: Heart },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-orange-500 text-black"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeTab === "activity" ? "Buscar en actividad" : "Buscar en likes"}
              className="w-full rounded-full border border-neutral-800 bg-neutral-950 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-neutral-500 focus:border-orange-400"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
        {activeTab === "activity" ? (
          filteredActivity.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Tu actividad aparecerá aquí"
              description="Cuando alguien le dé like a una publicación tuya, te escriba, o una cuenta que sigues publique algo nuevo, lo verás aquí."
            />
          ) : (
            <div className="space-y-3">
              {filteredActivity.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="flex items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/40 px-4 py-4 transition hover:bg-neutral-900/70"
                >
                  <SellerAvatar
                    userId={entry.avatarUserId}
                    name={entry.avatarName}
                    avatarUrl={entry.avatarUrl}
                    className="h-12 w-12 shrink-0"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{entry.title}</div>
                    <div className="mt-1 truncate text-sm text-neutral-400">{entry.subtitle}</div>
                  </div>
                  <div className="shrink-0 text-xs text-neutral-500">
                    {formatRelativeDate(entry.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : filteredLikes.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Aún no tienes likes guardados"
            description="Cuando le des like a una publicación, aparecerá aquí para volver a verla rápido."
          />
        ) : (
          <div className="space-y-3">
            {filteredLikes.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/40 px-4 py-4"
              >
                <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-900">
                    {entry.image ? (
                      <img src={entry.image} alt={entry.itemTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{entry.itemTitle}</div>
                    <div className="mt-1 truncate text-xs text-neutral-400">{entry.ownerName}</div>
                    <div className="mt-1 text-xs font-semibold text-orange-400">
                      RD${Number(entry.price || 0).toLocaleString()}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => unlikeItem(currentUserId, entry.listingId, entry.bazarItemId)}
                  className="shrink-0 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-semibold text-neutral-100 transition hover:border-orange-400 hover:text-white"
                >
                  Quitar like
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function subscribeFollowingRows(
  rows: Array<{
    id: string;
    followeeId: string;
    followeeName: string;
    createdAt: number;
  }>
) {
  return rows.map((row) => ({
    id: row.id,
    followeeId: row.followeeId,
    followeeName: row.followeeName,
    createdAt: row.createdAt,
  }));
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/30 px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-neutral-400">{description}</div>
    </div>
  );
}

function formatRelativeDate(timestamp: number) {
  if (!timestamp) return "";

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))}m`;
  }

  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))}h`;
  }

  if (diff < 7 * day) {
    return `${Math.max(1, Math.floor(diff / day))}d`;
  }

  return new Date(timestamp).toLocaleDateString();
}
