"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import SellerAvatar from "@/components/SellerAvatar";
import { BazarItem, getListingById, Listing } from "@/lib/marketplace";
import { getOrCreateUserHandle } from "@/lib/user-handle";

type SharedSelection = {
  listingId: string;
  bazarItemId?: string;
};

type SharedItem = {
  id: string;
  href: string;
  title: string;
  sellerName: string;
  image: string;
  price: number;
  currency: string;
};

type PublicProfile = {
  displayName?: string;
  name?: string;
  avatarUrl?: string;
  handle?: string;
};

function parseSelections(rawItems: string) {
  return rawItems
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((token) => {
      const [listingId, bazarItemId] = token.split(":");
      return {
        listingId: listingId || "",
        ...(bazarItemId ? { bazarItemId } : {}),
      };
    })
    .filter((entry) => entry.listingId)
    .slice(0, 50);
}

function buildSharedItem(listing: Listing, selection: SharedSelection): SharedItem {
  const bazarItem: BazarItem | undefined = selection.bazarItemId
    ? listing.bazarItems?.find((item) => item.id === selection.bazarItemId)
    : undefined;

  return {
    id: selection.bazarItemId ? `${listing.id}:${selection.bazarItemId}` : listing.id,
    href: `/item/${listing.id}${selection.bazarItemId ? `?bazarItemId=${encodeURIComponent(selection.bazarItemId)}` : ""}`,
    title: bazarItem?.title || listing.title,
    sellerName: listing.ownerName || "Vendedor",
    image: bazarItem?.image || listing.image,
    price: Number(bazarItem?.price || listing.price || 0),
    currency: bazarItem?.currency || listing.currency || "DOP",
  };
}

function formatMoney(value: number, currency: string) {
  const prefix = currency === "USD" ? "US$" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString()}`;
}

export default function SharedLikesPage() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params?.userId || "";
  const rawItems = searchParams.get("items") || "";
  const selections = useMemo(() => parseSelections(rawItems), [rawItems]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [profileResponse, listingRows] = await Promise.all([
          fetch(`/api/profile?scope=public&userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) return null;
              const payload = (await response.json().catch(() => null)) as { profile?: PublicProfile | null } | null;
              return payload?.profile || null;
            })
            .catch(() => null),
          Promise.all(
            Array.from(new Set(selections.map((entry) => entry.listingId))).map((listingId) =>
              getListingById(listingId).catch(() => null)
            )
          ),
        ]);

        if (cancelled) return;
        const listingMap = new Map(listingRows.filter(Boolean).map((listing) => [listing!.id, listing!]));
        setProfile(profileResponse);
        setItems(
          selections
            .map((selection) => {
              const listing = listingMap.get(selection.listingId);
              return listing ? buildSharedItem(listing, selection) : null;
            })
            .filter(Boolean) as SharedItem[]
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (userId) {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [selections, userId]);

  const profileName = profile?.displayName || profile?.name || "Usuario";
  const profileHandle = profile?.handle || getOrCreateUserHandle({ uid: userId || "user", name: profileName });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-100"
            aria-label="Ir al inicio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <SellerAvatar
            userId={userId}
            name={profileName}
            avatarUrl={profile?.avatarUrl}
            className="h-12 w-12 shrink-0"
            imageClassName="object-cover"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-white">{profileName}: Me gustas</h1>
            <div className="truncate text-xs text-neutral-400">@{profileHandle}</div>
          </div>
          <Link
            href={`/profile/${encodeURIComponent(userId)}`}
            className="shrink-0 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
          >
            Ver perfil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
        {loading ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
            Cargando artículos...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
            Este enlace no tiene artículos disponibles.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/40 px-4 py-4 transition hover:bg-neutral-900/70"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-900">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                      Sin foto
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="listing-title truncate text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 truncate text-xs text-neutral-400">{item.sellerName}</div>
                  <div className="listing-price mt-1 text-sm font-bold text-orange-400">
                    {formatMoney(item.price, item.currency)}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-neutral-500" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
