"use client";

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

  writeFollowRegistry([
    ...current,
    {
      id: followDocumentId(input.followerId, input.followeeId),
      followerId: input.followerId,
      followerName: input.followerName,
      followeeId: input.followeeId,
      followeeName: input.followeeName,
      createdAt: Date.now(),
    },
  ]);
}

export async function unfollowUser(followerId: string, followeeId: string) {
  writeFollowRegistry(
    readFollowRegistry().filter(
      (entry) => !(entry.followerId === followerId && entry.followeeId === followeeId)
    )
  );
}

export function subscribeFollowing(userId: string, onData: (rows: FollowRecord[]) => void) {
  const publish = () => {
    const rows = readFollowRegistry()
      .filter((entry) => entry.followerId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };

  publish();
  return subscribeToRegistry(publish);
}

export function subscribeFollowers(userId: string, onData: (rows: FollowRecord[]) => void) {
  const publish = () => {
    const rows = readFollowRegistry()
      .filter((entry) => entry.followeeId === userId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    onData(rows);
  };

  publish();
  return subscribeToRegistry(publish);
}

export function subscribeFollowingIds(userId: string, onData: (ids: Set<string>) => void) {
  return subscribeFollowing(userId, (rows) => {
    onData(new Set(rows.map((entry) => entry.followeeId)));
  });
}
