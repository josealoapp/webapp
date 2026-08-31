"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { ArrowLeft, Bell, Heart, Search, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged } from "@/lib/auth-client";
import SellerAvatar from "@/components/SellerAvatar";
import { Checkbox } from "@/components/ui/checkbox";
import { auth } from "@/lib/firebase";
import { subscribeFollowers, subscribeFollowing } from "@/lib/follows";
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
import {
  SupportNotification,
  subscribeSupportNotifications,
} from "@/lib/support-notifications";
import { getPostAuthDestination } from "@/lib/account-profile";
import { formatMoney } from "@/lib/money";
import { getOrCreateUserHandle } from "@/lib/user-handle";

type ActivityEntry = {
  id: string;
  href: string;
  createdAt: number;
  type: "like" | "listing" | "message" | "support";
  title: string;
  subtitle: string;
  avatarUserId?: string;
  avatarName: string;
  avatarUrl?: string;
  unread?: boolean;
};

export default function ActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"activity" | "likes">(
    searchParams.get("tab") === "likes" ? "likes" : "activity"
  );
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [authResolved, setAuthResolved] = useState(false);
  const [query, setQuery] = useState("");
  const [likes, setLikes] = useState<LikeRecord[]>([]);
  const [incomingLikes, setIncomingLikes] = useState<LikeRecord[]>([]);
  const [following, setFollowing] = useState<ReturnType<typeof subscribeFollowingRows>>([]);
  const [followers, setFollowers] = useState<ReturnType<typeof subscribeFollowerRows>>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [supportNotifications, setSupportNotifications] = useState<SupportNotification[]>([]);
  const [selectedLikeIds, setSelectedLikeIds] = useState<Set<string>>(() => new Set());

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
    const unsubFollowers = subscribeFollowers(currentUserId, (rows) =>
      setFollowers(subscribeFollowerRows(rows))
    );
    const unsubListings = subscribeListings(setListings);
    const unsubChats = subscribeInboxChatsForUser(
      currentUserId,
      setChats,
      () => setChats([])
    );
    const unsubSupport = subscribeSupportNotifications(currentUserId, setSupportNotifications);

    return () => {
      unsubLikes();
      unsubIncomingLikes();
      unsubFollowing();
      unsubFollowers();
      unsubListings();
      unsubChats();
      unsubSupport();
    };
  }, [currentUserId]);

  const activityEntries = useMemo(() => {
    const supportEntries: ActivityEntry[] = supportNotifications.map((notification) => ({
      id: `support:${notification.id}`,
      href: "/activity",
      createdAt: notification.createdAt ?? 0,
      type: "support",
      title: notification.title,
      subtitle: notification.message,
      avatarName: "Protección Josealo",
      unread: !notification.read,
    }));

    const likeEntries: ActivityEntry[] = incomingLikes.map((entry) => ({
      id: `like:${entry.id}`,
      href: entry.href,
      createdAt: entry.createdAt,
      type: "like",
      title: `@${entry.actorHandle || getOrCreateUserHandle({ uid: entry.actorId, name: entry.actorName })} le dio like a tu publicación`,
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
      .map((listing) => {
        const followRecord = following.find((entry) => entry.followeeId === listing.ownerId);
        const ownerHandle =
          followRecord?.followeeHandle || getOrCreateUserHandle({ uid: listing.ownerId, name: listing.ownerName });

        return {
          id: `listing:${listing.id}`,
          href: `/item/${listing.id}`,
          createdAt: listing.createdAt ?? 0,
          type: "listing",
          title: `@${ownerHandle} publicó un nuevo artículo`,
          subtitle: listing.title,
          avatarUserId: listing.ownerId,
          avatarName: listing.ownerName,
          avatarUrl: listing.ownerAvatar,
        };
      });

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const followersToday = followers.filter((entry) => (entry.createdAt || 0) >= todayStart.getTime());
    const olderFollowers = followers.filter((entry) => (entry.createdAt || 0) < todayStart.getTime());
    const followerEntries: ActivityEntry[] = [
      ...(followersToday.length > 1
        ? [
            {
              id: `followers-today:${currentUserId}`,
              href: `/profile/${currentUserId}/connections?tab=followers&name=${encodeURIComponent(currentUserName)}`,
              createdAt: Math.max(...followersToday.map((entry) => entry.createdAt || 0)),
              type: "message" as const,
              title: `${followersToday.length} usuarios te siguieron hoy`,
              subtitle: "Toca para ver tu lista de seguidores",
              avatarUserId: followersToday[0]?.followerId,
              avatarName: followersToday[0]?.followerName || "Usuario",
            },
          ]
        : followersToday.map((entry) => buildFollowerActivityEntry(entry, currentUserId, currentUserName))),
      ...olderFollowers.map((entry) => buildFollowerActivityEntry(entry, currentUserId, currentUserName)),
    ];

    return [...supportEntries, ...followerEntries, ...likeEntries, ...followedPostEntries, ...messageEntries].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );
  }, [
    chats,
    currentUserId,
    currentUserName,
    followers,
    following,
    incomingLikes,
    listings,
    supportNotifications,
  ]);

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

  const selectedLikes = useMemo(
    () => likes.filter((entry) => selectedLikeIds.has(entry.id)),
    [likes, selectedLikeIds]
  );

  const toggleLikeSelection = (likeId: string) => {
    setSelectedLikeIds((current) => {
      const next = new Set(current);
      if (next.has(likeId)) {
        next.delete(likeId);
      } else {
        next.add(likeId);
      }
      return next;
    });
  };

  const shareSelectedLikes = async () => {
    if (!selectedLikes.length || typeof window === "undefined") return;

    const tokens = selectedLikes.map((entry) =>
      entry.bazarItemId ? `${entry.listingId}:${entry.bazarItemId}` : entry.listingId
    );
    const params = new URLSearchParams({ items: tokens.join(",") });
    const url = `${window.location.origin}/shared-likes/${encodeURIComponent(currentUserId)}?${params.toString()}`;
    const title = `${currentUserName}: Me gustas`;
    const text = `Mira los artículos que le gustaron a ${currentUserName} en Josealo.`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast("Link copiado", { description: "Comparte este enlace con quien quieras." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("No pudimos compartir el enlace.");
    }
  };

  if (!authResolved || !currentUserId) {
    return <div className="min-h-screen bg-neutral-50 text-slate-950 dark:bg-neutral-950 dark:text-neutral-50" />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-slate-950 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-none"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-950 dark:text-white">Activity</div>
              <div className="text-xs text-slate-500 dark:text-neutral-400">@{getOrCreateUserHandle({ uid: currentUserId, name: currentUserName })}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-transparent p-1 dark:border-neutral-800 dark:bg-neutral-900">
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
                      ? "border border-orange-500 bg-orange-500 text-black"
                      : "border border-slate-200 bg-transparent text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:border-transparent dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-neutral-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeTab === "activity" ? "Buscar en actividad" : "Buscar en likes"}
              className="w-full rounded-full border border-slate-200 bg-transparent py-3 pl-11 pr-4 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-5">
        {activeTab === "activity" ? (
          filteredActivity.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Tu actividad aparecerá aquí"
              description="Cuando alguien te siga, le dé like a una publicación tuya, te escriba, o soporte actualice tu cuenta, lo verás aquí."
            />
          ) : (
            <div className="space-y-3">
              {filteredActivity.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-transparent px-4 py-4 transition hover:bg-black/5 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/70"
                >
                  <SellerAvatar
                    userId={entry.avatarUserId}
                    name={entry.avatarName}
                    avatarUrl={entry.avatarUrl}
                    className="h-12 w-12 shrink-0"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                      {entry.unread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-label="Nueva notificación" />
                      ) : null}
                      <span>{entry.title}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-normal text-slate-700 dark:text-neutral-400">{entry.subtitle}</div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-500 dark:text-neutral-500">
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
                className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-transparent px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/40"
              >
                <Checkbox
                  checked={selectedLikeIds.has(entry.id)}
                  onCheckedChange={() => toggleLikeSelection(entry.id)}
                  className="h-6 w-6 rounded-md border-slate-300 bg-transparent data-[state=unchecked]:bg-transparent dark:border-neutral-500"
                  aria-label={`Seleccionar ${entry.itemTitle}`}
                />
                <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-neutral-900">
                    {entry.image ? (
                      <img src={entry.image} alt={entry.itemTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-neutral-500">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="listing-title truncate text-sm font-medium text-slate-950 dark:text-white">{entry.itemTitle}</div>
                    <div className="mt-1 truncate text-xs font-normal text-slate-600 dark:text-neutral-400">{entry.ownerName}</div>
                    <div className="listing-price mt-1 text-xs font-bold text-orange-400">
                      {formatMoney(Number(entry.price || 0), entry.currency)}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => unlikeItem(currentUserId, entry.listingId, entry.bazarItemId)}
                  className="shrink-0 rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-xs font-semibold text-slate-950 transition hover:border-orange-400 hover:bg-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:text-white"
                >
                  Quitar like
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {activeTab === "likes" && selectedLikes.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-neutral-300">
              {selectedLikes.length} seleccionado{selectedLikes.length === 1 ? "" : "s"}
            </div>
            <button
              type="button"
              onClick={shareSelectedLikes}
              className="flex h-12 min-w-40 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              <Share2 className="h-4 w-4" />
              Compartir
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function subscribeFollowingRows(
  rows: Array<{
    id: string;
    followeeId: string;
    followeeName: string;
    followeeHandle?: string;
    createdAt: number;
  }>
) {
  return rows.map((row) => ({
    id: row.id,
    followeeId: row.followeeId,
    followeeName: row.followeeName,
    followeeHandle: row.followeeHandle,
    createdAt: row.createdAt,
  }));
}

function subscribeFollowerRows(
  rows: Array<{
    id: string;
    followerId: string;
    followerName: string;
    followerHandle?: string;
    createdAt: number;
  }>
) {
  return rows.map((row) => ({
    id: row.id,
    followerId: row.followerId,
    followerName: row.followerName,
    followerHandle: row.followerHandle,
    createdAt: row.createdAt,
  }));
}

function buildFollowerActivityEntry(
  entry: ReturnType<typeof subscribeFollowerRows>[number],
  currentUserId: string,
  currentUserName: string
): ActivityEntry {
  const followerHandle =
    entry.followerHandle || getOrCreateUserHandle({ uid: entry.followerId, name: entry.followerName });

  return {
    id: `follower:${entry.id}`,
    href: `/profile/${currentUserId}/connections?tab=followers&name=${encodeURIComponent(currentUserName)}`,
    createdAt: entry.createdAt,
    type: "message",
    title: `@${followerHandle} empezó a seguirte`,
    subtitle: "Nuevo seguidor",
    avatarUserId: entry.followerId,
    avatarName: entry.followerName,
  };
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
    <div className="rounded-3xl border border-slate-200 bg-transparent px-5 py-8 text-center dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-transparent text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
      <div className="mt-2 text-sm font-normal leading-6 text-slate-600 dark:text-neutral-400">{description}</div>
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
