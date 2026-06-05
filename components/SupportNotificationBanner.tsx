"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import {
  markSupportNotificationRead,
  subscribeSupportNotifications,
  SupportNotification,
} from "@/lib/support-notifications";

export default function SupportNotificationBanner() {
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<SupportNotification[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setUserId(user?.uid || ""));
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    return subscribeSupportNotifications(userId, setNotifications);
  }, [userId]);

  const active = useMemo(
    () => notifications.find((notification) => !notification.read && notification.id !== dismissedId) || null,
    [dismissedId, notifications]
  );

  if (!active) return null;

  const close = async () => {
    setDismissedId(active.id);
    await markSupportNotificationRead(active.id).catch(() => undefined);
  };

  return (
    <>
      <div className="fixed left-3 right-3 top-3 z-[80] mx-auto max-w-xl rounded-3xl border border-orange-500/30 bg-neutral-950 p-4 text-neutral-50 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{active.title}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">{active.message}</div>
          </div>
          <Button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="h-9 rounded-2xl bg-orange-400 px-4 text-xs font-semibold text-black hover:bg-orange-300"
          >
            Detalles
          </Button>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-neutral-800 text-neutral-300 hover:text-white"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {detailsOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center sm:pb-0">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">{active.title}</div>
                <div className="mt-1 text-xs text-neutral-500">Razón: {active.reason}</div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm leading-6 text-neutral-200">
              {active.message}
            </div>
            <Button
              type="button"
              onClick={close}
              className="mt-5 h-12 w-full rounded-2xl bg-orange-400 text-black hover:bg-orange-300"
            >
              Entendido
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
