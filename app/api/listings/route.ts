import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function cleanForFirestore(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanForFirestore);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, cleanForFirestore(entryValue)])
    );
  }

  return value;
}

async function getVerifiedListingOwner(listingId: string) {
  const snapshot = await getAdminDb().collection("listings").doc(listingId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as { ownerId?: string } | undefined;
  return data?.ownerId || null;
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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const price = Number(body.price);
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!title || !category || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "listing/invalid-payload" }, { status: 400 });
    }

    const now = Date.now();
    const payload = cleanForFirestore({
      ...body,
      title,
      category,
      price,
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    }) as Record<string, unknown>;

    const ref = await getAdminDb().collection("listings").add(payload);
    return NextResponse.json({ id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/create-failed";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const { id: _id, createdAt: _createdAt, createdAtServer: _createdAtServer, ...input } = body;
    void _id;
    void _createdAt;
    void _createdAtServer;

    const payload = cleanForFirestore({
      ...input,
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    }) as Record<string, unknown>;

    await getAdminDb().collection("listings").doc(listingId).update(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "listing/update-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
