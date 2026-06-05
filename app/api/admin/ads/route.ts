import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { assertAdminRequest } from "@/lib/admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { moderateImageBuffer } from "@/lib/image-moderation";
import { uploadListingImageObject, validateListingImage } from "@/lib/s3";
import type { MarketplaceAd } from "@/lib/marketplace-ads";

export const runtime = "nodejs";

function cleanText(value: FormDataEntryValue | null, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function cleanUrl(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const snap = await getAdminDb().collection("marketplaceAds").orderBy("createdAt", "desc").get();
    const ads = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<MarketplaceAd, "id">),
    })) as MarketplaceAd[];

    return NextResponse.json({ ads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/ads-list-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const campaignName = cleanText(formData.get("campaignName"));
    const startDate = cleanText(formData.get("startDate"), 20);
    const endDate = cleanText(formData.get("endDate"), 20);
    const linkUrl = cleanUrl(cleanText(formData.get("linkUrl"), 1200));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ads/image-required" }, { status: 400 });
    }
    if (!campaignName || !isValidDateKey(startDate) || !isValidDateKey(endDate) || !linkUrl) {
      return NextResponse.json({ error: "ads/invalid-payload" }, { status: 400 });
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: "ads/invalid-date-range" }, { status: 400 });
    }

    validateListingImage({ name: file.name || "ad.jpg", type: file.type || "image/jpeg", size: file.size || 0 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const moderation = await moderateImageBuffer(buffer);
    if (moderation.blocked) {
      return NextResponse.json({ error: "ads/unsafe-image" }, { status: 400 });
    }

    const upload = await uploadListingImageObject({
      fileName: file.name || "ad.jpg",
      contentType: file.type || "image/jpeg",
      userId: "admin-ads",
      index: 0,
      body: buffer,
    });

    const now = Date.now();
    const ref = await getAdminDb().collection("marketplaceAds").add({
      campaignName,
      imageUrl: upload.fileUrl,
      linkUrl,
      startDate,
      endDate,
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ad: {
        id: ref.id,
        campaignName,
        imageUrl: upload.fileUrl,
        linkUrl,
        startDate,
        endDate,
        createdAt: now,
      } satisfies MarketplaceAd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/ads-create-failed";
    const status = message.startsWith("ads/") || message.startsWith("upload/") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const session = assertAdminRequest(request);
  if (!session) {
    return NextResponse.json({ error: "admin/unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { adId?: string } | null;
    const adId = body?.adId?.trim() || "";
    if (!adId) {
      return NextResponse.json({ error: "ads/id-required" }, { status: 400 });
    }

    await getAdminDb().collection("marketplaceAds").doc(adId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "admin/ads-delete-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
