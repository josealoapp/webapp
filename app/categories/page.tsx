"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { appCategories } from "@/lib/categories";

export default function CategoriesPage() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return appCategories;
    return appCategories.filter((c) => c.name.toLowerCase().includes(term));
  }, [q]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar categorías"
              className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 pr-12 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          </div>
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-6 text-center text-sm text-neutral-300">
            No encontramos categorías para “{q}”.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {filtered.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-4 text-center transition hover:border-orange-400"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-800/80">
                  <img src={cat.image} alt={cat.name} className="h-20 w-20 rounded-full object-cover" />
                </div>
                <div className="text-sm font-semibold text-neutral-100 group-hover:text-orange-300">{cat.name}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
