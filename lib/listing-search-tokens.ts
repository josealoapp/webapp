const MAX_SEARCH_TOKENS = 80;

export function normalizeListingSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeListingSearch(value: string, maxTokens = 10) {
  return Array.from(new Set(normalizeListingSearchText(value).split(" ").filter((token) => token.length >= 2))).slice(
    0,
    maxTokens
  );
}

export function buildListingSearchTokens(input: {
  title?: string;
  description?: string;
  category?: string;
  bazarCategory?: string;
  tags?: string[];
  location?: string;
  bazarItems?: Array<{ title?: string; description?: string }>;
}) {
  const bazarText = (input.bazarItems || [])
    .map((item) => `${item.title || ""} ${item.description || ""}`)
    .join(" ");
  const source = [
    input.title,
    input.description,
    input.category,
    input.bazarCategory,
    input.location,
    ...(input.tags || []),
    bazarText,
  ].join(" ");

  return Array.from(new Set(normalizeListingSearchText(source).split(" ").filter((token) => token.length >= 2))).slice(
    0,
    MAX_SEARCH_TOKENS
  );
}
