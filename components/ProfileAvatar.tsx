"use client";

import { Camera } from "lucide-react";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatar";

export default function ProfileAvatar({
  src,
  alt,
  sizeClass = "h-24 w-24",
  editable = false,
  onEdit,
}: {
  src?: string;
  alt: string;
  sizeClass?: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  const resolvedSrc = src || DEFAULT_PROFILE_AVATAR;
  const isDefaultAvatar = resolvedSrc === DEFAULT_PROFILE_AVATAR;

  return (
    <div className={`relative overflow-hidden rounded-full border-4 border-neutral-800 bg-neutral-900 ${sizeClass}`}>
      <img
        src={resolvedSrc}
        alt={alt}
        className={`h-full w-full ${isDefaultAvatar ? "object-contain p-2" : "object-cover"}`}
      />

      {editable ? (
        <button
          type="button"
          onClick={onEdit}
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur"
          aria-label="Cambiar foto de perfil"
        >
          <Camera className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
