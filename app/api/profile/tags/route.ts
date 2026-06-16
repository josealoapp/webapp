import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresProfilesEnabled, upsertPublicProfileInPostgres } from "@/lib/postgres-profiles";

export const runtime = "nodejs";

const MAX_PROFILE_TAGS = 8;

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems);
}

function cleanAccountKind(value: unknown) {
  const text = cleanText(value, 40).toLowerCase();
  if (text === "corriente") return "Corriente";
  if (text === "empresarial") return "Empresarial";
  return "Ahorros";
}

function normalizeProfileTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const id = cleanText(row.id, 80);
      const type = cleanText(row.type, 40);
      const createdAt = Number(row.createdAt || Date.now());

      if (!id || !Number.isFinite(createdAt)) return null;

      if (type === "payment") {
        const bankName = cleanText(row.bankName, 120);
        const beneficiaryName = cleanText(row.beneficiaryName, 160);
        const accountKind = cleanAccountKind(row.accountKind);
        const accountNumber = cleanText(row.accountNumber, 60);
        const taxIdType = cleanText(row.taxIdType, 20) === "rnc" ? "rnc" : "cedula";
        const taxId = cleanText(row.taxId, 30);
        if (!bankName || !beneficiaryName || !accountNumber || !taxId) return null;

        return {
          id,
          type: "payment",
          title: "Como pagar",
          bankName,
          beneficiaryName,
          accountKind,
          accountNumber,
          taxIdType,
          taxId,
          createdAt,
        };
      }

      if (type === "delivery") {
        const pointName = cleanText(row.pointName, 120);
        const address = cleanText(row.address, 220);
        if (!pointName || !address) return null;

        return {
          id,
          type: "delivery",
          title: "Puntos de entrega",
          pointName,
          address,
          notes: cleanText(row.notes, 220),
          createdAt,
        };
      }

      if (type === "schedule") {
        const availableDays = cleanStringArray(row.availableDays, 7);
        const startsAt = cleanText(row.startsAt, 20);
        const endsAt = cleanText(row.endsAt, 20);
        if (!availableDays.length || !startsAt || !endsAt) return null;

        return {
          id,
          type: "schedule",
          title: "Horarios",
          availableDays,
          startsAt,
          endsAt,
          nonWorkingDays: cleanStringArray(row.nonWorkingDays, 8),
          createdAt,
        };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, MAX_PROFILE_TAGS);
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as
      | { userId?: unknown; profileTags?: unknown }
      | null;
    const userId = cleanText(body?.userId, 160);

    if (!userId) {
      return NextResponse.json({ error: "profile/tags-missing-user-id" }, { status: 400 });
    }

    if (decoded.uid !== userId) {
      return NextResponse.json({ error: "profile/tags-forbidden" }, { status: 403 });
    }

    const profileTags = normalizeProfileTags(body?.profileTags);
    if (!profileTags.length) {
      return NextResponse.json({ error: "profile/tags-invalid-payload" }, { status: 400 });
    }

    if (isPostgresProfilesEnabled()) {
      await upsertPublicProfileInPostgres(userId, {
        profileTags,
        updatedAt: Date.now(),
      });

      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("userProfiles").doc(userId).set(
      {
        profileTags,
        updatedAt: Date.now(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile/tags-save-failed";
    const status = message.startsWith("auth/") || message.includes("ID token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
