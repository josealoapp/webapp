"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ellipsis, Instagram, ChevronDown } from "lucide-react";
import CategoryStories from "@/components/CategoryStories";

const storyCategories = [
  {
    id: "s1",
    name: "Ropa",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s2",
    name: "Hogar",
    image: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&q=80",
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
    name: "Zapatos",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "s6",
    name: "Accesorios",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80",
  },
];

export default function ProfilePage() {
  const router = useRouter();
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
        acc[cat.id] = Array.from({ length: 48 }, (_, i) => ({
          id: `g${cat.id}-${i}`,
          itemId: `${cat.id}-${i + 1}`,
          image: `https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=400&q=70&sat=${-35 + idx * 5}&sig=${idx * 100 + i}`,
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
        <div className="text-sm font-semibold">Kambada Studio</div>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200"
          aria-label="Opciones"
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-1">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-neutral-800 bg-neutral-900">
          <span className="text-3xl font-bold">KS</span>
        </div>
        <div className="mt-3 text-sm text-neutral-300">@kambada_studio</div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <div>
            <div className="text-base font-semibold text-neutral-50">9,999</div>
            <div className="text-xs text-neutral-400">Following</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-50">9,999</div>
            <div className="text-xs text-neutral-400">Followers</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-50">999K</div>
            <div className="text-xs text-neutral-400">Likes</div>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-2">
          <button className="flex-none rounded-2xl bg-orange-500 px-15 py-3 text-sm font-semibold text-black hover:bg-orange-400">
            Follow
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
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(`/item/${item.itemId}`)}
              className="aspect-square overflow-hidden bg-neutral-800 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-orange-400"
              aria-label={`Ver producto ${item.itemId}`}
            >
              <img src={item.image} alt={`Grid item ${item.id}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
