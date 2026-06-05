import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getBazarEndsAt, isValidBazarDuration } from "@/lib/bazar-duration";
import { buildListingSearchTokens } from "@/lib/listing-search-tokens";

const PAYMENT_METHODS = new Set(["efectivo", "intercambio", "transferencia"]);
const LISTING_TYPES = new Set(["article", "bazar"]);
const MAX_TEXT_LENGTH = 5000;
const MAX_TAGS = 12;
const MAX_BAZAR_ITEMS = 50;

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function cleanText(value: unknown, maxLength = 180) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength = 180) {
  const text = cleanText(value, maxLength);
  return text || undefined;
}

function cleanPrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null;
}

function cleanBoolean(value: unknown) {
  return value === true;
}

function cleanBazarDurationHours(value: unknown) {
  const durationHours = Number(value);
  if (!Number.isInteger(durationHours) || !isValidBazarDuration(durationHours)) {
    return null;
  }

  return durationHours;
}

function cleanImageUrl(value: unknown) {
  const url = cleanText(value, 1200);
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => cleanText(tag, 40))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

function cleanVehicleYear(value: unknown) {
  const year = Number(value);
  const currentYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1900 || year > currentYear) return undefined;
  return year;
}

function cleanCategoryMetadata(body: Record<string, unknown>) {
  return {
    vehicleYear: cleanVehicleYear(body.vehicleYear),
    clothingSize: cleanOptionalText(body.clothingSize, 20),
    shoeSize: cleanOptionalText(body.shoeSize, 20),
  };
}

function cleanBazarItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_BAZAR_ITEMS).map((rawItem, index) => {
    const item = rawItem && typeof rawItem === "object" ? (rawItem as Record<string, unknown>) : {};
    const price = cleanPrice(item.price);
    const title = cleanText(item.title, 180);
    const image = cleanImageUrl(item.image);
    const status = item.status === "sold" ? "sold" : "active";
    const soldAt = Number(item.soldAt);

    if (!title || !price || !image) {
      throw new Error("listing/invalid-bazar-item");
    }

    const metadata = cleanCategoryMetadata(item);

    return {
      id: cleanText(item.id, 120) || `item-${index + 1}`,
      title,
      description: cleanText(item.description, MAX_TEXT_LENGTH),
      price,
      image,
      status,
      ...(status === "sold" && Number.isFinite(soldAt) && soldAt > 0 ? { soldAt } : {}),
      ...(metadata.vehicleYear ? { vehicleYear: metadata.vehicleYear } : {}),
      ...(metadata.clothingSize ? { clothingSize: metadata.clothingSize } : {}),
      ...(metadata.shoeSize ? { shoeSize: metadata.shoeSize } : {}),
    };
  });
}

