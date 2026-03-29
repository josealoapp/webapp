"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Instagram, ChevronDown, Settings } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import CategoryStories from "@/components/CategoryStories";
import ProfileAvatar from "@/components/ProfileAvatar";
import { auth } from "@/lib/firebase";
import { subscribeFollowers, subscribeFollowing } from "@/lib/follows";
import {
  isListingVisibleInOwnerProfile,
  Listing,
  subscribeListings,
  syncOwnerAvatarAcrossListings,
  uploadListingImages,
} from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";
import { subscribeProfileAvatar, writeProfileAvatar } from "@/lib/profile-avatar";
import { getOrCreateUserHandle } from "@/lib/user-handle";

export default function MyProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user?.uid && user.emailVerified) {
        const destination = getPostAuthDestination("/profile/me");
        if (destination !== "/profile/me") {
          router.replace(destination);
          return;
        }
      }
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
      setAuthResolved(true);
    });
  }, [router]);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setFollowersCount(0);
      setFollowingCount(0);
      return;
    }

    const unsubFollowers = subscribeFollowers(currentUserId, (rows) => setFollowersCount(rows.length));
    const unsubFollowing = subscribeFollowing(currentUserId, (rows) => setFollowingCount(rows.length));

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setAvatarUrl("");
      return;
    }

    const unsub = subscribeProfileAvatar(currentUserId, setAvatarUrl);
    return () => unsub();
  }, [currentUserId]);

  const myListings = listings.filter(
    (item) => item.ownerId === currentUserId && isListingVisibleInOwnerProfile(item)
  );
  const userHandle = useMemo(() => {
    if (!currentUserId) {
      return "user-001";
    }

    return getOrCreateUserHandle({
      uid: currentUserId,
      name: currentUserName,
    });
  }, [currentUserId, currentUserName]);
  const storyCategories = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; image: string }>();

    myListings.forEach((item) => {
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
  }, [myListings]);

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
    ? myListings.filter((item) => (item.category?.trim() || "General").toLowerCase() === activeCategoryId)
    : myListings;
  const isSignedIn = Boolean(currentUserId);

  useEffect(() => {
    if (authResolved && !currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent("/profile/me")}`);
    }
  }, [authResolved, currentUserId, router]);

  if (!authResolved || !isSignedIn) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50" />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="flex items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="text-sm font-semibold">Tu perfil</div>
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
          aria-label="Ajustes"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-1">
        <ProfileAvatar
          src={avatarUrl}
          alt={currentUserName}
          editable
          onEdit={() => avatarInputRef.current?.click()}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !currentUserId) return;

            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") return;

              setAvatarUrl(reader.result);
              writeProfileAvatar(currentUserId, reader.result);

              uploadListingImages([file])
                .then(async ([uploadedUrl]) => {
                  if (!uploadedUrl) return;
                  writeProfileAvatar(currentUserId, uploadedUrl);
                  setAvatarUrl(uploadedUrl);
                  await syncOwnerAvatarAcrossListings(currentUserId, uploadedUrl);
                })
                .catch((error) => {
                  console.error("profile-avatar-sync-failed", error);
                });
            };
            reader.readAsDataURL(file);

            event.currentTarget.value = "";
          }}
        />
        <div className="mt-3 text-lg font-semibold text-neutral-50">{currentUserName}</div>
        <div className="mt-1 text-sm text-neutral-300">@{userHandle}</div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <Link href={`/profile/${currentUserId}/connections?tab=following&name=${encodeURIComponent(currentUserName)}`}>
            <div className="text-base font-semibold text-neutral-50">{followingCount}</div>
            <div className="text-xs text-neutral-400">Siguiendo</div>
          </Link>
          <Link href={`/profile/${currentUserId}/connections?tab=followers&name=${encodeURIComponent(currentUserName)}`}>
            <div className="text-base font-semibold text-neutral-50">{followersCount}</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </Link>
          <div>
            <div className="text-base font-semibold text-neutral-50">0</div>
            <div className="text-xs text-neutral-400">Likes</div>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-2">
          <button className="flex-none rounded-2xl border border-neutral-800 bg-neutral-900 px-8 py-3 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white">
            Editar perfil
          </button>
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
                Aun no tienes publicaciones. Crea una para verla aqui.
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
