import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdActive, MarketplaceAd } from "@/lib/marketplace-ads";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await getAdminDb().collection("marketplaceAds").orderBy("createdAt", "desc").get();
    const ads = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MarketplaceAd, "id">),
      }))
      .filter((ad) => isAdActive(ad as MarketplaceAd)) as MarketplaceAd[];

    return NextResponse.json({ ads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ads/list-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
