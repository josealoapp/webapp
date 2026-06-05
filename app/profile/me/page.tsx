"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Instagram, Settings, Star, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import AppBottomNav from "@/components/AppBottomNav";
import CategoryStories from "@/components/CategoryStories";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileTags from "@/components/ProfileTags";
import { auth } from "@/lib/firebase";
import { subscribeFollowers } from "@/lib/follows";
import { subscribeIncomingLikesForOwner } from "@/lib/likes";
import {
  isListingVisibleInOwnerProfile,
  listOwnerListings,
  Listing,
  syncOwnerAvatarAcrossListings,
  uploadListingImages,
} from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";
import { subscribeProfileAvatar, writeProfileAvatar } from "@/lib/profile-avatar";
import { getOrCreateUserHandle } from "@/lib/user-handle";
import { subscribeVerifiedUser } from "@/lib/user-verified";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ProfileTag, subscribeProfileTags } from "@/lib/profile-tags";
import { getAccountAgeLabel } from "@/lib/profile-account-age";

type SellerReview = {
  id: string;
  buyerName?: string;
  rating: number;
  comment?: string;
  createdAt: number;
};

export default function MyProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsCursor, setListingsCursor] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [accountCreatedAt, setAccountCreatedAt] = useState(0);
  const [authResolved, setAuthResolved] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [profileTags, setProfileTags] = useState<ProfileTag[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [openReviewModal, setOpenReviewModal] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user?.uid && user.emailVerified) {
        const destination = getPostAuthDestination("/profile/me");
        if (destination !== "/profile/me") {
          router.replace(destination);
          return;
        }
      }
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
      setAuthResolved(true);
    });
  }, [router]);

  useEffect(() => {
    if (!currentUserId) {
      setListings([]);
      setListingsCursor(null);
      return;
    }

    let cancelled = false;
    setLoadingListings(true);
    listOwnerListings(currentUserId, null, 30)
      .then((result) => {
        if (cancelled) return;
        setListings(result.items.filter(isListingVisibleInOwnerProfile));
        setListingsCursor(result.nextCursor);
      })
      .catch(() => {
        if (cancelled) return;
        setListings([]);
        setListingsCursor(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setFollowersCount(0);
      return;
    }

    const unsubFollowers = subscribeFollowers(currentUserId, (rows) => setFollowersCount(rows.length));
    const unsubLikes = subscribeIncomingLikesForOwner(currentUserId, (rows) => setLikesCount(rows.length));

    return () => {
      unsubFollowers();
      unsubLikes();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setSalesCount(0);
      return;
    }

    fetch(`/api/profile/sales?userId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/sales-count-failed");
        const payload = (await response.json()) as { salesCount?: number };
        setSalesCount(Number(payload.salesCount || 0));
      })
      .catch(() => setSalesCount(0));
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setAccountCreatedAt(0);
      return;
    }

    fetch(`/api/profile/account?userId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/account-load-failed");
        const payload = (await response.json()) as { createdAt?: number };
        setAccountCreatedAt(Number(payload.createdAt || 0));
      })
      .catch(() => setAccountCreatedAt(0));
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setAvatarUrl("");
      return;
    }

    const unsub = subscribeProfileAvatar(currentUserId, setAvatarUrl);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setIsVerified(false);
      return;
    }

    const unsub = subscribeVerifiedUser(currentUserId, setIsVerified);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setProfileTags([]);
      return;
    }

    const unsub = subscribeProfileTags(currentUserId, setProfileTags);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setReviews([]);
      return;
    }

    fetch(`/api/reviews?sellerId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("reviews/load-failed");
        const payload = (await response.json()) as { reviews?: SellerReview[] };
        setReviews(payload.reviews || []);
      })
      .catch(() => setReviews([]));
  }, [currentUserId]);

  const myListings = listings;
  const userHandle = useMemo(() => {
    if (!currentUserId) {
      return "user-001";
    }

    return getOrCreateUserHandle({
      uid: currentUserId,
      name: currentUserName,
    });
  }, [currentUserId, currentUserName]);
  const accountAgeLabel = useMemo(() => getAccountAgeLabel(accountCreatedAt), [accountCreatedAt]);
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);
  const storyCategories = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; image: string }>();

    myListings.forEach((item) => {
      const categoryName = item.category?.trim() || "General";
      const categoryId = categoryName.toLowerCase();

      if (!categories.has(categoryId)) {
        categories.set(categoryId, {
          id: categoryId,
          name: categoryName,
          image: item.image,
        });
      }
    });

    return Array.from(categories.values());
  }, [myListings]);

  useEffect(() => {
    if (!storyCategories.length) {
      setActiveCategoryId("");
      return;
    }

    setActiveCategoryId((current) =>
      current && storyCategories.some((category) => category.id === current)
        ? current
        : storyCategories[0].id
    );
  }, [storyCategories]);

  const visibleListings = activeCategoryId
    ? myListings.filter((item) => (item.category?.trim() || "General").toLowerCase() === activeCategoryId)
    : myListings;
  const isSignedIn = Boolean(currentUserId);
  const loadMoreListings = async () => {
    if (!currentUserId || !listingsCursor || loadingListings) return;

    setLoadingListings(true);
    try {
      const result = await listOwnerListings(currentUserId, listingsCursor, 30);
      setListings((current) => [...current, ...result.items.filter(isListingVisibleInOwnerProfile)]);
      setListingsCursor(result.nextCursor);
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    if (authResolved && !currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent("/profile/me")}`);
    }
  }, [authResolved, currentUserId, router]);

  if (!authResolved || !isSignedIn) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50" />
    );
  }

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
        <div className="text-sm font-semibold">@{userHandle}</div>
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
          aria-label="Ajustes"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-1">
        <ProfileAvatar
          src={avatarUrl}
          alt={currentUserName}
          editable
          onEdit={() => avatarInputRef.current?.click()}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !currentUserId) return;

            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") return;

              setAvatarUrl(reader.result);
              writeProfileAvatar(currentUserId, reader.result);

              uploadListingImages([file])
                .then(async ([uploadedUrl]) => {
                  if (!uploadedUrl) return;
                  writeProfileAvatar(currentUserId, uploadedUrl);
                  setAvatarUrl(uploadedUrl);
                  await syncOwnerAvatarAcrossListings(currentUserId, uploadedUrl);
                })
                .catch((error) => {
                  console.error("profile-avatar-sync-failed", error);
                });
            };
            reader.readAsDataURL(file);

            event.currentTarget.value = "";
          }}
        />
        <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-neutral-50">
          <span>{currentUserName}</span>
          {isVerified ? <VerifiedBadge /> : null}
        </div>
        <div className="mt-1 flex flex-col items-center gap-1">
          <span className={accountAgeLabel.isNew ? "text-sm font-semibold text-sky-400" : "text-sm text-neutral-500"}>
            {accountAgeLabel.text}
          </span>
          <button
            type="button"
            onClick={() => setOpenReviewModal(true)}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-orange-300 hover:bg-neutral-900"
            aria-label="Ver reseñas"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={value <= Math.round(averageRating) ? "h-3.5 w-3.5 fill-orange-400 text-orange-400" : "h-3.5 w-3.5 text-neutral-600"}
              />
            ))}
            <span className="ml-1">{averageRating.toFixed(1)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
          </button>
        </div>

        <div className="mt-4 flex w-full justify-around text-center text-sm text-neutral-300">
          <div>
            <div className="text-base font-semibold text-neutral-50">{salesCount}</div>
            <div className="text-xs text-neutral-400">Ventas</div>
          </div>
          <Link href={`/profile/${currentUserId}/connections?tab=followers&name=${encodeURIComponent(currentUserName)}`}>
            <div className="text-base font-semibold text-neutral-50">{followersCount}</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </Link>
          <div>
            <div className="text-base font-semibold text-neutral-50">{likesCount}</div>
            <div className="text-xs text-neutral-400">Likes</div>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-2">
          <button className="flex-none rounded-2xl border border-neutral-800 bg-neutral-900 px-8 py-3 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white">
            Editar perfil
          </button>
          <Link
            href="/settings/instagram"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
            aria-label="Agregar instagram"
          >
            <Instagram className="h-4 w-4" />
          </Link>
        </div>

        <ProfileTags userId={currentUserId || ""} tags={profileTags} editable />
      </main>

      {openReviewModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Reseñas</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
                  <span>{currentUserName}</span>
                  <span className="flex items-center gap-1 text-orange-300">
                    <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                    {averageRating.toFixed(1)}
                  </span>
                  <span>{reviews.length} reseñas</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenReviewModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-neutral-100">Todas las reseñas</div>
              {reviews.length ? (
                <div className="mt-3 space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-100">
                            {review.buyerName || "Usuario"}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {formatReviewDate(review.createdAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-300">
                          <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
                          {review.rating}
                        </div>
                      </div>
                      {review.comment ? (
                        <div className="mt-3 text-sm leading-6 text-neutral-300">{review.comment}</div>
                      ) : (
                        <div className="mt-3 text-sm leading-6 text-neutral-500">Sin comentario.</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-5 text-sm text-neutral-400">
                  Aún no hay reseñas.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 w-full pb-24">
        {storyCategories.length > 0 ? (
          <div className="sticky top-0 z-20 bg-neutral-950 pb-3">
            <CategoryStories categories={storyCategories} activeId={activeCategoryId} onSelect={setActiveCategoryId} />
          </div>
        ) : null}
	        <div className="grid w-full grid-cols-3 gap-px">
          {visibleListings.length === 0 ? (
            <div className="col-span-3 flex justify-center px-4 py-8">
              <div className="max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/50 px-5 py-4 text-center text-sm text-neutral-400">
                Aun no tienes publicaciones. Crea una para verla aqui.
              </div>
            </div>
          ) : (
            visibleListings.map((item) => (
              <Link key={item.id} href={`/item/${item.id}`} className="aspect-square overflow-hidden bg-neutral-800">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-neutral-800" />
                )}
              </Link>
            ))
	          )}
	        </div>
	        {listingsCursor ? (
	          <div className="px-4 py-5">
	            <button
	              type="button"
	              onClick={loadMoreListings}
	              disabled={loadingListings}
	              className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 disabled:text-neutral-500"
	            >
	              {loadingListings ? "Cargando..." : "Cargar más"}
	            </button>
	          </div>
	        ) : null}
	      </div>
      <AppBottomNav active="profile" />
    </div>
  );
}

function formatReviewDate(value: number) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
