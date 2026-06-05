import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeListingSearchText, tokenizeListingSearch } from "@/lib/listing-search-tokens";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_SCAN_LIMIT = 150;
const ALLOWED_STATUSES = new Set(["active", "sold"]);
const ALLOWED_TYPES = new Set(["article", "bazar"]);

type ListingCursor = {
  createdAt: number;
  id: string;
};

function cleanText(value: string | null, maxLength = 140) {
  return (value || "").trim().slice(0, maxLength);
}

function cleanLimit(value: string | null) {
  const limit = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function normalizeSearchText(value: string) {
  return normalizeListingSearchText(value);
}

function locationQueryValues(location: string) {
  const normalized = normalizeSearchText(location);
  if (!normalized) return [];

  if (normalized === "distrito nacional" || normalized === "santo domingo" || normalized === "sdn") {
    return ["Distrito Nacional", "Santo Domingo"];
  }

  if (normalized === "santiago de los caballeros" || normalized === "santiago") {
    return ["Santiago de los Caballeros", "Santiago"];
  }

  if (normalized === "punta cana" || normalized === "la altagracia") {
    return ["Punta Cana", "La Altagracia"];
  }

  return [location];
}

function parseCursor(value: string | null): ListingCursor | null {
  if (!value) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ListingCursor;
    if (!decoded.id || !Number.isFinite(decoded.createdAt)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function makeCursor(createdAt: number, id: string) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64url");
}

function listingMatchesQuery(data: Record<string, unknown>, query: string) {
  if (!query) return true;

  const tags = Array.isArray(data.tags) ? data.tags.join(" ") : "";
  const bazarItems = Array.isArray(data.bazarItems)
    ? data.bazarItems
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const row = item as Record<string, unknown>;
          return `${row.title || ""} ${row.description || ""}`;
        })
        .join(" ")
    : "";
  const haystack = normalizeSearchText(
    `${data.title || ""} ${data.description || ""} ${data.category || ""} ${data.bazarCategory || ""} ${tags} ${bazarItems}`
  );

  return haystack.includes(query);
}

function listingMatchesStatus(data: Record<string, unknown>, status: string) {
  const listingStatus = typeof data.status === "string" ? data.status : "active";
  return listingStatus === status;
}

function listingMatchesLocation(data: Record<string, unknown>, locationValues: string[]) {
  if (!locationValues.length) return true;
  const listingLocation = typeof data.location === "string" ? data.location : "";
  const normalizedListingLocation = normalizeSearchText(listingLocation);

  return locationValues.some((location) => normalizeSearchText(location) === normalizedListingLocation);
}

function listingMatchesExactField(data: Record<string, unknown>, field: string, value: string) {
  if (!value) return true;
  return data[field] === value;
}

