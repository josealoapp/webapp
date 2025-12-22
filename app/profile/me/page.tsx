"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Ellipsis, Instagram, ChevronDown, Settings } from "lucide-react";
import CategoryStories from "@/components/CategoryStories";

const storyCategories = [
  {
    id: "s1",
    name: "Tus looks",
    image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s2",
    name: "Compras",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s3",
    name: "Electrónicos",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s4",
    name: "Belleza",
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s5",
    name: "Favoritos",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80",
  },
];

export default function MyProfilePage() {
  const [activeCategoryId, setActiveCategoryId] = useState(storyCategories[0].id);

  const gridsByCategory = useMemo(
    () =>
      storyCategories.reduce<
        Record<
          string,
          {
            id: string;
            image: string;
            itemId: string;
          }[]
        >
      >((acc, cat, idx) => {
        acc[cat.id] = Array.from({ length: 15 }, (_, i) => ({
          id: `g${cat.id}-${i}`,
          itemId: `${cat.id}-${i + 1}`,
          image: `https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=70&sat=${-20 + idx * 5}&sig=${idx * 50 + i}`,
        }));
        return acc;
      }, {}),
    []
  );

  const gridImages = gridsByCategory[activeCategoryId] ?? [];

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
        <div className="sticky top-0 z-20 bg-neutral-950 pb-3">
          <CategoryStories categories={storyCategories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
        </div>
        <div className="grid w-full grid-cols-3 gap-[1px] bg-neutral-900">
          {gridImages.map((item) => (
            <div key={item.id} className="aspect-square overflow-hidden bg-neutral-800">
              <img src={item.image} alt={`Grid item ${item.id}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
