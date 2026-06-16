import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdActive, MarketplaceAd } from "@/lib/marketplace-ads";
import { isPostgresAdsEnabled } from "@/lib/postgres";
import { listMarketplaceAdsFromPostgres } from "@/lib/postgres-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isPostgresAdsEnabled()) {
      const ads = (await listMarketplaceAdsFromPostgres()).filter((ad) => isAdActive(ad));
      return NextResponse.json(
        { ads },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const snap = await getAdminDb().collection("marketplaceAds").orderBy("createdAt", "desc").get();
    const ads = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MarketplaceAd, "id">),
      }))
      .filter((ad) => isAdActive(ad as MarketplaceAd)) as MarketplaceAd[];

    return NextResponse.json(
      { ads },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "ads/list-failed";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
