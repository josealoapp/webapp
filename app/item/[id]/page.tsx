"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, MoreHorizontal, Share2, Star } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import InterestModal from "@/components/InterestModal";
import SellerAvatar from "@/components/SellerAvatar";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { getListingById, Listing, markBazarItemSold, markListingSold } from "@/lib/marketplace";
import { AppSkeleton } from "@/components/AppSkeleton";

export default function ItemDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;

  const [openInterest, setOpenInterest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [openSoldModal, setOpenSoldModal] = useState(false);
  const [soldWithJosealo, setSoldWithJosealo] = useState<"si" | "no" | "">("");
  const [saleSpeedRating, setSaleSpeedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [publishingSold, setPublishingSold] = useState(false);
  const [soldError, setSoldError] = useState("");
  const [openBazarMenu, setOpenBazarMenu] = useState(false);

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
      const bazarItems = listing.bazarItems || [];
      const bazarImages = bazarItems.map((entry) => entry.image).filter(Boolean);
      return {
        id: listing.id,
        category:
          listing.type === "bazar"
            ? `Bazar${listing.bazarCategory ? ` · ${listing.bazarCategory}` : ""}`
            : listing.category,
        title: listing.title,
        location: listing.location,
        price: listing.price,
        description: listing.description,
        images: listing.type === "bazar" ? bazarImages : [listing.image],
        sellerName: listing.ownerName,
        sellerId: listing.ownerId,
        sellerAvatar: listing.ownerAvatar,
        bazarItems,
        type: listing.type || "article",
        sellerMaxDiscountPercent: 10,
      };
    }

    return null;
  }, [id, listing, loading]);
  const selectedBazarItemId = searchParams.get("bazarItemId") || "";
  const selectedBazarItem = useMemo(() => {
    if (item?.type !== "bazar" || !selectedBazarItemId) return null;
    return item.bazarItems.find((entry) => entry.id === selectedBazarItemId) || null;
  }, [item, selectedBazarItemId]);

  const isOwnListing = Boolean(item?.sellerId && currentUserId === item.sellerId);
  const isSold = listing?.status === "sold";
  const isSelectedBazarItemSold = selectedBazarItem?.status === "sold";
  const isBazarRoot = item?.type === "bazar" && !selectedBazarItem;
  const estimatedBazarValue = useMemo(() => {
    if (item?.type !== "bazar") return 0;
    return (item.bazarItems || [])
      .filter((entry) => entry.status !== "sold")
      .reduce((sum, entry) => sum + Number(entry.price || 0), 0);
  }, [item]);
  const displayTitle = selectedBazarItem?.title || item?.title || "";
  const displayDescription = selectedBazarItem?.description || item?.description || "";
  const displayPrice = selectedBazarItem?.price || item?.price || 0;
  const displayCategory = selectedBazarItem ? `${item?.category || "Bazar"} · Artículo` : item?.category || "";
  const images = useMemo(() => {
    if (isSold) {
      return [] as string[];
    }

    if (selectedBazarItem?.image) {
      return [selectedBazarItem.image];
    }

    return item?.images?.length ? item.images : [];
  }, [isSold, item, selectedBazarItem]);
  const republishParams = useMemo(() => {
    if (!listing) return "";

    return new URLSearchParams({
      title: listing.title,
      price: String(listing.price),
      category: listing.category,
      description: listing.description,
      tags: listing.tags.join(", "),
      paymentMethod: listing.paymentMethod,
      location: listing.location,
    }).toString();
  }, [listing]);

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
        {images.length > 0 ? (
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
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 text-center">
            <div className="text-sm font-medium text-neutral-300">Imagen no disponible</div>
            <div className="mt-2 max-w-[220px] text-xs leading-5 text-neutral-500">
              {isSold
                ? "Las publicaciones del histórico conservan la información, pero ya no muestran sus fotos."
                : "Esta publicación no tiene fotos disponibles."}
            </div>
          </div>
        )}

        {/* Slide counter */}
        {images.length > 0 ? (
          <div className="absolute bottom-16 right-4 z-20 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {activeIndex + 1}/{images.length}
          </div>
        ) : null}

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
                <Link
                  href={isOwnListing ? "/profile/me" : `/profile/${item.sellerId}?name=${encodeURIComponent(item.sellerName || "Vendedor")}`}
                  className="flex items-center gap-3"
                >
                  <SellerAvatar
                    userId={item.sellerId}
                    name={item.sellerName || "Vendedor"}
                    avatarUrl={item.sellerAvatar}
                    className="h-10 w-10"
                    initialsClassName="text-lg font-semibold"
                    imageClassName="object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {isOwnListing && item.type === "bazar" ? "Mi bazar" : item.sellerName || "Vendedor"}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <Star className="h-3.5 w-3.5 text-neutral-500" />
                    </div>
                  </div>
                </Link>
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
                        title: displayTitle,
                        text: selectedBazarItem ? `${selectedBazarItem.title} en ${item.title}` : displayTitle,
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
        {images.length > 0 ? (
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
        ) : null}
      </div>

      {/* CONTENT SHEET */}
      <div className="relative z-30 -mt-8 rounded-t-3xl border-t border-neutral-800 bg-neutral-950 text-neutral-50">
        <div className="mx-auto max-w-md px-4 pb-28 pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-800" />
          <div className="text-xs font-medium text-neutral-400">{displayCategory}</div>
          <div className="mt-1 text-2xl font-semibold leading-tight text-neutral-50">
            {displayTitle}
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              📍
            </span>
            <span>{item.location}</span>
          </div>

          {item.type === "bazar" ? (
            <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Bazar</div>
                  <div className="mt-1 text-base font-semibold text-neutral-100">
                    {isOwnListing ? "Mi bazar" : item.sellerName}
                  </div>
                </div>
                {isOwnListing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenBazarMenu(true);
                    }}
                    className="flex h-11 w-11 items-center justify-center text-neutral-100"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                ) : (
                  <Link
                    href={`/profile/${item.sellerId}?name=${encodeURIComponent(item.sellerName || "Vendedor")}`}
                    className="flex h-11 items-center rounded-xl border border-neutral-700 px-4 text-sm font-semibold text-neutral-100"
                  >
                    Ver perfil
                  </Link>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="text-base font-semibold text-neutral-100">Descripción</div>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{displayDescription}</p>
          </div>

          {item.type === "bazar" && item.bazarItems.length > 0 && isBazarRoot ? (
            <div className="mt-6">
              <div className="text-base font-semibold text-neutral-100">Artículos del bazar</div>
              <div className="mt-3 space-y-3">
                {item.bazarItems.map((bazarItem) => {
                  const isSoldItem = bazarItem.status === "sold";
                  if (!isOwnListing && isSoldItem) return null;

                  return (
                  <button
                    key={bazarItem.id}
                    type="button"
                    onClick={() => router.push(`/item/${item.id}?bazarItemId=${bazarItem.id}`)}
                    className={[
                      "flex w-full gap-3 rounded-2xl border border-neutral-800 p-3 text-left",
                      isSoldItem ? "bg-neutral-900/40 opacity-60" : "bg-neutral-900/70",
                    ].join(" ")}
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-800">
                      {bazarItem.image ? (
                        <Image
                          src={bazarItem.image}
                          alt={bazarItem.title}
                          width={80}
                          height={80}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-neutral-100">{bazarItem.title}</div>
                      <p className="mt-1 text-xs leading-5 text-neutral-400">{bazarItem.description}</p>
                      {isSoldItem ? (
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Vendido</div>
                      ) : null}
                      <div className="mt-2 text-sm font-semibold text-orange-400">
                        RD${Number(bazarItem.price).toLocaleString()}
                      </div>
                    </div>
                  </button>
                )})}
              </div>
            </div>
          ) : null}

          {item.type === "bazar" && selectedBazarItem ? (
            <button
              type="button"
              onClick={() => router.push(`/item/${item.id}`)}
              className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-100"
            >
              Ver bazar completo
            </button>
          ) : null}

          {isSold ? (
            <div className="mt-6 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              Esta publicación fue marcada como vendida.
            </div>
          ) : null}
        </div>
      </div>

      {/* FIXED BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">
              {item.type === "bazar" && !selectedBazarItem ? "Valor estimado" : "Precio"}
            </div>
            <div className="text-lg font-semibold text-neutral-50">
              RD${Number(item.type === "bazar" && !selectedBazarItem ? estimatedBazarValue : displayPrice).toLocaleString()}
            </div>
          </div>

          <Button
            className="h-12 rounded-2xl px-5 bg-orange-400 text-black hover:bg-orange-300"
            onClick={() => {
              if (isOwnListing) {
                if (item.type === "bazar" && selectedBazarItem) {
                  if (isSelectedBazarItemSold || publishingSold) return;
                  setPublishingSold(true);
                  setSoldError("");
                  markBazarItemSold(item.id, selectedBazarItem.id)
                    .then(() => {
                      setListing((current) =>
                        current
                          ? (() => {
                              const soldAt = Date.now();
                              const nextItems = (current.bazarItems || []).map((entry) =>
                                entry.id === selectedBazarItem.id
                                  ? { ...entry, status: "sold" as const, soldAt }
                                  : entry
                              );
                              const allItemsSold =
                                nextItems.length > 0 && nextItems.every((entry) => entry.status === "sold");

                              return {
                                ...current,
                                bazarItems: nextItems,
                                status: allItemsSold ? "sold" : current.status,
                                soldAt: allItemsSold ? soldAt : current.soldAt,
                              };
                            })()
                          : current
                      );
                    })
                    .catch(() => {
                      setSoldError("No pudimos marcar este artículo como vendido. Intenta de nuevo.");
                    })
                    .finally(() => setPublishingSold(false));
                  return;
                }
                if (item.type === "bazar") {
                  router.push(`/item/new?listingId=${item.id}`);
                  return;
                }
                if (isSold && republishParams) {
                  router.push(`/item/new?${republishParams}`);
                  return;
                }
                setSoldError("");
                setOpenSoldModal(true);
                return;
              }
              if (isSold) return;
              setOpenInterest(true);
            }}
            disabled={publishingSold || (!isOwnListing && (isSold || isSelectedBazarItemSold))}
          >
            {isOwnListing
              ? item.type === "bazar" && selectedBazarItem
                ? isSelectedBazarItemSold
                  ? "Vendido"
                  : "Marcar vendido"
                : item.type === "bazar"
                ? "Editar"
                : isSold
                  ? "Publicar de nuevo"
                  : "Marcar vendido"
              : isSold || isSelectedBazarItemSold
                ? "Vendido"
                : "Estoy interesado"}
          </Button>
        </div>
      </div>

      <InterestModal
        open={openInterest}
        onClose={() => setOpenInterest(false)}
        item={{
          id: item.id,
          title: selectedBazarItem ? selectedBazarItem.title : item.title,
          price: selectedBazarItem ? selectedBazarItem.price : item.price,
          sellerId: item.sellerId,
          sellerName: isOwnListing && item.type === "bazar" ? "Mi bazar" : item.sellerName,
          sellerMaxDiscountPercent: item.sellerMaxDiscountPercent ?? 10,
        }}
      />

      {soldError && item.type === "bazar" && selectedBazarItem ? (
        <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {soldError}
        </div>
      ) : null}

      {openSoldModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-10 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-2xl">
            <div className="text-lg font-semibold">Marcar como vendido</div>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Publica un cierre rapido de tu venta para ayudarnos a mejorar JOSEALO.
            </p>

            <div className="mt-5">
              <div className="text-sm font-medium text-neutral-200">¿Lo vendiste gracias a Josealo?</div>
              <div className="mt-3 flex gap-3">
                {[
                  { value: "si" as const, label: "Si" },
                  { value: "no" as const, label: "No" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={[
                      "flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
                      soldWithJosealo === option.value
                        ? "border-orange-400 bg-orange-400/10 text-orange-200"
                        : "border-neutral-800 bg-neutral-900 text-neutral-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="soldWithJosealo"
                      value={option.value}
                      checked={soldWithJosealo === option.value}
                      onChange={() => setSoldWithJosealo(option.value)}
                      className="h-4 w-4 accent-orange-400"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-medium text-neutral-200">
                Del 1 al 5, ¿qué tanto te tomó venderlo siendo 1 mucho tiempo y 5 poco tiempo?
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className={[
                      "flex items-center justify-center rounded-2xl border px-0 py-3 text-sm font-semibold",
                      saleSpeedRating === value
                        ? "border-orange-400 bg-orange-400/10 text-orange-200"
                        : "border-neutral-800 bg-neutral-900 text-neutral-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="saleSpeedRating"
                      value={value}
                      checked={saleSpeedRating === value}
                      onChange={() => setSaleSpeedRating(value as 1 | 2 | 3 | 4 | 5)}
                      className="sr-only"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>

            {soldError ? (
              <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                {soldError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (publishingSold) return;
                  setOpenSoldModal(false);
                }}
                className="h-12 flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!listing) return;
                  if (!soldWithJosealo) {
                    setSoldError("Selecciona si la venta fue gracias a Josealo.");
                    return;
                  }
                  if (!saleSpeedRating) {
                    setSoldError("Selecciona un valor del 1 al 5.");
                    return;
                  }

                  setPublishingSold(true);
                  setSoldError("");

                  try {
                    await markListingSold(listing.id, {
                      soldWithJosealo: soldWithJosealo === "si",
                      saleSpeedRating,
                    });
                    setListing((current) =>
                      current
                        ? {
                            ...current,
                            status: "sold",
                            soldAt: Date.now(),
                            soldWithJosealo: soldWithJosealo === "si",
                            saleSpeedRating,
                          }
                        : current
                    );
                    setOpenSoldModal(false);
                  } catch {
                    setSoldError("No pudimos marcar la publicación como vendida. Intenta de nuevo.");
                  } finally {
                    setPublishingSold(false);
                  }
                }}
                disabled={publishingSold}
                className="h-12 flex-1 rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {publishingSold ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openBazarMenu ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-10 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-100 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setOpenBazarMenu(false);
              }}
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-300 hover:bg-red-500/15"
            >
              Finalizar bazar
            </button>
            <button
              type="button"
              onClick={() => setOpenBazarMenu(false)}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
