"use client";

import { auth } from "@/lib/firebase";

export type FollowRecord = {
  id: string;
  followerId: string;
  followerName: string;
  followeeId: string;
  followeeName: string;
  createdAt: number;
};

const FOLLOWS_KEY = "josealo_follows";
const FOLLOWS_EVENT = "josealo:follows-changed";

function followDocumentId(followerId: string, followeeId: string) {
  return `${followerId}__${followeeId}`;
}

function readFollowRegistry() {
  if (typeof window === "undefined") return [] as FollowRecord[];

  try {
    const raw = window.localStorage.getItem(FOLLOWS_KEY);
    if (!raw) return [] as FollowRecord[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FollowRecord[]) : [];
  } catch {
    return [] as FollowRecord[];
  }
}

function writeFollowRegistry(rows: FollowRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FOLLOWS_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(FOLLOWS_EVENT));
}

function cacheRemoteRows(rows: FollowRecord[]) {
  const current = readFollowRegistry();
  const ids = new Set(rows.map((row) => row.id));
  const merged = [...current.filter((row) => !ids.has(row.id)), ...rows];
  writeFollowRegistry(merged);
}

function subscribeToRegistry(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== FOLLOWS_KEY) return;
    onChange();
  };
  const handleCustom = () => onChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(FOLLOWS_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(FOLLOWS_EVENT, handleCustom);
  };
}

export async function followUser(input: {
  followerId: string;
  followerName: string;
  followeeId: string;
  followeeName: string;
}) {
  const current = readFollowRegistry().filter(
    (entry) => !(entry.followerId === input.followerId && entry.followeeId === input.followeeId)
  );

  const record = {
    id: followDocumentId(input.followerId, input.followeeId),
    followerId: input.followerId,
    followerName: input.followerName,
    followeeId: input.followeeId,
    followeeName: input.followeeName,
    createdAt: Date.now(),
  };

  writeFollowRegistry([...current, record]);
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const response = await fetch("/api/follows", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error("follow/write-failed");
}

export async function unfollowUser(followerId: string, followeeId: string) {
  writeFollowRegistry(
    readFollowRegistry().filter(
      (entry) => !(entry.followerId === followerId && entry.followeeId === followeeId)
    )
  );
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const response = await fetch("/api/follows", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ followeeId }),
  });
  if (!response.ok) throw new Error("follow/delete-failed");
}

export function subscribeFollowing(userId: string, onData: (rows: FollowRecord[]) => void) {
  let cancelled = false;
  const publishLocal = () => {
    const rows = readFollowRegistry()
      .filter((entry) => entry.followerId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };
  const loadRemote = async () => {
    try {
      const response = await fetch(`/api/follows?followerId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { follows?: FollowRecord[] } | null;
      const rows = payload?.follows || [];
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

export function subscribeFollowers(userId: string, onData: (rows: FollowRecord[]) => void) {
  let cancelled = false;
  const publishLocal = () => {
    const rows = readFollowRegistry()
      .filter((entry) => entry.followeeId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };
  const loadRemote = async () => {
    try {
      const response = await fetch(`/api/follows?followeeId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { follows?: FollowRecord[] } | null;
      const rows = payload?.follows || [];
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

export function subscribeFollowingIds(userId: string, onData: (ids: Set<string>) => void) {
  return subscribeFollowing(userId, (rows) => {
    onData(new Set(rows.map((entry) => entry.followeeId)));
  });
}
