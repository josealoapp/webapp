"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { appCategories } from "@/lib/categories";

const sampleItems = Array.from({ length: 9 }, (_, i) => ({
  id: `item-${i}`,
  title: `Producto ${i + 1}`,
  price: 1200 + i * 150,
  image: `https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80&sat=-10&sig=${i}`,
}));

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [q, setQ] = useState("");

  const category = useMemo(() => appCategories.find((c) => c.id === params?.id), [params?.id]);
  if (!category) return notFound();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sampleItems;
    return sampleItems.filter((item) => item.title.toLowerCase().includes(term));
  }, [q]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link
            href="/categories"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar en ${category.name}`}
              className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 pr-12 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <div className="mb-4 text-sm text-neutral-400">
          {filtered.length} resultados en {category.name}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 shadow-sm transition hover:border-orange-400"
            >
              <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-neutral-800">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              </div>
              <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
              <div className="text-sm text-orange-400">RD${item.price.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
