"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import ItemCard from "@/components/ItemCard";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Listing, subscribeListings } from "@/lib/marketplace";

export default function DiscoverPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setCurrentUserId(user?.uid ?? null));
  }, []);

  useEffect(() => {
    const unsub = subscribeListings((rows) => setItems(rows));
    return () => unsub();
  }, []);

  const renderedItems = items
    .filter((item) => item.ownerId !== currentUserId && item.status !== "sold")
    .map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        location: item.location,
        image: item.image,
        sellerId: item.ownerId,
        sellerName: item.ownerName,
        sellerAvatar: item.ownerAvatar,
      }));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-24">
        {renderedItems.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-300">
            No hay publicaciones disponibles para descubrir ahora mismo.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderedItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
          <NavIcon icon={Home} label="Inicio" href="/" />
          <NavIcon icon={Navigation} label="Descubre" href="/descubre" active />
          <NavIcon icon={PlusSquare} label="Crear" href="/item/new" />
          <NavIcon icon={MessageCircle} label="Negociacion" href="/messages" />
          <NavIcon icon={User} label="Perfil" href="/profile/me" />
        </div>
      </nav>
    </div>
  );
}

function NavIcon({
  icon: Icon,
  label,
  href,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1 hover:text-white",
    active ? "text-orange-400" : "text-neutral-400",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        <Icon className="h-5 w-5" />
        <span className="text-[11px] hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button className={className} aria-label={label}>
      <Icon className="h-5 w-5" />
      <span className="text-[11px] hidden sm:inline">{label}</span>
    </button>
  );
}
