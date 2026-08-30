"use client";

export type PublicUserSearchResult = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  profileDescription: string;
  isVerified: boolean;
};

export async function searchUsers(input: { q: string; limit?: number }) {
  const params = new URLSearchParams();
  params.set("q", input.q);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(`/api/users/search?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | { users?: PublicUserSearchResult[]; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "users/search-failed");
  }

  return payload?.users || [];
}