function serializeListing(id: string, data: Record<string, unknown>) {
  return {
    id,
    ownerId: data.ownerId || "",
    ownerName: data.ownerName || "",
    ownerAvatar: data.ownerAvatar || "",
    sellerWhatsappNumber: data.sellerWhatsappNumber || "",
    sellerUsesWhatsapp: data.sellerUsesWhatsapp === true,
    type: data.type || "article",
    title: data.title || "",
    price: Number(data.price || 0),
    category: data.category || "General",
    bazarCategory: data.bazarCategory || "",
    description: data.description || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    paymentMethod: data.paymentMethod || "efectivo",
    location: data.location || "",
    image: data.image || "",
    vehicleYear: data.vehicleYear,
    clothingSize: data.clothingSize,
    shoeSize: data.shoeSize,
    bazarItems: Array.isArray(data.bazarItems) ? data.bazarItems : [],
    bazarDurationHours: data.bazarDurationHours,
    bazarEndsAt: data.bazarEndsAt,
    createdAt: Number(data.createdAt || 0),
    status: data.status || "active",
    soldAt: data.soldAt,
    soldWithJosealo: data.soldWithJosealo,
    saleSpeedRating: data.saleSpeedRating,
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = cleanText(params.get("category"));
    const location = cleanText(params.get("location"));
    const ownerId = cleanText(params.get("ownerId"));
    const requestedStatus = cleanText(params.get("status"), 40);
    const status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : "active";
    const requestedType = cleanText(params.get("type"), 40);
    const type = ALLOWED_TYPES.has(requestedType) ? requestedType : "";
    const searchQuery = normalizeSearchText(cleanText(params.get("q"), 120));
    const searchTokens = tokenizeListingSearch(searchQuery);
    const limit = cleanLimit(params.get("limit"));
    const cursor = parseCursor(params.get("cursor"));
    const scanLimit = searchQuery ? Math.min(MAX_SCAN_LIMIT, limit * 4) : limit;

    let query: FirebaseFirestore.Query = getAdminDb().collection("listings");

    if (status === "sold") {
      query = query.where("status", "==", status);
    }

    if (searchTokens.length) {
      query = query.where("searchTokens", "array-contains-any", searchTokens.slice(0, 10));
    }

    const locationValues = locationQueryValues(location);
    if (locationValues.length === 1) {
      query = query.where("location", "==", locationValues[0]);
    } else if (locationValues.length > 1) {
      query = query.where("location", "in", locationValues);
    }

    if (category) {
      query = query.where("category", "==", category);
    }

    if (type) {
      query = query.where("type", "==", type);
    }

    if (ownerId) {
      query = query.where("ownerId", "==", ownerId);
    }

    query = query.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");

    if (cursor) {
      query = query.startAfter(cursor.createdAt, cursor.id);
    }

    const getSearchSnapshot = async () => {
      try {
        return await query.limit(scanLimit).get();
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
        const message = error instanceof Error ? error.message : "";
        const isMissingIndex = code === "failed-precondition" || message.toLowerCase().includes("requires an index");

        if (!isMissingIndex) {
          throw error;
        }

        let fallbackQuery: FirebaseFirestore.Query = getAdminDb()
          .collection("listings")
          .orderBy("createdAt", "desc")
          .orderBy(FieldPath.documentId(), "desc");

        if (cursor) {
          fallbackQuery = fallbackQuery.startAfter(cursor.createdAt, cursor.id);
        }

        return fallbackQuery.limit(Math.min(MAX_SCAN_LIMIT, scanLimit * 3)).get();
      }
    };

    let snapshot = await getSearchSnapshot();
    let scannedDocs = snapshot.docs;
    if (searchTokens.length && scannedDocs.length < limit) {
      const fallbackQuery = getAdminDb()
        .collection("listings")
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .limit(Math.min(MAX_SCAN_LIMIT, scanLimit * 3));
      const fallbackSnapshot = await fallbackQuery.get();
      const merged = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      scannedDocs.forEach((doc) => merged.set(doc.id, doc));
      fallbackSnapshot.docs.forEach((doc) => merged.set(doc.id, doc));
      scannedDocs = Array.from(merged.values()).sort(
        (a, b) => Number(b.get("createdAt") || 0) - Number(a.get("createdAt") || 0) || b.id.localeCompare(a.id)
      );
    }
    const rows = scannedDocs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return { id: doc.id, data };
      })
      .filter(({ data }) => listingMatchesStatus(data, status))
      .filter(({ data }) => listingMatchesLocation(data, locationValues))
      .filter(({ data }) => listingMatchesExactField(data, "category", category))
      .filter(({ data }) => listingMatchesExactField(data, "type", type))
      .filter(({ data }) => listingMatchesExactField(data, "ownerId", ownerId))
      .filter(({ data }) => listingMatchesQuery(data, searchQuery))
      .slice(0, limit)
      .map(({ id, data }) => serializeListing(id, data));

    const lastScanned = scannedDocs[scannedDocs.length - 1];
    const nextCursor = lastScanned
      ? makeCursor(Number(lastScanned.get("createdAt") || 0), lastScanned.id)
      : null;

    return NextResponse.json({
      items: rows,
      nextCursor: scannedDocs.length === scanLimit ? nextCursor : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listings/search-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
