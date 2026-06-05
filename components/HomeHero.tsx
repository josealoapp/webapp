"use client";

import { useEffect, useState } from "react";
import type { MarketplaceAd } from "@/lib/marketplace-ads";

const fallbackSlides = [
  "https://images.unsplash.com/photo-1509099836639-18ba02e2e908?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1542293787938-4d0950cfddeb?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1542293787938-4d0950cfddeb?auto=format&fit=crop&w=1400&q=80&sat=-50",
];

export default function HomeHero() {
  const [slide, setSlide] = useState(0);
  const [ads, setAds] = useState<MarketplaceAd[]>([]);
  const slides = ads.length
    ? ads.map((ad) => ({ id: ad.id, imageUrl: ad.imageUrl, linkUrl: ad.linkUrl, label: ad.campaignName }))
    : fallbackSlides.map((url, index) => ({ id: `fallback-${index}`, imageUrl: url, linkUrl: "", label: `Slide ${index + 1}` }));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ads/load-failed");
        const payload = (await response.json()) as { ads?: MarketplaceAd[] };
        if (!cancelled) setAds(payload.ads || []);
      })
      .catch(() => {
        if (!cancelled) setAds([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setSlide((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  return (
    <section className="relative h-[15vh] min-h-[180px] w-full overflow-hidden rounded-3xl bg-neutral-950">
      {slides.map((item, i) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-500 ${
            i === slide ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={item.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-xl md:block"
          />
          <img
            src={item.imageUrl}
            alt={item.label}
            className="relative h-full w-full object-cover md:object-contain"
          />
        </div>
      ))}
      {slides[slide]?.linkUrl ? (
        <a
          href={slides[slide].linkUrl}
          className="absolute inset-0 z-10"
          aria-label={`Abrir campaña ${slides[slide].label}`}
        />
      ) : null}

      <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className={`h-2 w-2 rounded-full transition ${
              i === slide ? "bg-orange-400" : "bg-white/50"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
