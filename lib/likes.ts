"use client";

export type LikeRecord = {
  id: string;
  actorId: string;
  actorName: string;
  ownerId: string;
  ownerName: string;
  listingId: string;
  bazarItemId?: string;
  itemTitle: string;
  image: string;
  price: number;
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

  writeLikeRegistry([
    ...current,
    {
      ...input,
      id: likeIdFor(input.actorId, input.listingId, input.bazarItemId),
      createdAt: Date.now(),
    },
  ]);
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
}

export function subscribeLikesForUser(userId: string, onData: (rows: LikeRecord[]) => void) {
  const publish = () => {
    const rows = readLikeRegistry()
      .filter((entry) => entry.actorId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };

  publish();
  return subscribeToRegistry(publish);
}

export function subscribeLikeIdsForUser(userId: string, onData: (ids: Set<string>) => void) {
  return subscribeLikesForUser(userId, (rows) => {
    onData(new Set(rows.map((row) => row.id)));
  });
}

export function subscribeIncomingLikesForOwner(userId: string, onData: (rows: LikeRecord[]) => void) {
  const publish = () => {
    const rows = readLikeRegistry()
      .filter((entry) => entry.ownerId === userId && entry.actorId !== userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };

  publish();
  return subscribeToRegistry(publish);
}
