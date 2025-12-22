"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Menu, Search } from "lucide-react";

const categories = ["Todo", "Mujer", "Hombre", "Electrónicos", "Zapatos", "Hogar"];

export default function HomeHeader() {
  const [active, setActive] = useState<string>("Todos");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors ${
        scrolled ? "bg-neutral-950/85 backdrop-blur" : "bg-transparent"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-4">
        {/* Top row */}
        <div className="flex items-center gap-3">
          <button
            className="flex h-10 w-10 items-center justify-center text-white drop-shadow"
            aria-label="Favoritos"
          >
            <Heart className="h-6 w-6" />
          </button>
          <div className="relative flex-1">
            <input
              placeholder="Search for items"
              className="w-full rounded-full border border-white/20 bg-black/30 px-4 py-3 pr-12 text-sm text-white outline-none ring-0 placeholder:text-white/70 focus:border-orange-400"
            />
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
          </div>
        </div>

        {/* Categories + menu */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const isActive = cat === active;
              return (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  className={`whitespace-nowrap rounded-3xl px-4 py-2 text-sm font-semibold transition  ${
                    isActive
                      ? "border border-orange-400 text-orange-400 shadow-[0_0_0_1px_rgba(255,184,79,0.25)]"
                      : "border border-transparent bg-black/20 text-white hover:text-orange-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <Link
            href="/categories"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl  bg-black/30 text-white backdrop-blur hover:text-orange-200"
            aria-label="Categorías"
          >
            <Menu className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
