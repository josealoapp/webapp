"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import AppBottomNav from "@/components/AppBottomNav";
import InterestModal from "@/components/InterestModal";
import SellerAvatar from "@/components/SellerAvatar";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { getLikeRecordId, likeItem, subscribeLikeIdsForUser, unlikeItem } from "@/lib/likes";
import { createItemReport, REPORT_REASONS } from "@/lib/item-reports";
import {
  ChatRecord,
  deleteListing,
  getListingById,
  Listing,
  markBazarItemSold,
  markListingSold,
  recordListingView,
  subscribeChatsForUser,
  updateListingChatAction,
} from "@/lib/marketplace";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { AppSkeleton } from "@/components/AppSkeleton";
import { clearPendingAuthAction, readPendingAuthAction } from "@/lib/pending-auth-action";
import { subscribeVerifiedUser } from "@/lib/user-verified";
import VerifiedBadge from "@/components/VerifiedBadge";

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
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [authResolved, setAuthResolved] = useState(false);
  const [openSoldModal, setOpenSoldModal] = useState(false);
  const [soldWithJosealo, setSoldWithJosealo] = useState<"si" | "no" | "">("");
  const [saleSpeedRating, setSaleSpeedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [soldToUserId, setSoldToUserId] = useState("");
  const [publishingSold, setPublishingSold] = useState(false);
  const [soldError, setSoldError] = useState("");
  const [openBazarMenu, setOpenBazarMenu] = useState(false);
  const [openOwnerActions, setOpenOwnerActions] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [openReportMenu, setOpenReportMenu] = useState(false);
  const [openReportModal, setOpenReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [sellerVerified, setSellerVerified] = useState(false);
  const [listingChats, setListingChats] = useState<ChatRecord[]>([]);
  const [removingReservation, setRemovingReservation] = useState(false);
  const [reservationError, setReservationError] = useState("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

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
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
      setAuthResolved(true);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!openReportMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!reportMenuRef.current?.contains(event.target as Node)) {
        setOpenReportMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openReportMenu]);

  useEffect(() => {
    if (!currentUserId) {
      setLikedIds(new Set());
      return;
    }

    const unsub = subscribeLikeIdsForUser(currentUserId, setLikedIds);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    if (!listing?.ownerId) {
      setSellerVerified(false);
      return;
    }

    const unsub = subscribeVerifiedUser(listing.ownerId, setSellerVerified);
    return () => unsub();
  }, [listing?.ownerId]);

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
        currency: listing.currency || "DOP",
        description: listing.description,
        paymentMethod: listing.paymentMethod,
        images:
          listing.type === "bazar"
            ? bazarImages
            : listing.images?.length
              ? listing.images
              : [listing.image].filter(Boolean),
        sellerName: listing.ownerName,
        sellerId: listing.ownerId,
        sellerAvatar: listing.ownerAvatar,
        sellerWhatsappNumber: listing.sellerWhatsappNumber,
        sellerUsesWhatsapp: listing.sellerUsesWhatsapp,
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
  const isReserved = Boolean(listing?.reservedForUserId && !isSold);
  const reservedForName = listing?.reservedForUserName || "comprador";
  const reservedBuyerChat = useMemo(
    () => listingChats.find((chat) => chat.buyerId === listing?.reservedForUserId) || null,
    [listing?.reservedForUserId, listingChats]
  );
  const isRemovedBySupport = listing?.status === "removed_by_support" || listing?.status === "account_deactivated";
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
  const displayCurrency = selectedBazarItem?.currency || item?.currency || "DOP";
  const displayCategory = selectedBazarItem ? `${item?.category || "Bazar"} · Artículo` : item?.category || "";
  const reservedItemNoun = /veh[ií]culo|auto|motocicleta|camion|camión/i.test(displayCategory)
    ? "vehículo"
    : "artículo";
  const likeRecordId = useMemo(() => {
    if (!currentUserId || !item?.id) return "";
    return getLikeRecordId(currentUserId, item.id, selectedBazarItem?.id);
  }, [currentUserId, item?.id, selectedBazarItem?.id]);
  const isLiked = likeRecordId ? likedIds.has(likeRecordId) : false;

  useEffect(() => {
    if (!authResolved || !listing?.id) return;
    if (currentUserId && currentUserId === listing.ownerId) return;

    void recordListingView(listing.id, selectedBazarItemId).catch(() => {});
  }, [authResolved, currentUserId, listing?.id, listing?.ownerId, selectedBazarItemId]);

  useEffect(() => {
    if (!authResolved || !item || isOwnListing) return;
    if (searchParams.get("continueOffer") !== "1") return;

    setOpenInterest(true);
  }, [authResolved, isOwnListing, item, searchParams]);

  useEffect(() => {
    if (!currentUserId || !listing?.id || listing.ownerId !== currentUserId) {
      setListingChats([]);
      return;
    }

    return subscribeChatsForUser(
      currentUserId,
      "seller",
      (rows) => setListingChats(rows.filter((chat) => chat.listingId === listing.id)),
      () => setListingChats([])
    );
  }, [currentUserId, listing?.id, listing?.ownerId]);

  useEffect(() => {
    if (!authResolved || !currentUserId || !item?.id || isOwnListing) return;

    const pending = readPendingAuthAction();
    if (!pending || pending.type !== "interest" || pending.listingId !== item.id) return;

    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (pending.returnTo !== currentPath) return;

    clearPendingAuthAction();
    window.sessionStorage.removeItem("pending_interest");
    setOpenInterest(true);
  }, [authResolved, currentUserId, isOwnListing, item?.id]);
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
      currency: listing.currency || "DOP",
      category: listing.category,
      description: listing.description,
      tags: listing.tags.join(", "),
      paymentMethod: listing.paymentMethod,
      location: listing.location,
    }).toString();
  }, [listing]);

  const toggleLike = async () => {
    if (!item?.id || !item.sellerId) return;

    const href = `/item/${item.id}${
      selectedBazarItem?.id ? `?bazarItemId=${encodeURIComponent(selectedBazarItem.id)}` : ""
    }`;

    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent(href)}`);
      return;
    }

    if (isLiked) {
      await unlikeItem(currentUserId, item.id, selectedBazarItem?.id);
      return;
    }

    await likeItem({
      actorId: currentUserId,
      actorName: currentUserName,
      ownerId: item.sellerId,
      ownerName: item.sellerName || "Vendedor",
      listingId: item.id,
      ...(selectedBazarItem?.id ? { bazarItemId: selectedBazarItem.id } : {}),
      itemTitle: displayTitle,
      image: images[0] || "",
      price: displayPrice,
      location: item.location,
      href,
    });
  };

  const openWhatsappInterest = () => {
    if (!item?.sellerWhatsappNumber || !item?.sellerName) {
      setOpenInterest(true);
      return;
    }

    if (currentUserId && item.sellerId === currentUserId) {
      setOpenInterest(true);
      return;
    }

    const itemUrl = typeof window !== "undefined" ? window.location.href : "";
    const url = buildWhatsappUrl({
      phone: item.sellerWhatsappNumber,
      vendorName: item.sellerName,
      itemName: selectedBazarItem ? selectedBazarItem.title : item.title,
      itemUrl,
    });

    if (!url) {
      setOpenInterest(true);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenReportModal = () => {
    setOpenReportMenu(false);
    setOpenReportModal(true);
    setReportError("");
    setReportSuccess("");
  };

  const handleSubmitReport = async () => {
    if (!item) return;

    if (!auth.currentUser) {
      const href = `/item/${item.id}${selectedBazarItem?.id ? `?bazarItemId=${encodeURIComponent(selectedBazarItem.id)}` : ""}`;
      router.push(`/sign-in?next=${encodeURIComponent(href)}`);
      return;
    }

    if (!reportReason) {
      setReportError("Selecciona una razón de reporte.");
      return;
    }

    if (reportReason === "otro" && !reportDetails.trim()) {
      setReportError("Escribe el detalle del reporte.");
      return;
    }

    setSubmittingReport(true);
    setReportError("");
    setReportSuccess("");

    try {
      await createItemReport({
        listingId: item.id,
        bazarItemId: selectedBazarItem?.id,
        sellerId: item.sellerId,
        itemTitle: selectedBazarItem ? selectedBazarItem.title : item.title,
        reason: reportReason,
        details: reportReason === "otro" ? reportDetails.trim() : "",
      });
      setReportSuccess("Reporte enviado.");
      setReportReason("");
      setReportDetails("");
      window.setTimeout(() => {
        setOpenReportModal(false);
        setReportSuccess("");
      }, 900);
    } catch {
      setReportError("No pudimos enviar el reporte. Intenta de nuevo.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleRemoveReservation = async () => {
    if (!listing?.id || removingReservation) return;

    setRemovingReservation(true);
    setReservationError("");

    try {
      await updateListingChatAction({
        listingId: listing.id,
        chatId: reservedBuyerChat?.id,
        action: "unreserve",
      });
      setListing((current) =>
        current
          ? {
              ...current,
              reservedForUserId: "",
              reservedForUserName: "",
              reservedAt: undefined,
            }
          : current
      );
    } catch {
      setReservationError("No pudimos remover la reservación. Intenta de nuevo.");
    } finally {
      setRemovingReservation(false);
    }
  };

  const handleEditListing = () => {
    if (!item?.id) return;
    setOpenOwnerActions(false);
    router.push(`/item/new?listingId=${encodeURIComponent(item.id)}`);
  };

  const handleDeleteListing = async () => {
    if (!item?.id || deletingListing) return;

    setDeletingListing(true);
    setDeleteError("");
    try {
      await deleteListing(item.id);
      setOpenOwnerActions(false);
      router.replace("/profile/me");
    } catch {
      setDeleteError("No pudimos eliminar este artículo. Intenta de nuevo.");
    } finally {
      setDeletingListing(false);
    }
  };

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

  if (isRemovedBySupport) {
    return (
      <div className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-50">
        <div className="mx-auto max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
          <div className="text-lg font-semibold">Cuenta desactivada por soporte</div>
          <div className="mt-3 text-sm leading-6 text-neutral-400">
            Esta publicación no está disponible por una acción de soporte o moderación.
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-5 h-11 rounded-2xl border border-neutral-800 px-5 text-sm font-semibold text-neutral-100"
          >
            Volver
          </button>
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
                <img
                  src={src}
                  alt={`${item.title} ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
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
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{isOwnListing && item.type === "bazar" ? "Mi bazar" : item.sellerName || "Vendedor"}</span>
                      {sellerVerified ? <VerifiedBadge className="h-3.5 w-3.5" /> : null}
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLike}
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur active:scale-95",
                  isLiked
                    ? "border-orange-400 bg-orange-500/20 text-orange-400"
                    : "border-neutral-800 bg-neutral-900/80 text-neutral-50",
                ].join(" ")}
                aria-label={isLiked ? "Quitar like" : "Dar like"}
              >
                <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
              </button>
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
        <div className="mx-auto max-w-md px-4 pb-56 pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-800" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-neutral-400">{displayCategory}</div>
              <div className="mt-1 text-2xl font-semibold leading-tight text-neutral-50">
                {displayTitle}
              </div>
            </div>
            {isOwnListing ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setOpenOwnerActions(true);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-neutral-200"
                aria-label="Acciones del artículo"
              >
                <MoreHorizontal className="h-6 w-6" />
              </button>
            ) : (
              <div ref={reportMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenReportMenu((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-200"
                  aria-label="Opciones"
                >
                  <MoreHorizontal className="h-6 w-6" />
                </button>

                {openReportMenu ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[160px] rounded-2xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={handleOpenReportModal}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-200 hover:bg-neutral-800"
                    >
                      Reportar
                    </button>
                  </div>
                ) : null}
              </div>
            )}
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
                        {formatMoney(Number(bazarItem.price), bazarItem.currency || item.currency || "DOP")}
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

          {isOwnListing && listingChats.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-semibold text-neutral-100">
                  <MessageCircle className="h-4 w-4 text-neutral-400" />
                  <span>Negociaciones</span>
                </div>
                <Link href="/messages" className="text-xs font-semibold text-orange-400 hover:text-orange-200">
                  Ver todas
                </Link>
              </div>

              <div className="space-y-2">
                {listingChats.slice(0, 5).map((chat) => {
                  const unreadCount = Math.max(0, Number(chat.unreadBy?.[currentUserId] || 0));

                  return (
                    <Link
                      key={chat.id}
                      href={`/chat/${chat.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3 hover:border-orange-400/70"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-200">
                        {(chat.buyerName || "C").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-neutral-100">{chat.buyerName || "Comprador"}</div>
                          {unreadCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-bold leading-none text-black">
                              {unreadCount > 99 ? "+99" : unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-neutral-400">
                          {chat.lastMessage || "Nueva negociación iniciada"}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] text-neutral-500">
                        {chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : ""}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isSold ? (
            <div className="mt-6 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              Esta publicación fue marcada como vendida.
            </div>
          ) : null}
          {isReserved ? (
            <div className="mt-6 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm leading-6 text-orange-200">
              {isOwnListing ? (
                <div className="space-y-3">
                  <p>
                    Reservaste este {reservedItemNoun} para {reservedForName}. Si {reservedForName} ya no está interesado haz click en "Remover reservación".
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRemoveReservation()}
                    disabled={removingReservation}
                    className="h-10 rounded-2xl border border-orange-400/40 bg-orange-400/10 px-4 text-sm font-semibold text-orange-100 hover:bg-orange-400/20 disabled:opacity-60"
                  >
                    {removingReservation ? "Removiendo..." : "Remover reservación"}
                  </button>
                  {reservationError ? <div className="text-xs text-red-200">{reservationError}</div> : null}
                </div>
              ) : (
                "Este artículo está reservado. Aún puedes contactar al vendedor con una mejor oferta."
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* FIXED BOTTOM BAR */}
      <div className="fixed bottom-[56px] left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">
              {item.type === "bazar" && !selectedBazarItem ? "Valor estimado" : "Precio"}
            </div>
            <div className="text-lg font-semibold text-neutral-50">
              {formatMoney(Number(item.type === "bazar" && !selectedBazarItem ? estimatedBazarValue : displayPrice), displayCurrency)}
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
                    .then((result) => {
                      setListing((current) =>
                        current
                          ? {
                              ...current,
                              bazarItems: result.bazarItems || current.bazarItems,
                              status: result.status || current.status,
                              soldAt: result.status === "sold" ? result.soldAt : current.soldAt,
                            }
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
              if (item.sellerUsesWhatsapp && item.sellerWhatsappNumber?.trim()) {
                openWhatsappInterest();
                return;
              }
              setOpenInterest(true);
            }}
            disabled={publishingSold || (!isOwnListing && (isSold || isSelectedBazarItemSold))}
          >
            {isOwnListing ? (
              item.type === "bazar" && selectedBazarItem ? (
                isSelectedBazarItemSold ? (
                  "Vendido"
                ) : (
                  "Marcar vendido"
                )
              ) : item.type === "bazar" ? (
                "Editar"
              ) : isSold ? (
                "Publicar de nuevo"
              ) : (
                "Marcar vendido"
              )
            ) : isSold || isSelectedBazarItemSold ? (
              "Vendido"
            ) : (
              <span className="inline-flex items-center gap-2">
                {item.sellerUsesWhatsapp && item.sellerWhatsappNumber?.trim() ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <span>Estoy interesado</span>
              </span>
            )}
          </Button>
        </div>
      </div>

      <AppBottomNav active="home" />

      <InterestModal
        open={openInterest}
        onClose={() => setOpenInterest(false)}
        item={{
          id: item.id,
          title: selectedBazarItem ? selectedBazarItem.title : item.title,
          price: selectedBazarItem ? selectedBazarItem.price : item.price,
          currency: displayCurrency,
          sellerId: item.sellerId,
          sellerName: isOwnListing && item.type === "bazar" ? "Mi bazar" : item.sellerName,
          sellerWhatsappNumber: item.sellerWhatsappNumber,
          sellerUsesWhatsapp: item.sellerUsesWhatsapp,
          sellerMaxDiscountPercent: item.sellerMaxDiscountPercent ?? 10,
          paymentMethod: item.paymentMethod,
        }}
      />

      {openOwnerActions ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOpenOwnerActions(false)}
            aria-label="Cerrar acciones"
          />
          <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-800" />
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-2xl border-neutral-800 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 hover:text-white"
                onClick={handleEditListing}
              >
                Editar artículo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-2xl border-red-900/60 bg-red-950/20 text-red-200 hover:bg-red-950/40 hover:text-red-100"
                onClick={handleDeleteListing}
                disabled={deletingListing}
              >
                {deletingListing ? "Eliminando..." : "Eliminar artículo"}
              </Button>
            </div>
            {deleteError ? (
              <div className="mt-3 rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                {deleteError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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

            {listingChats.length > 0 ? (
              <div className="mt-5">
                <div className="text-sm font-medium text-neutral-200">¿A quién se lo vendiste?</div>
                <select
                  value={soldToUserId}
                  onChange={(event) => setSoldToUserId(event.target.value)}
                  className="mt-3 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 outline-none focus:border-orange-400"
                >
                  <option value="">Seleccionar comprador</option>
                  {listingChats.map((chat) => (
                    <option key={chat.buyerId} value={chat.buyerId}>
                      {chat.buyerName || "Comprador"}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-neutral-500">
                  Ordenado por la conversación más reciente.
                </div>
              </div>
            ) : null}

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
                  if (listingChats.length > 0 && !soldToUserId) {
                    setSoldError("Selecciona a quién se lo vendiste.");
                    return;
                  }

                  setPublishingSold(true);
                  setSoldError("");

                  try {
                    const soldToChat = listingChats.find((chat) => chat.buyerId === soldToUserId);
                    const result = await markListingSold(listing.id, {
                      soldWithJosealo: soldWithJosealo === "si",
                      saleSpeedRating,
                      soldToUserId: soldToChat?.buyerId,
                      soldToUserName: soldToChat?.buyerName,
                    });
                    setListing((current) =>
                      current
                        ? {
                            ...current,
                            status: "sold",
                            soldAt: result.soldAt || Date.now(),
                            soldWithJosealo: soldWithJosealo === "si",
                            saleSpeedRating,
                          }
                        : current
                    );
                    setOpenSoldModal(false);
                    setSoldToUserId("");
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

      {openReportModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-10 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-2xl">
            <div className="text-lg font-semibold">Razon de reporte</div>
            <div className="mt-1 text-sm text-neutral-400">
              Selecciona la razón por la que deseas reportar este artículo.
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-neutral-200">Razon</label>
              <select
                value={reportReason}
                onChange={(event) => {
                  setReportReason(event.target.value);
                  setReportError("");
                  setReportSuccess("");
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 outline-none focus:border-orange-400"
              >
                <option value="">Selecciona una opción</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {reportReason === "otro" ? (
              <div className="mt-4">
                <label className="text-sm font-medium text-neutral-200">Detalle</label>
                <textarea
                  value={reportDetails}
                  onChange={(event) => {
                    setReportDetails(event.target.value);
                    setReportError("");
                    setReportSuccess("");
                  }}
                  placeholder="Escribe el motivo del reporte"
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none focus:border-orange-400"
                />
              </div>
            ) : null}

            {reportError ? (
              <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
                {reportError}
              </div>
            ) : null}

            {reportSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
                {reportSuccess}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={submittingReport}
              className="mt-5 h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
            >
              {submittingReport ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function formatMoney(value: number, currency: "DOP" | "USD" = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString()}`;
}
