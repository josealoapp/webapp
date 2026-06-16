"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { AdminUserRow as AdminUser } from "@/lib/admin-types";

export default function AdminUserRow({
  user,
  onToggleVerify,
  onDelete,
  onPermanentDelete,
}: {
  user: AdminUser;
  onToggleVerify: (user: AdminUser) => Promise<void> | void;
  onDelete: (user: AdminUser) => Promise<void> | void;
  onPermanentDelete: (user: AdminUser) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200"
            aria-label="Opciones del usuario"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {open ? (
            <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-2xl border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
              <Link
                href={`/profile/${user.uid}?name=${encodeURIComponent(user.displayName)}`}
                className="block rounded-xl px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-900"
              >
                View account
              </Link>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await onToggleVerify(user);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-orange-300 hover:bg-neutral-900"
              >
                {user.isVerified ? "Remove verification" : "Verify account"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await onDelete(user);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-neutral-900"
              >
                Desactivar cuenta
              </button>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await onPermanentDelete(user);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10"
              >
                Eliminar permanente
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-neutral-100">{user.displayName}</div>
            {user.isVerified ? <VerifiedBadge /> : null}
            {user.accountType === "business" && user.businessName ? (
              <div className="truncate text-xs font-semibold text-neutral-300">· {user.businessName}</div>
            ) : null}
            {user.businessVerificationStatus === "pending" ? (
              <span className="shrink-0 rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-300">
                Pending
              </span>
            ) : user.businessVerificationStatus === "verified" ? (
              <span className="shrink-0 rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-300">
                Verified
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-neutral-400">{user.email || user.uid}</div>
        </div>

        <div className="shrink-0 text-xs text-neutral-500">
          {user.createdAt ? new Date(user.createdAt).toLocaleString() : "Sin fecha"}
        </div>
      </div>
    </div>
  );
}
