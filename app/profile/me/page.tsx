"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Instagram, ChevronDown, Settings } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import CategoryStories from "@/components/CategoryStories";
import { auth } from "@/lib/firebase";
import { Listing, subscribeListings } from "@/lib/marketplace";

export default function MyProfilePage() {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, []);

  const myListings = listings.filter((item) => item.ownerId === currentUserId);
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
          <span className="text-3xl font-bold">YO</span>
        </div>
        <div className="mt-3 text-sm text-neutral-300">@mi_usuario</div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <div>
            <div className="text-base font-semibold text-neutral-50">123</div>
            <div className="text-xs text-neutral-400">Siguiendo</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-50">4,562</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-50">18.4K</div>
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
        <div className="grid w-full grid-cols-3 gap-px bg-neutral-900">
          {visibleListings.length === 0 ? (
            <div className="col-span-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
              Aun no tienes publicaciones. Crea una para verla aqui.
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
