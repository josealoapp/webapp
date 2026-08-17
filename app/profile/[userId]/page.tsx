"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, Instagram, Star, X } from "lucide-react";
import { onAuthStateChanged } from "@/lib/auth-client";
import AppBottomNav from "@/components/AppBottomNav";
import CategoryStories from "@/components/CategoryStories";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileTags from "@/components/ProfileTags";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth } from "@/lib/firebase";
import { followUser, subscribeFollowers, subscribeFollowing, unfollowUser } from "@/lib/follows";
import { subscribeIncomingLikesForOwner } from "@/lib/likes";
import { isListingVisibleInOwnerProfile, listOwnerListings, Listing } from "@/lib/marketplace";
import { subscribeProfileAvatar } from "@/lib/profile-avatar";
import { getOrCreateUserHandle } from "@/lib/user-handle";
import { getInstagramProfileUrl, subscribeInstagramUsername } from "@/lib/user-instagram";
import { subscribeVerifiedUser } from "@/lib/user-verified";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ProfileTag, subscribeProfileTags } from "@/lib/profile-tags";
import { createUserReport, USER_REPORT_REASONS } from "@/lib/user-reports";
import { getAccountAgeLabel } from "@/lib/profile-account-age";

type SellerReview = {
  id: string;
  buyerName?: string;
  itemTitle?: string;
  rating: number;
  comment?: string;
  createdAt: number;
};

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params?.userId || "";
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [publicProfileName, setPublicProfileName] = useState("");
  const [publicProfileHandle, setPublicProfileHandle] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isShakingFollow, setIsShakingFollow] = useState(false);
  const [isAnimatingFollowingText, setIsAnimatingFollowingText] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsCursor, setListingsCursor] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [followers, setFollowers] = useState<ReturnType<typeof mapFollowRows>>([]);
  const [following, setFollowing] = useState<ReturnType<typeof mapFollowRows>>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [accountCreatedAt, setAccountCreatedAt] = useState(0);
  const [instagramUsername, setInstagramUsername] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [profileTags, setProfileTags] = useState<ProfileTag[]>([]);
  const [supportStatus, setSupportStatus] = useState("");
  const [openActionMenu, setOpenActionMenu] = useState(false);
  const [openReportModal, setOpenReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [openReviewModal, setOpenReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid ?? null);
      setCurrentUserName(user?.displayName?.trim() || user?.email?.trim() || "Usuario");
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (currentUserId && currentUserId === userId) {
      router.replace("/profile/me");
    }
  }, [currentUserId, router, userId]);

  useEffect(() => {
    if (!userId) {
      setPublicProfileName("");
      setPublicProfileHandle("");
      setProfileDescription("");
      return;
    }

    let cancelled = false;
    fetch(`/api/profile?scope=public&userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/load-failed");
        const payload = (await response.json()) as {
          profile?: {
            displayName?: string;
            name?: string;
            handle?: string;
            description?: string;
            profileDescription?: string;
          } | null;
        };
        if (cancelled) return;
        setPublicProfileName(payload.profile?.displayName?.trim() || payload.profile?.name?.trim() || "");
        setPublicProfileHandle(payload.profile?.handle?.trim() || "");
        setProfileDescription((payload.profile?.profileDescription || payload.profile?.description || "").slice(0, 120));
      })
      .catch(() => {
        if (!cancelled) {
          setPublicProfileName("");
          setPublicProfileHandle("");
          setProfileDescription("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setListings([]);
      setListingsCursor(null);
      return;
    }

    let cancelled = false;
    setLoadingListings(true);
    listOwnerListings(userId, null, 30)
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
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubFollowers = subscribeFollowers(userId, (rows) => setFollowers(mapFollowRows(rows, "followers")));
    const unsubFollowing = subscribeFollowing(userId, (rows) => setFollowing(mapFollowRows(rows, "following")));
    const unsubLikes = subscribeIncomingLikesForOwner(userId, (rows) => setLikesCount(rows.length));
    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubLikes();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSalesCount(0);
      return;
    }

    fetch(`/api/profile/sales?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/sales-count-failed");
        const payload = (await response.json()) as { salesCount?: number };
        setSalesCount(Number(payload.salesCount || 0));
      })
      .catch(() => setSalesCount(0));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAccountCreatedAt(0);
      return;
    }

    fetch(`/api/profile/account?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/account-load-failed");
        const payload = (await response.json()) as { createdAt?: number };
        setAccountCreatedAt(Number(payload.createdAt || 0));
      })
      .catch(() => setAccountCreatedAt(0));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAvatarUrl("");
      return;
    }

    const unsub = subscribeProfileAvatar(userId, setAvatarUrl);
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setInstagramUsername("");
      return;
    }

    const unsub = subscribeInstagramUsername(userId, setInstagramUsername);
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsVerified(false);
      return;
    }

    const unsub = subscribeVerifiedUser(userId, setIsVerified);
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfileTags([]);
      return;
    }

    const unsub = subscribeProfileTags(userId, setProfileTags);
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setReviews([]);
      return;
    }

    fetch(`/api/reviews?sellerId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("reviews/load-failed");
        const payload = (await response.json()) as { reviews?: SellerReview[] };
        setReviews(payload.reviews || []);
      })
      .catch(() => setReviews([]));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSupportStatus("");
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/profile?scope=public&userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { profile?: { supportStatus?: string } | null }
          | null;
        if (!cancelled) setSupportStatus(String(payload?.profile?.supportStatus || ""));
      } catch {
        if (!cancelled) setSupportStatus("");
      }
    };

    void load();
    const intervalId = window.setInterval(load, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  useEffect(() => {
    if (!openActionMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setOpenActionMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openActionMenu]);

  const publicListings = useMemo(() => listings, [listings]);
  const fallbackName = searchParams.get("name")?.trim() || "Usuario";
  const profileName = useMemo(() => {
    return (
      publicProfileName ||
      publicListings[0]?.ownerName ||
      followers[0]?.profileName ||
      following[0]?.sourceName ||
      fallbackName
    );
  }, [fallbackName, followers, following, publicListings, publicProfileName]);
  const profileHandle = useMemo(
    () => publicProfileHandle || getOrCreateUserHandle({ uid: userId || "user", name: profileName }),
    [profileName, publicProfileHandle, userId]
  );
  const accountAgeLabel = useMemo(() => getAccountAgeLabel(accountCreatedAt), [accountCreatedAt]);
  const isFollowing = followers.some((entry) => entry.profileId === currentUserId);
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const storyCategories = useMemo(() => {
    const categories = new Map<string, { id: string; name: string; image: string }>();

    publicListings.forEach((item) => {
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
  }, [publicListings]);

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
    ? publicListings.filter((item) => (item.category?.trim() || "General").toLowerCase() === activeCategoryId)
    : publicListings;
  const loadMoreListings = async () => {
    if (!userId || !listingsCursor || loadingListings) return;

    setLoadingListings(true);
    try {
      const result = await listOwnerListings(userId, listingsCursor, 30);
      setListings((current) => [...current, ...result.items.filter(isListingVisibleInOwnerProfile)]);
      setListingsCursor(result.nextCursor);
    } finally {
      setLoadingListings(false);
    }
  };

  if (supportStatus === "deactivated") {
    return (
      <div className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-50">
        <div className="mx-auto max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
          <div className="text-lg font-semibold">Cuenta desactivada por soporte</div>
          <div className="mt-3 text-sm leading-6 text-neutral-400">
            Esta cuenta no está disponible mientras nuestro equipo de protección al usuario revisa su estado.
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

  const handleOpenReportUser = () => {
    setOpenActionMenu(false);
    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent(`/profile/${userId}`)}`);
      return;
    }

    setReportReason("");
    setReportDetails("");
    setReportError("");
    setReportSuccess(false);
    setOpenReportModal(true);
  };

  const handleSubmitUserReport = async () => {
    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent(`/profile/${userId}`)}`);
      return;
    }
    if (!reportReason) {
      setReportError("Selecciona una razón.");
      return;
    }
    if (!reportDetails.trim()) {
      setReportError("Describe lo que sucedió.");
      return;
    }

    setSubmittingReport(true);
    setReportError("");
    try {
      await createUserReport({
        targetUserId: userId,
        targetUserName: profileName,
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportSuccess(true);
      setReportReason("");
      setReportDetails("");
    } catch {
      setReportError("No pudimos enviar el reporte. Intenta de nuevo.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSubmitSellerReview = async () => {
    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent(`/profile/${userId}`)}`);
      return;
    }
    if (!reviewRating) {
      setReviewError("Selecciona una valoración.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("auth/missing-token");
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sellerId: userId,
          sellerName: profileName,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "reviews/write-failed");
      }

      const nextReview: SellerReview = {
        id: `local_${Date.now()}`,
        buyerName: currentUserName,
        itemTitle: "Reseña directa",
        rating: reviewRating,
        comment: reviewComment.trim(),
        createdAt: Date.now(),
      };
      setReviews((current) => [nextReview, ...current]);
      setReviewSuccess(true);
      setReviewRating(0);
      setReviewComment("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setReviewError(
        message === "reviews/already-reviewed"
          ? "Ya calificaste a este vendedor."
          : "No pudimos guardar tu reseña. Intenta de nuevo."
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="flex items-center justify-between px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">@{profileHandle}</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-1">
        <ProfileAvatar src={avatarUrl || publicListings[0]?.ownerAvatar} alt={profileName} />
        <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-neutral-50">
          <span>{profileName}</span>
          {isVerified ? <VerifiedBadge /> : null}
        </div>
        {profileDescription ? (
          <p className="mt-1 max-w-xs text-center text-sm font-normal leading-6 text-neutral-400">
            {profileDescription}
          </p>
        ) : null}
        <div className="mt-1 flex flex-col items-center gap-1">
          <span className={accountAgeLabel.isNew ? "text-sm font-semibold text-sky-400" : "text-sm text-neutral-500"}>
            {accountAgeLabel.text}
          </span>
          <button
            type="button"
            onClick={() => {
              setReviewError("");
              setReviewSuccess(false);
              setOpenReviewModal(true);
            }}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-orange-300 hover:bg-black/10 dark:hover:bg-neutral-900"
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
          <Link href={`/profile/${userId}/connections?tab=followers&name=${encodeURIComponent(profileName)}`}>
            <div className="text-base font-semibold text-neutral-50">{followers.length}</div>
            <div className="text-xs text-neutral-400">Seguidores</div>
          </Link>
          <div>
            <div className="text-base font-semibold text-neutral-50">{likesCount}</div>
            <div className="text-xs text-neutral-400">Likes</div>
          </div>
        </div>

        <div className="mt-5 flex w-full items-center justify-center gap-2">
          {currentUserId ? (
            <button
              type="button"
              onClick={async () => {
                if (!currentUserId) return;
                if (isFollowing) {
                  await unfollowUser(currentUserId, userId);
                  return;
                }
                setIsShakingFollow(true);
                await followUser({
                  followerId: currentUserId,
                  followerName: currentUserName,
                  followeeId: userId,
                  followeeName: profileName,
                });
                setIsAnimatingFollowingText(true);
                window.setTimeout(() => setIsShakingFollow(false), 420);
                window.setTimeout(() => setIsAnimatingFollowingText(false), 900);
              }}
              className={[
                "flex-none rounded-2xl px-8 py-3 text-sm font-semibold transition-transform duration-200",
                isFollowing
                  ? "border border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-orange-400 hover:text-white"
                  : "bg-orange-500 text-black hover:bg-orange-400",
                isShakingFollow ? "animate-[follow-shake_0.42s_ease-in-out]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block",
                  isAnimatingFollowingText ? "animate-[follow-word-in_0.9s_ease]" : "",
                ].join(" ")}
              >
                {isFollowing ? "Siguiendo" : "Seguir"}
              </span>
            </button>
          ) : null}
          {instagramUsername ? (
            <a
              href={getInstagramProfileUrl(instagramUsername)}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
              aria-label={`Abrir Instagram de ${profileName}`}
            >
              <Instagram className="h-4 w-4" />
            </a>
          ) : null}
          <div ref={actionMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenActionMenu((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-white"
              aria-label="Opciones del perfil"
              aria-expanded={openActionMenu}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {openActionMenu ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[190px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
                <button
                  type="button"
                  onClick={handleOpenReportUser}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-neutral-900"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reportar usuario
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <ProfileTags userId={userId} tags={profileTags} />
      </main>

      {openReportModal ? (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Reportar usuario</div>
                <div className="mt-1 text-xs text-neutral-400">{profileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpenReportModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-4 text-sm leading-6 text-orange-100">
                Gracias por tu reporte, pronto uno de nuestros agentes de protección al usuario te estará contactando para apoyarte en tu solicitud.
              </div>
            ) : (
              <>
                <label className="mt-5 flex flex-col gap-2">
                  <span className="text-xs text-neutral-400">Razón</span>
                  <Select value={reportReason} onValueChange={setReportReason}>
                    <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 shadow-none focus-visible:border-orange-400 focus-visible:ring-orange-400/20">
                      <SelectValue placeholder="Selecciona una razón" />
                    </SelectTrigger>
                    <SelectContent className="z-[3100] max-h-72 border-neutral-800 bg-neutral-950 text-neutral-100">
                      {USER_REPORT_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason} className="focus:bg-neutral-900 focus:text-white">
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-xs text-neutral-400">Descripción</span>
                  <textarea
                    value={reportDetails}
                    placeholder="Describe lo ocurrido para que protección al usuario pueda revisarlo."
                    onChange={(event) => setReportDetails(event.target.value)}
                    className="min-h-28 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                  />
                </label>

                {reportError ? (
                  <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {reportError}
                  </div>
                ) : null}

                <Button
                  type="button"
                  onClick={handleSubmitUserReport}
                  disabled={submittingReport}
                  className="mt-5 h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
                >
                  {submittingReport ? "Enviando..." : "Enviar"}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {openReviewModal ? (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Reseñas</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
                  <span>{profileName}</span>
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-950 hover:text-slate-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentUserId && currentUserId !== userId ? (
              <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="text-sm font-semibold text-slate-950 dark:text-neutral-100">Calificar vendedor</div>
                <div className="mt-4 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setReviewRating(value);
                        setReviewSuccess(false);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
                      aria-label={`${value} estrellas`}
                    >
                      <Star className={value <= reviewRating ? "h-5 w-5 fill-orange-400 text-orange-400" : "h-5 w-5"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(event) => {
                    setReviewComment(event.target.value);
                    setReviewSuccess(false);
                  }}
                  placeholder="Comparte tu experiencia con este vendedor."
                  className="mt-5 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
                {reviewSuccess ? (
                  <div className="mt-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm leading-6 text-orange-100">
                    Gracias por tu reseña. Tu calificación ayuda a otros compradores.
                  </div>
                ) : null}
                {reviewError ? (
                  <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {reviewError}
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={handleSubmitSellerReview}
                  disabled={submittingReview || !reviewRating}
                  className="mt-5 h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
                >
                  {submittingReview ? "Guardando..." : "Publicar reseña"}
                </Button>
              </div>
            ) : !currentUserId ? (
              <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="text-sm font-semibold text-slate-950 dark:text-neutral-100">Calificar vendedor</div>
                <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-neutral-400">
                  Inicia sesión para dejar una reseña sobre este vendedor.
                </div>
                <Button
                  type="button"
                  onClick={() => router.push(`/sign-in?next=${encodeURIComponent(`/profile/${userId}`)}`)}
                  className="mt-4 h-11 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300"
                >
                  Iniciar sesión
                </Button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-4 text-sm leading-6 text-orange-100">
                No puedes calificar tu propio perfil.
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-950 dark:text-neutral-100">Todas las reseñas</div>
              {reviews.length ? (
                <div className="mt-3 space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-100">
                            {review.buyerName || "Usuario"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                            {formatReviewDate(review.createdAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-300">
                          <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
                          {review.rating}
                        </div>
                      </div>
                      {review.comment ? (
                        <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-neutral-300">{review.comment}</div>
                      ) : (
                        <div className="mt-3 text-sm leading-6 text-slate-500 dark:text-neutral-500">Sin comentario.</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
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
                Este usuario aun no tiene publicaciones activas.
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

function mapFollowRows(
  rows: Array<{
    id: string;
    followerId: string;
    followerName: string;
    followeeId: string;
    followeeName: string;
    createdAt: number;
  }>,
  type: "followers" | "following"
) {
  return rows.map((row) => ({
    id: row.id,
    profileId: type === "followers" ? row.followerId : row.followeeId,
    profileName: type === "followers" ? row.followerName : row.followeeName,
    sourceName: type === "followers" ? row.followeeName : row.followerName,
    createdAt: row.createdAt,
  }));
}
