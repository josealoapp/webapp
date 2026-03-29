"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Instagram } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import CategoryStories from "@/components/CategoryStories";
import ProfileAvatar from "@/components/ProfileAvatar";
import { auth } from "@/lib/firebase";
import { followUser, subscribeFollowers, subscribeFollowing, unfollowUser } from "@/lib/follows";
import { subscribeIncomingLikesForOwner } from "@/lib/likes";
import { isListingVisibleInOwnerProfile, Listing, subscribeListings } from "@/lib/marketplace";
import { subscribeProfileAvatar } from "@/lib/profile-avatar";
import { getOrCreateUserHandle } from "@/lib/user-handle";

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params?.userId || "";

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isShakingFollow, setIsShakingFollow] = useState(false);
  const [isAnimatingFollowingText, setIsAnimatingFollowingText] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [followers, setFollowers] = useState<ReturnType<typeof mapFollowRows>>([]);
  const [following, setFollowing] = useState<ReturnType<typeof mapFollowRows>>([]);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (currentUserId && currentUserId === userId) {
      router.replace("/profile/me");
    }
  }, [currentUserId, router, userId]);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsubFollowers = subscribeFollowers(userId, (rows) => setFollowers(mapFollowRows(rows, "followers")));
    const unsubFollowing = subscribeFollowing(userId, (rows) => setFollowing(mapFollowRows(rows, "following")));
    const unsubLikes = subscribeIncomingLikesForOwner(userId, (rows) => setLikesCount(rows.length));
    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubLikes();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAvatarUrl("");
      return;
    }

    const unsub = subscribeProfileAvatar(userId, setAvatarUrl);
    return () => unsub();
  }, [userId]);

  const publicListings = useMemo(
    () =>
      listings.filter((item) => item.ownerId === userId && isListingVisibleInOwnerProfile(item)),
    [listings, userId]
  );
  const fallbackName = searchParams.get("name")?.trim() || "Usuario";
  const profileName = useMemo(() => {
    return (
      publicListings[0]?.ownerName ||
      followers[0]?.profileName ||
      following[0]?.sourceName ||
      fallbackName
    );
  }, [fallbackName, followers, following, publicListings]);
  const profileHandle = useMemo(
    () => getOrCreateUserHandle({ uid: userId || "user", name: profileName }),
    [profileName, userId]
  );
  const isFollowing = followers.some((entry) => entry.profileId === currentUserId);

  const storyCategories = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; image: string }>();

    publicListings.forEach((item) => {
      const categoryName = item.category?.trim() || "General";
      const categoryId = categoryName.toLowerCase();

      if (!categories.has(categoryId)) {
        categories.set(categoryId, {
          id: categoryId,
          name: categoryName,
          image: item.image,
        });
      }
    });

    return Array.from(categories.values());
  }, [publicListings]);

  useEffect(() => {
    if (!storyCategories.length) {
      setActiveCategoryId("");
      return;
    }

    setActiveCategoryId((current) =>
      current && storyCategories.some((category) => category.id === current)
        ? current
        : storyCategories[0].id
    );
  }, [storyCategories]);

  const visibleListings = activeCategoryId
    ? publicListings.filter((item) => (item.category?.trim() || "General").toLowerCase() === activeCategoryId)
    : publicListings;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="flex items-center justify-between px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">{profileName}</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-1">
        <ProfileAvatar src={avatarUrl || publicListings[0]?.ownerAvatar} alt={profileName} />
        <div className="mt-3 text-lg font-semibold text-neutral-50">{profileName}</div>
        <div className="mt-1 text-sm text-neutral-300">@{profileHandle}</div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <Link href={`/profile/${userId}/connections?tab=following&name=${encodeURIComponent(profileName)}`}>
            <div className="text-base font-semibold text-neutral-50">{following.length}</div>
            <div className="text-xs text-neutral-400">Siguiendo</div>
          </Link>
          <Link href={`/profile/${userId}/connections?tab=followers&name=${encodeURIComponent(profileName)}`}>
            <div className="text-base font-semibold text-neutral-50">{followers.length}</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </Link>
          <div>
            <div className="text-base font-semibold text-neutral-50">{likesCount}</div>
            <div className="text-xs text-neutral-400">Likes</div>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-2">
          {currentUserId ? (
            <button
              type="button"
              onClick={async () => {
                if (!currentUserId) return;
                if (isFollowing) {
                  await unfollowUser(currentUserId, userId);
                  return;
                }
                setIsShakingFollow(true);
                await followUser({
                  followerId: currentUserId,
                  followerName: currentUserName,
                  followeeId: userId,
                  followeeName: profileName,
                });
                setIsAnimatingFollowingText(true);
                window.setTimeout(() => setIsShakingFollow(false), 420);
                window.setTimeout(() => setIsAnimatingFollowingText(false), 900);
              }}
              className={[
                "flex-none rounded-2xl px-8 py-3 text-sm font-semibold transition-transform duration-200",
                isFollowing
                  ? "border border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-orange-400 hover:text-white"
                  : "bg-orange-500 text-black hover:bg-orange-400",
                isShakingFollow ? "animate-[follow-shake_0.42s_ease-in-out]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block",
                  isAnimatingFollowingText ? "animate-[follow-word-in_0.9s_ease]" : "",
                ].join(" ")}
              >
                {isFollowing ? "Siguiendo" : "Seguir"}
              </span>
            </button>
          ) : null}
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white">
            <Instagram className="h-4 w-4" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </main>

      <div className="mt-4 w-full pb-12">
        {storyCategories.length > 0 ? (
          <div className="sticky top-0 z-20 bg-neutral-950 pb-3">
            <CategoryStories categories={storyCategories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
          </div>
        ) : null}
        <div className="grid w-full grid-cols-3 gap-px">
          {visibleListings.length === 0 ? (
            <div className="col-span-3 flex justify-center px-4 py-8">
              <div className="max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/50 px-5 py-4 text-center text-sm text-neutral-400">
                Este usuario aun no tiene publicaciones activas.
              </div>
            </div>
          ) : (
            visibleListings.map((item) => (
              <Link key={item.id} href={`/item/${item.id}`} className="aspect-square overflow-hidden bg-neutral-800">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-neutral-800" />
                )}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function mapFollowRows(
  rows: Array<{
    id: string;
    followerId: string;
    followerName: string;
    followeeId: string;
    followeeName: string;
    createdAt: number;
  }>,
  type: "followers" | "following"
) {
  return rows.map((row) => ({
    id: row.id,
    profileId: type === "followers" ? row.followerId : row.followeeId,
    profileName: type === "followers" ? row.followerName : row.followeeName,
    sourceName: type === "followers" ? row.followeeName : row.followerName,
    createdAt: row.createdAt,
  }));
}