function buildListingPayload(body: Record<string, unknown>, ownerId: string, mode: "create" | "update") {
  const type = typeof body.type === "string" && LISTING_TYPES.has(body.type) ? body.type : "article";
  const title = cleanText(body.title, 180);
  const category = cleanText(body.category, 120);
  const description = cleanText(body.description, MAX_TEXT_LENGTH);
  const paymentMethod =
    typeof body.paymentMethod === "string" && PAYMENT_METHODS.has(body.paymentMethod)
      ? body.paymentMethod
      : "efectivo";
  const location = cleanText(body.location, 140);
  const ownerName = cleanText(body.ownerName, 160) || "Vendedor";
  const ownerAvatar = cleanImageUrl(body.ownerAvatar);
  const sellerWhatsappNumber = cleanOptionalText(body.sellerWhatsappNumber, 40);
  const sellerUsesWhatsapp = cleanBoolean(body.sellerUsesWhatsapp);
  const tags = cleanTags(body.tags);
  const metadata = cleanCategoryMetadata(body);
  const bazarItems = cleanBazarItems(body.bazarItems);
  const image =
    type === "bazar"
      ? cleanImageUrl(body.image) || bazarItems[0]?.image || ""
      : cleanImageUrl(body.image);
  const inputPrice = cleanPrice(body.price);
  const price =
    type === "bazar" && bazarItems.length
      ? Math.min(...bazarItems.map((item) => item.price))
      : inputPrice;

  if (!title || !category || !description || !location || !price) {
    throw new Error("listing/invalid-payload");
  }

  if (type === "article" && !image) {
    throw new Error("listing/invalid-image");
  }

  if (type === "bazar" && (!bazarItems.length || !image)) {
    throw new Error("listing/invalid-bazar");
  }
  const bazarDurationHours = type === "bazar" ? cleanBazarDurationHours(body.bazarDurationHours) : null;
  if (type === "bazar" && !bazarDurationHours) {
    throw new Error("listing/invalid-bazar-duration");
  }
  const bazarStartsAt = Number(body.createdAt) > 0 ? Number(body.createdAt) : Date.now();

  const payload: Record<string, unknown> = {
    ownerId,
    ownerName,
    ...(ownerAvatar ? { ownerAvatar } : {}),
    ...(sellerWhatsappNumber ? { sellerWhatsappNumber } : {}),
    sellerUsesWhatsapp,
    type,
    title,
    price,
    category,
    ...(type === "bazar" ? { bazarCategory: cleanText(body.bazarCategory, 120) || category } : {}),
    description,
    tags,
    paymentMethod,
    location,
    image,
    status: body.status === "sold" && mode === "update" ? "sold" : "active",
    ...(type === "article" && metadata.vehicleYear ? { vehicleYear: metadata.vehicleYear } : {}),
    ...(type === "article" && metadata.clothingSize ? { clothingSize: metadata.clothingSize } : {}),
    ...(type === "article" && metadata.shoeSize ? { shoeSize: metadata.shoeSize } : {}),
    bazarItems: type === "bazar" ? bazarItems : [],
    searchTokens: buildListingSearchTokens({
      title,
      description,
      category,
      bazarCategory: type === "bazar" ? cleanText(body.bazarCategory, 120) || category : "",
      tags,
      location,
      bazarItems: type === "bazar" ? bazarItems : [],
    }),
    ...(type === "bazar" && bazarDurationHours
      ? {
          bazarDurationHours,
          bazarEndsAt: getBazarEndsAt(bazarStartsAt, bazarDurationHours),
        }
      : {}),
  };

  if (mode === "update" && body.soldAt && Number.isFinite(Number(body.soldAt))) {
    payload.soldAt = Number(body.soldAt);
  }

  return payload;
}

async function getVerifiedListingOwner(listingId: string) {
  const snapshot = await getAdminDb().collection("listings").doc(listingId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as { ownerId?: string } | undefined;
  return data?.ownerId || null;
}

async function isAccountDeactivated(userId: string) {
  const snapshot = await getAdminDb().collection("userProfiles").doc(userId).get();
  return snapshot.data()?.supportStatus === "deactivated";
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;

    if (body.ownerId !== decoded.uid) {
      return NextResponse.json({ error: "listing/owner-mismatch" }, { status: 403 });
    }

    if (await isAccountDeactivated(decoded.uid)) {
      return NextResponse.json({ error: "user/account-deactivated" }, { status: 403 });
    }

    const now = Date.now();
    const payload = {
      ...buildListingPayload(body, decoded.uid, "create"),
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    };

    const ref = await getAdminDb().collection("listings").add(payload);
    return NextResponse.json({ id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/create-failed";
    const status = message.startsWith("listing/") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const listingId = typeof body.id === "string" ? body.id.trim() : "";

    if (!listingId) {
      return NextResponse.json({ error: "listing/missing-id" }, { status: 400 });
    }

    const ownerId = await getVerifiedListingOwner(listingId);
    if (!ownerId) {
      return NextResponse.json({ error: "listing/not-found" }, { status: 404 });
    }

    if (ownerId !== decoded.uid) {
      return NextResponse.json({ error: "listing/owner-mismatch" }, { status: 403 });
    }

    if (await isAccountDeactivated(decoded.uid)) {
      return NextResponse.json({ error: "user/account-deactivated" }, { status: 403 });
    }

    const payload = {
      ...buildListingPayload({ ...body, ownerId: decoded.uid }, decoded.uid, "update"),
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await getAdminDb().collection("listings").doc(listingId).update(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/update-failed";
    const status = message.startsWith("listing/") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
