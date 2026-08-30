import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresSalesEnabled } from "@/lib/postgres";
import { listProfileSalesFromPostgres, type ProfileSaleRow } from "@/lib/postgres-sales";

export const runtime = "nodejs";

type FirestoreSaleEvent = {
  listingId?: string;
  bazarItemId?: string;
  type?: string;
  soldAt?: number;
  saleTitle?: string;
  salePrice?: number;
  saleCurrency?: string;
  saleCategory?: string;
  saleImage?: string;
  soldToUserName?: string;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function listProfileSalesFromFirestore(userId: string): Promise<ProfileSaleRow[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection("listingSoldEvents")
    .where("ownerId", "==", userId)
    .limit(500)
    .get();

  const rows = await Promise.all(
    snapshot.docs.map(async (eventDoc) => {
      const event = eventDoc.data() as FirestoreSaleEvent;
      const listingId = getString(event.listingId);
      if (!listingId) return null;

      const listingSnap = await db.collection("listings").doc(listingId).get();
      const listing = listingSnap.data() || {};
      const bazarItemId = getString(event.bazarItemId);
      const bazarItems = asArray<Record<string, unknown>>(listing.bazarItems);
      const bazarItem = bazarItemId ? bazarItems.find((item) => item.id === bazarItemId) : null;
      const isBazarSale = event.type === "bazarItem" || Boolean(bazarItemId);

      if (isBazarSale) {
        if (!bazarItem || bazarItem.status !== "sold") return null;
      } else if (listing.status !== "sold") {
        return null;
      }

      const images = asArray<string>(listing.images);
      const title =
        getString(event.saleTitle) ||
        getString(bazarItem?.title) ||
        getString(listing.title) ||
        "Artículo vendido";
      const price =
        toNumber(event.salePrice) ||
        toNumber(bazarItem?.price) ||
        toNumber(listing.price);

      if (price <= 0) return null;

      return {
        id: eventDoc.id,
        listingId,
        bazarItemId,
        title,
        price,
        currency: getString(event.saleCurrency) || getString(bazarItem?.currency) || getString(listing.currency, "DOP"),
        category:
          getString(event.saleCategory) ||
          getString(bazarItem?.category) ||
          getString(listing.bazarCategory) ||
          getString(listing.category, "Sin categoría"),
        image:
          getString(event.saleImage) ||
          getString(bazarItem?.image) ||
          getString(listing.image) ||
          images[0] ||
          "",
        soldAt: toNumber(event.soldAt),
        soldToUserName: getString(event.soldToUserName) || getString(listing.soldToUserName, "No especificado"),
      };
    })
  );

  return rows
    .filter((row): row is ProfileSaleRow => Boolean(row))
    .sort((a, b) => b.soldAt - a.soldAt);
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const sales = isPostgresSalesEnabled()
      ? await listProfileSalesFromPostgres(decoded.uid)
      : await listProfileSalesFromFirestore(decoded.uid);

    return NextResponse.json({ sales });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/sales-details-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
