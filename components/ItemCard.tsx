"use client";

import Link from "next/link";
import { Heart, Share2, MapPin } from "lucide-react";
import { useState } from "react";
import InterestModal from "./InterestModal";

type Item = {
  id: string;
  title: string;
  price: number;
  location: string;
};

export default function ItemCard({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 shadow-lg">
        {/* Image */}
        <div className="relative aspect-[3/4] w-full">
          {/* Placeholder image */}
          <div className="absolute inset-0 bg-neutral-800" />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Floating actions */}
          <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-end gap-3">
            <ActionIcon icon={Heart} />
            <SellerBadge rating={4.5} />
            <ActionIcon icon={Share2} />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 -mt-20 rounded-t-3xl bg-neutral-950 px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">
                {item.title}
              </h3>

              <div className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                <MapPin className="h-3 w-3" />
                {item.location}
              </div>
            </div>

            <div className="shrink-0 text-lg font-bold text-orange-400">
              ${item.price}
            </div>
          </div>

          <p className="mt-2 text-xs text-neutral-400">
            High quality goods
          </p>

          {/* CTA */}
          <div className="mt-4 flex gap-2">
            <Link
              href={`/item/${item.id}`}
              className="w-full rounded-2xl border border-neutral-800 px-4 py-3 text-center text-sm hover:bg-neutral-900"
            >
              Detalles
            </Link>

            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              Me interesa
            </button>
          </div>
        </div>
      </div>

      <InterestModal
        open={open}
        onClose={() => setOpen(false)}
        item={{ ...item, sellerMaxDiscountPercent: 20 }}
      />
    </>
  );
}

function ActionIcon({ icon: Icon }: { icon: any }) {
  return (
    <button className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/90 text-orange-400 shadow-md backdrop-blur hover:scale-105 transition">
      <Icon className="h-5 w-5" />
    </button>
  );
}

function SellerBadge({ rating }: { rating: number }) {
  const avatarUrl =
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&w=400&h=400&q=80";

  return (
    <Link
      href="/profile"
      className="relative flex h-14 w-14 items-center justify-center transition hover:scale-105"
      aria-label="Ver perfil"
    >
      <div className="relative h-12 w-12">
        <div
          className="absolute inset-0 rounded-full border border-orange-500 bg-neutral-900 bg-cover bg-center shadow-lg"
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
        <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-black px-2 py-[2px] text-xs font-bold text-white shadow">
          {rating.toFixed(1)}
        </div>
      </div>
    </Link>
  );
}
