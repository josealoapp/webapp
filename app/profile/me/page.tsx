"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Instagram, Settings, Star, X } from "lucide-react";
import { onAuthStateChanged, updateProfile } from "@/lib/auth-client";
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
import { Button } from "@/components/ui/button";

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
  const [profileHandle, setProfileHandle] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [userIdUpdatedAt, setUserIdUpdatedAt] = useState(0);
  const [userIdChangeCount, setUserIdChangeCount] = useState(0);
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
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState("");

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
      setProfileHandle("");
      setProfileDescription("");
      setUserIdUpdatedAt(0);
      setUserIdChangeCount(0);
      return;
    }

    let cancelled = false;
    fetch(`/api/profile?scope=public&userId=${encodeURIComponent(currentUserId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile/load-failed");
        const payload = (await response.json()) as {
          profile?: {
            displayName?: string;
            name?: string;
            handle?: string;
            description?: string;
            profileDescription?: string;
            userIdUpdatedAt?: number;
            handleUpdatedAt?: number;
            userIdChangeCount?: number;
          } | null;
        };
        if (cancelled) return;
        const profile = payload.profile;
        const profileName = profile?.displayName?.trim() || profile?.name?.trim();
        if (profileName) setCurrentUserName(profileName);
        setProfileHandle(profile?.handle?.trim() || "");
        setProfileDescription((profile?.profileDescription || profile?.description || "").slice(0, 120));
        setUserIdUpdatedAt(Number(profile?.userIdUpdatedAt || profile?.handleUpdatedAt || 0));
        setUserIdChangeCount(Number(profile?.userIdChangeCount || 0));
      })
      .catch(() => {
        if (!cancelled) {
          setProfileHandle("");
          setProfileDescription("");
          setUserIdUpdatedAt(0);
          setUserIdChangeCount(0);
        }
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
    if (profileHandle) {
      return profileHandle;
    }

    if (!currentUserId) {
      return "user-001";
    }

    return getOrCreateUserHandle({
      uid: currentUserId,
      name: currentUserName,
    });
  }, [currentUserId, currentUserName, profileHandle]);
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
  const userIdCanUpdateAt = userIdUpdatedAt ? userIdUpdatedAt + 365 * 24 * 60 * 60 * 1000 : 0;
  const userIdLocked = Boolean(userIdChangeCount > 0 && userIdCanUpdateAt && Date.now() < userIdCanUpdateAt);
  const openEditProfile = () => {
    setEditUsername(currentUserName);
    setEditUserId(userHandle);
    setEditDescription(profileDescription);
    setEditError("");
    setOpenEditModal(true);
  };
  const saveProfile = async () => {
    if (!currentUserId || savingProfile) return;

    const username = editUsername.trim().replace(/\s+/g, " ");
    const userIdHandle = editUserId.trim().replace(/^@+/, "").toLowerCase();
    const description = editDescription.trim().slice(0, 120);

    if (username.length < 2) {
      setEditError("El nombre de usuario debe tener al menos 2 caracteres.");
      return;
    }

    if (!/^[a-z0-9_-]{3,20}$/.test(userIdHandle)) {
      setEditError("El ID solo puede usar letras, números, guion y guion bajo.");
      return;
    }

    setSavingProfile(true);
    setEditError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("auth/missing-token");

      const response = await fetch("/api/profile/edit", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, userIdHandle, description }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { profile?: { handle?: string; userIdUpdatedAt?: number; userIdChangeCount?: number }; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "profile/edit-failed");
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: username }).catch(() => undefined);
      }

      setCurrentUserName(username);
      setProfileHandle(payload?.profile?.handle || userIdHandle);
      setProfileDescription(description);
      setUserIdUpdatedAt(Number(payload?.profile?.userIdUpdatedAt ?? userIdUpdatedAt));
      setUserIdChangeCount(Number(payload?.profile?.userIdChangeCount ?? userIdChangeCount));
      setOpenEditModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setEditError(
        message === "profile/username-taken"
          ? "Ese nombre de usuario ya está registrado."
          : message === "profile/user-id-taken"
            ? "Ese ID de usuario ya está registrado."
            : message === "profile/user-id-update-too-soon"
              ? "Solo puedes cambiar tu ID de usuario una vez al año."
              : message === "profile/user-id-invalid"
                ? "El ID solo puede usar letras, números, guion y guion bajo."
            : "No pudimos guardar los cambios. Intenta de nuevo."
      );
    } finally {
      setSavingProfile(false);
    }
  };
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
            onClick={() => setOpenReviewModal(true)}
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
          <button
            type="button"
            onClick={openEditProfile}
            className="flex-none rounded-2xl border border-neutral-800 bg-neutral-900 px-8 py-3 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
          >
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

      {openEditModal ? (
        <div className="fixed inset-0 z-[3000] bg-neutral-50 text-slate-950 dark:bg-neutral-950 dark:text-neutral-50">
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
            <header className="relative flex items-center justify-center px-4 pb-6 pt-9">
              <button
                type="button"
                onClick={() => setOpenEditModal(false)}
                className="absolute left-4 top-7 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100 dark:shadow-none"
                aria-label="Volver"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="text-lg font-semibold">Editar perfil</div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-28">
              <label className="block">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-950 dark:text-neutral-100">Nombre de usuario</span>
                  <span className="text-xs text-slate-500 dark:text-neutral-500">{editUsername.length}/30</span>
                </div>
                <input
                  value={editUsername}
                  onChange={(event) => {
                    setEditUsername(event.target.value.slice(0, 30));
                    setEditError("");
                  }}
                  maxLength={30}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  placeholder="Tu nombre"
                />
              </label>

              <label className="mt-5 block">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-950 dark:text-neutral-100">ID de usuario</span>
                  <span className="text-xs text-slate-500 dark:text-neutral-500">{editUserId.length}/20</span>
                </div>
                <div className="mt-2 flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-orange-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="mr-1 text-sm font-semibold text-slate-500 dark:text-neutral-400">@</span>
                  <input
                    value={editUserId}
                    onChange={(event) => {
                      setEditUserId(event.target.value.replace(/^@+/, "").toLowerCase().slice(0, 20));
                      setEditError("");
                    }}
                    disabled={userIdLocked}
                    maxLength={20}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500 disabled:text-slate-500 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    placeholder="usuario-001"
                  />
                </div>
                <div className="mt-2 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 text-xs leading-5 text-slate-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100">
                  El ID de usuario solo se puede cambiar una vez al año. Debe ser único, tener 3 a 20 caracteres y solo puede usar letras, números, guion (-) y guion bajo (_).
                  {userIdLocked ? (
                    <span className="block font-semibold">
                      Puedes volver a cambiarlo el {new Date(userIdCanUpdateAt).toLocaleDateString("es-DO")}.
                    </span>
                  ) : null}
                </div>
              </label>

              <label className="mt-5 block">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-950 dark:text-neutral-100">Descripción</span>
                  <span className="text-xs text-slate-500 dark:text-neutral-500">{editDescription.length}/120</span>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(event) => {
                    setEditDescription(event.target.value.slice(0, 120));
                    setEditError("");
                  }}
                  maxLength={120}
                  className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-500 focus:border-orange-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  placeholder="Cuéntale algo breve a los compradores."
                />
              </label>

              {editError ? (
                <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {editError}
                </div>
              ) : null}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-[3010] border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
              <div className="mx-auto max-w-md">
                <Button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="h-12 w-full rounded-2xl bg-orange-400 text-sm font-semibold text-black hover:bg-orange-300 disabled:opacity-60"
                >
                  {savingProfile ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {openReviewModal ? (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Reseñas</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-950 hover:text-slate-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
              <div className="max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/10 px-5 py-4 text-center text-sm text-neutral-400">
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
