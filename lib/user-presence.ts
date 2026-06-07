"use client";

import { auth } from "@/lib/firebase";

const ONLINE_THRESHOLD_MS = 90_000;

export type UserPresence = {
  userId: string;
  lastActiveAt: number;
};

export function touchUserPresence(userId: string) {
  if (!userId) return Promise.resolve();

  return auth.currentUser
    ?.getIdToken()
    .then((token) =>
      fetch("/api/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })
    )
    .then(() => undefined)
    .catch(() => undefined) || Promise.resolve();
}

export function subscribeUserPresence(userId: string, onData: (presence: UserPresence | null) => void) {
  if (!userId) {
    onData(null);
    return () => {};
  }

  let cancelled = false;

  const load = async () => {
    try {
      const response = await fetch(`/api/presence?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("presence/load-failed");
      const data = (await response.json()) as Partial<UserPresence>;
      if (!cancelled) {
        onData({
          userId,
          lastActiveAt: Number(data.lastActiveAt || 0),
        });
      }
    } catch {
      if (!cancelled) onData(null);
    }
  };

  void load();
  const intervalId = window.setInterval(load, 15_000);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export function isUserOnline(lastActiveAt: number, now = Date.now()) {
  return Boolean(lastActiveAt && now - lastActiveAt <= ONLINE_THRESHOLD_MS);
}

export function formatLastActive(lastActiveAt: number, now = Date.now()) {
  if (!lastActiveAt) return "Última vez desconocida";
  if (isUserOnline(lastActiveAt, now)) return "En Línea";

  const diffMs = Math.max(0, now - lastActiveAt);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Última vez hace un momento";
  if (minutes < 60) return `Última vez hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Última vez hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Última vez hace ${days} ${days === 1 ? "día" : "días"}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Última vez hace ${months} ${months === 1 ? "mes" : "meses"}`;

  const years = Math.floor(months / 12);
  return `Última vez hace ${years} ${years === 1 ? "año" : "años"}`;
}
