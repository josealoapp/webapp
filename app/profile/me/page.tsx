"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Instagram, ChevronDown, Settings } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import CategoryStories from "@/components/CategoryStories";
import { auth } from "@/lib/firebase";
import { Listing, subscribeListings } from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";
import { getInitials, getOrCreateUserHandle } from "@/lib/user-handle";

export default function MyProfilePage() {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [listings, setListings] = useState<Listing[]>([]);
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

  const myListings = listings.filter((item) => item.ownerId === currentUserId && item.status !== "sold");
  const userHandle = useMemo(() => {
    if (!currentUserId) {
      return "user-001";
    }

    return getOrCreateUserHandle({
      uid: currentUserId,
      name: currentUserName,
    });
  }, [currentUserId, currentUserName]);
  const userInitials = useMemo(() => getInitials(currentUserName), [currentUserName]);
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
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-neutral-800 bg-neutral-900">
          <span className="text-3xl font-bold">{userInitials}</span>
        </div>
        <div className="mt-3 text-lg font-semibold text-neutral-50">{currentUserName}</div>
        <div className="mt-1 text-sm text-neutral-300">@{userHandle}</div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <div>
            <div className="text-base font-semibold text-neutral-50">0</div>
            <div className="text-xs text-neutral-400">Siguiendo</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-50">0</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </div>
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
