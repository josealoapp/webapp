"use client";

import { auth } from "@/lib/firebase";

export const INSTAGRAM_BASE_URL = "https://www.instagram.com";

export function normalizeInstagramUsername(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const withoutUrl = trimmedValue
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "");

  const username = withoutUrl.split("/")[0]?.trim() || "";

  return username.replace(/[^a-zA-Z0-9._]/g, "");
}

export function getInstagramProfileUrl(username: string) {
  const normalized = normalizeInstagramUsername(username);
  return normalized ? `${INSTAGRAM_BASE_URL}/${normalized}/` : "";
}

export async function writeInstagramUsername(userId: string, username: string) {
  const normalized = normalizeInstagramUsername(username);
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/profile/instagram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      instagramUsername: normalized,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "profile/instagram-save-failed");
  }
}

export function subscribeInstagramUsername(userId: string, onData: (username: string) => void) {
  if (!userId) {
    onData("");
    return () => undefined;
  }

  const controller = new AbortController();

  fetch(`/api/profile/instagram?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    signal: controller.signal,
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "profile/instagram-read-failed");
      }

      const payload = (await response.json()) as { instagramUsername?: string | null };
      onData(normalizeInstagramUsername(payload.instagramUsername || ""));
    })
    .catch((error) => {
      if (controller.signal.aborted) {
        return;
      }

      console.error("instagram-profile-fetch-failed", error);
      onData("");
    });

  return () => controller.abort();
}
