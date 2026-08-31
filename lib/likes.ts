"use client";

import { auth } from "@/lib/firebase";

export type LikeRecord = {
  id: string;
  actorId: string;
  actorName: string;
  actorHandle?: string;
  ownerId: string;
  ownerName: string;
  ownerHandle?: string;
  listingId: string;
  bazarItemId?: string;
  itemTitle: string;
  image: string;
  price: number;
  currency?: string;
  location: string;
  href: string;
  createdAt: number;
};

const LIKES_KEY = "josealo_likes";
const LIKES_EVENT = "josealo:likes-changed";

function likeIdFor(actorId: string, listingId: string, bazarItemId?: string) {
  return `${actorId}__${listingId}${bazarItemId ? `__${bazarItemId}` : ""}`;
}

export function getLikeRecordId(actorId: string, listingId: string, bazarItemId?: string) {
  return likeIdFor(actorId, listingId, bazarItemId);
}

function readLikeRegistry() {
  if (typeof window === "undefined") return [] as LikeRecord[];

  try {
    const raw = window.localStorage.getItem(LIKES_KEY);
    if (!raw) return [] as LikeRecord[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LikeRecord[]) : [];
  } catch {
    return [] as LikeRecord[];
  }
}

function writeLikeRegistry(rows: LikeRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIKES_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(LIKES_EVENT));
}

function cacheRemoteRows(rows: LikeRecord[]) {
  const current = readLikeRegistry();
  const ids = new Set(rows.map((row) => row.id));
  writeLikeRegistry([...current.filter((row) => !ids.has(row.id)), ...rows]);
}

function subscribeToRegistry(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== LIKES_KEY) return;
    onChange();
  };
  const handleCustom = () => onChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LIKES_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LIKES_EVENT, handleCustom);
  };
}

export async function likeItem(input: Omit<LikeRecord, "id" | "createdAt">) {
  const current = readLikeRegistry().filter(
    (entry) =>
      !(
        entry.actorId === input.actorId &&
        entry.listingId === input.listingId &&
        (entry.bazarItemId || "") === (input.bazarItemId || "")
      )
  );

  const record: LikeRecord = {
    ...input,
    id: likeIdFor(input.actorId, input.listingId, input.bazarItemId),
    createdAt: Date.now(),
  };
  const firestoreRecord = Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as LikeRecord;

  writeLikeRegistry([...current, record]);
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const response = await fetch("/api/likes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(firestoreRecord),
  });
  if (!response.ok) throw new Error("like/write-failed");
}

export async function unlikeItem(actorId: string, listingId: string, bazarItemId?: string) {
  writeLikeRegistry(
    readLikeRegistry().filter(
      (entry) =>
        !(
          entry.actorId === actorId &&
          entry.listingId === listingId &&
          (entry.bazarItemId || "") === (bazarItemId || "")
        )
    )
  );
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const response = await fetch("/api/likes", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ listingId, bazarItemId }),
  });
  if (!response.ok) throw new Error("like/delete-failed");
}

export function subscribeLikesForUser(userId: string, onData: (rows: LikeRecord[]) => void) {
  let cancelled = false;
  const publishLocal = () => {
    const rows = readLikeRegistry()
      .filter((entry) => entry.actorId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };
  const loadRemote = async () => {
    try {
      const response = await fetch(`/api/likes?actorId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { likes?: LikeRecord[] } | null;
      const rows = payload?.likes || [];
      cacheRemoteRows(rows);
      if (!cancelled) onData(rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
    } catch {
      publishLocal();
    }
  };

  publishLocal();
  void loadRemote();
  const unsubscribeLocal = subscribeToRegistry(publishLocal);
  const intervalId = typeof window !== "undefined" ? window.setInterval(loadRemote, 15000) : null;
  return () => {
    cancelled = true;
    unsubscribeLocal();
    if (intervalId) window.clearInterval(intervalId);
  };
}

export function subscribeLikeIdsForUser(userId: string, onData: (ids: Set<string>) => void) {
  return subscribeLikesForUser(userId, (rows) => {
    onData(new Set(rows.map((row) => row.id)));
  });
}

export function subscribeIncomingLikesForOwner(userId: string, onData: (rows: LikeRecord[]) => void) {
  let cancelled = false;
  const publishLocal = () => {
    const rows = readLikeRegistry()
      .filter((entry) => entry.ownerId === userId && entry.actorId !== userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };
  const loadRemote = async () => {
    try {
      const response = await fetch(`/api/likes?ownerId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { likes?: LikeRecord[] } | null;
      const rows = (payload?.likes || [])
        .filter((entry) => entry.actorId !== userId);
      cacheRemoteRows(rows);
      if (!cancelled) onData(rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
    } catch {
      publishLocal();
    }
  };

  publishLocal();
  void loadRemote();
  const unsubscribeLocal = subscribeToRegistry(publishLocal);
  const intervalId = typeof window !== "undefined" ? window.setInterval(loadRemote, 15000) : null;
  return () => {
    cancelled = true;
    unsubscribeLocal();
    if (intervalId) window.clearInterval(intervalId);
  };
}
