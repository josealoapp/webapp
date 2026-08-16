"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import SellerAvatar from "@/components/SellerAvatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { followUser } from "@/lib/follows";
import { getActiveBazarItems, Listing } from "@/lib/marketplace";
import { subscribeVerifiedUser } from "@/lib/user-verified";
import { formatBazarTimeLeft } from "@/lib/bazar-duration";
import { formatListingAge } from "@/lib/relative-time";

export default function HomeBazarCard({
  item,
  currentUserId,
  currentUserName,
  isFollowing,
  onFollowed,
}: {
  item: Listing;
  currentUserId: string | null;
  currentUserName: string;
  isFollowing: boolean;
  onFollowed?: (userId: string) => void;
}) {
  const router = useRouter();
  const [isShakingFollow, setIsShakingFollow] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [now, setNow] = useState(0);
  const visibleItems = getActiveBazarItems(item);
  const canFollow = Boolean(currentUserId && currentUserId !== item.ownerId && !isFollowing);
  const timeLeftLabel = item.bazarEndsAt && now ? formatBazarTimeLeft(item.bazarEndsAt, now) : "En vivo";
  const ageLabel = now ? formatListingAge(item.createdAt, now) : "";

  useEffect(() => {
    const unsub = subscribeVerifiedUser(item.ownerId, setIsVerified);
    return () => unsub();
  }, [item.ownerId]);

  useEffect(() => {
    if (!item.bazarEndsAt) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [item.bazarEndsAt]);

  return (
    <div className="overflow-hidden rounded-[26px] border border-neutral-800 bg-neutral-950/80 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/profile/${item.ownerId}?name=${encodeURIComponent(item.ownerName)}`}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="shrink-0 rounded-full border-2 border-orange-400">
            <SellerAvatar
              userId={item.ownerId}
              name={item.ownerName}
              avatarUrl={item.ownerAvatar}
              className="h-10 w-10"
              initialsClassName="text-sm font-bold"
              imageClassName="object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="listing-title truncate text-base font-medium text-neutral-100">{item.title}</div>
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <span>{item.ownerName}</span>
              {isVerified ? <VerifiedBadge className="h-3.5 w-3.5" /> : null}
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right text-xs font-semibold text-orange-400">{timeLeftLabel}</div>
          {canFollow ? (
            <button
              type="button"
              onClick={async () => {
                if (!currentUserId) return;
                setIsShakingFollow(true);
                await followUser({
                  followerId: currentUserId,
                  followerName: currentUserName,
                  followeeId: item.ownerId,
                  followeeName: item.ownerName,
                });
                window.setTimeout(() => {
                  setIsShakingFollow(false);
                  onFollowed?.(item.ownerId);
                }, 420);
              }}
              className={[
                "flex h-10 items-center rounded-xl border border-neutral-700 px-4 text-sm font-semibold text-neutral-100 transition-transform duration-200",
                isShakingFollow ? "animate-[follow-shake_0.42s_ease-in-out]" : "",
              ].join(" ")}
            >
              <span>Seguir</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {visibleItems.map((bazarItem) => (
          <button
            key={bazarItem.id}
            type="button"
            onClick={() => router.push(`/item/${item.id}?bazarItemId=${bazarItem.id}`)}
            className="min-w-[140px] max-w-[160px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 text-left shadow-sm"
          >
            <div className="h-28 w-full overflow-hidden rounded-[18px] bg-neutral-800">
              {bazarItem.image ? (
                <img src={bazarItem.image} alt={bazarItem.title} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="listing-price mt-2 text-sm font-bold text-orange-400">
              RD${Number(bazarItem.price).toLocaleString()}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-300">Bazar</span>
              <span className="listing-title min-w-0 truncate text-xs font-medium text-neutral-300">
                {bazarItem.title}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-neutral-500">
              <div className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.location || "Santo Domingo"}</span>
              </div>
              {ageLabel ? <span className="shrink-0">{ageLabel}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
