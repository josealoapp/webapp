import { auth } from "@/lib/firebase";

type SearchEventInput = {
  query?: string;
  category?: string;
  location?: string;
  source?: "search" | "category" | "home";
};

export function normalizeSearchQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function recordSearchEvent(input: SearchEventInput) {
  const query = input.query?.trim() || "";
  const category = input.category?.trim() || "";

  if (!query && !category) return;

  const token = await auth.currentUser?.getIdToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch("/api/search-events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      normalizedQuery: normalizeSearchQuery(query),
      category,
      location: input.location?.trim() || "",
      source: input.source || "search",
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "search-event/create-failed");
  }
}
