"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Share2, Star } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import InterestModal from "@/components/InterestModal";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { getListingById, Listing } from "@/lib/marketplace";
import { AppSkeleton } from "@/components/AppSkeleton";

export default function ItemDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [openInterest, setOpenInterest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!id) return;

    getListingById(id)
      .then((row) => {
        if (!mounted) return;
        setListing(row);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || "");
    });

    return () => unsub();
  }, []);

  const item = useMemo(() => {
    if (!id) return null;

    if (listing) {
      return {
        id: listing.id,
        category: listing.category,
        title: listing.title,
        location: listing.location,
        price: listing.price,
        description: listing.description,
        images: [listing.image],
        sellerName: listing.ownerName,
        sellerId: listing.ownerId,
        sellerMaxDiscountPercent: 10,
      };
    }

    if (loading) return null;

    return {
      id,
      category: "Catálogo",
      title: `Producto ${id}`,
      location: "Santo Domingo, RD",
      price: 4500,
      description:
        "Este producto no existe o fue removido. Prueba con otra publicación.",
      images: [
        "https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=1200&q=80",
      ],
      sellerName: "Vendedor",
      sellerId: "seller",
      sellerMaxDiscountPercent: 10,
    };
  }, [id, listing, loading]);

  const images = item?.images?.length ? item.images : [];
  const isOwnListing = Boolean(item?.sellerId && currentUserId === item.sellerId);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const els = slideRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!visible) return;

        const idx = Number((visible.target as HTMLElement).dataset.index ?? 0);
        setActiveIndex(idx);
      },
      { root, threshold: [0.55, 0.7, 0.85] }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [images.length]);

  const goTo = (index: number) => {
    const el = slideRefs.current[index];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  if (!item) {
    if (loading) {
      return <AppSkeleton variant="detail" />;
    }

    return (
      <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="text-lg font-semibold">Producto no encontrado</div>
          <Button className="mt-4" onClick={() => router.push("/")}>
            Volver al home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-neutral-950 text-neutral-100">
      {/* HERO CAROUSEL */}
      <div className="relative h-[62vh] w-full overflow-hidden">
        <div
          ref={scrollerRef}
          className="
            absolute inset-0
            flex h-full w-full overflow-x-auto
            snap-x snap-mandatory scroll-smooth
            no-scrollbar
          "
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {images.map((src, i) => (
            <div
              key={src + i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-index={i}
                className="relative h-full w-full flex-shrink-0 snap-start"
            >
              <Image
                src={src}
                alt={`${item.title} ${i + 1}`}
                fill
                priority={i === 0}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
            </div>
          ))}
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-16 right-4 z-20 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          {activeIndex + 1}/{images.length}
        </div>

        {/* TOP BAR */}
        <div className="absolute left-0 right-0 top-0 z-20 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-50 shadow-sm backdrop-blur active:scale-95"
                aria-label="Volver"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 rounded-2xl  backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-lg font-semibold">
                  {(item.sellerName || "V").trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {item.sellerName || "Vendedor"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-300">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <Star className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-50 shadow-sm backdrop-blur active:scale-95"
                aria-label="Compartir"
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: item.title,
                        text: item.title,
                        url: window.location.href,
                      })
                      .catch(() => {});
                  }
                }}
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* DOTS */}
        <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={[
                "h-2 w-2 rounded-full transition-all",
                i === activeIndex ? "bg-white scale-110" : "bg-white/45",
              ].join(" ")}
              aria-label={`Imagen ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* CONTENT SHEET */}
      <div className="relative z-30 -mt-8 rounded-t-3xl border-t border-neutral-800 bg-neutral-950 text-neutral-50">
        <div className="mx-auto max-w-md px-4 pb-28 pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-800" />
          <div className="text-xs font-medium text-neutral-400">{item.category}</div>
          <div className="mt-1 text-2xl font-semibold leading-tight text-neutral-50">
            {item.title}
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              📍
            </span>
            <span>{item.location}</span>
          </div>

          <div className="mt-6">
            <div className="text-base font-semibold text-neutral-100">Descripción</div>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{item.description}</p>
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">Precio</div>
            <div className="text-lg font-semibold text-neutral-50">
              RD${Number(item.price).toLocaleString()}
            </div>
          </div>

          <Button
            className="h-12 rounded-2xl px-5 bg-orange-400 text-black hover:bg-orange-300"
            onClick={() => {
              if (isOwnListing) return;
              setOpenInterest(true);
            }}
            disabled={isOwnListing}
          >
            {isOwnListing ? "Es tu publicación" : "Estoy interesado"}
          </Button>
        </div>
      </div>

      <InterestModal
        open={openInterest}
        onClose={() => setOpenInterest(false)}
        item={{
          id: item.id,
          title: item.title,
          price: item.price,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          sellerMaxDiscountPercent: item.sellerMaxDiscountPercent ?? 10,
        }}
      />
    </div>
  );
}
