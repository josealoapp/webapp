"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PROFILE_AVATAR, subscribeProfileAvatar } from "@/lib/profile-avatar";
import { getInitials } from "@/lib/user-handle";

export default function SellerAvatar({
  userId,
  name,
  avatarUrl,
  className = "h-10 w-10",
  initialsClassName = "text-sm font-bold",
  imageClassName = "object-cover",
  fallbackImageClassName = "object-contain",
}: {
  userId?: string;
  name: string;
  avatarUrl?: string;
  className?: string;
  initialsClassName?: string;
  imageClassName?: string;
  fallbackImageClassName?: string;
}) {
  const [storedAvatarUrl, setStoredAvatarUrl] = useState("");

  useEffect(() => {
    if (!userId) {
      setStoredAvatarUrl("");
      return;
    }

    const unsub = subscribeProfileAvatar(userId, setStoredAvatarUrl);
    return () => unsub();
  }, [userId]);

  const resolvedAvatarUrl = avatarUrl || storedAvatarUrl;

  if (resolvedAvatarUrl) {
    return (
      <div className={`overflow-hidden rounded-full bg-neutral-900 ${className}`}>
        <img src={resolvedAvatarUrl} alt={name} className={`h-full w-full ${imageClassName}`} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center rounded-full bg-neutral-200 text-neutral-950 ${className}`}>
      <img
        src={DEFAULT_PROFILE_AVATAR}
        alt={name}
        className={`h-full w-full ${fallbackImageClassName}`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
          const parent = event.currentTarget.parentElement;
          if (!parent) return;
          parent.textContent = getInitials(name);
          parent.className = `flex items-center justify-center rounded-full bg-neutral-200 text-neutral-950 ${className} ${initialsClassName}`;
        }}
      />
    </div>
  );
}
