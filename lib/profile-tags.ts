"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type ProfileTagType = "payment" | "delivery" | "schedule";
export type TaxIdType = "cedula" | "rnc";
export type AccountKind = "Ahorros" | "Corriente" | "Empresarial";

type BaseProfileTag = {
  id: string;
  type: ProfileTagType;
  title: string;
  createdAt: number;
};

export type PaymentProfileTag = BaseProfileTag & {
  type: "payment";
  bankName: string;
  beneficiaryName: string;
  accountKind: AccountKind;
  accountNumber: string;
  taxIdType: TaxIdType;
  taxId: string;
};

export type DeliveryProfileTag = BaseProfileTag & {
  type: "delivery";
  pointName: string;
  address: string;
  notes: string;
};

export type ScheduleProfileTag = BaseProfileTag & {
  type: "schedule";
  availableDays: string[];
  startsAt: string;
  endsAt: string;
  nonWorkingDays: string[];
};

export type ProfileTag = PaymentProfileTag | DeliveryProfileTag | ScheduleProfileTag;

const MAX_PROFILE_TAGS = 8;

function cleanText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems);
}

export function normalizeProfileTags(value: unknown): ProfileTag[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw): ProfileTag | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const id = cleanText(row.id, 80);
      const type = cleanText(row.type, 40) as ProfileTagType;
      const createdAt = Number(row.createdAt || Date.now());

      if (!id || !Number.isFinite(createdAt)) return null;

      if (type === "payment") {
        const bankName = cleanText(row.bankName, 120);
        const beneficiaryName = cleanText(row.beneficiaryName, 160);
        const accountKind = cleanAccountKind(row.accountKind);
        const accountNumber = cleanText(row.accountNumber, 60);
        const taxIdType = cleanText(row.taxIdType, 20) === "rnc" ? "rnc" : "cedula";
        const taxId = cleanText(row.taxId, 30);
        if (!bankName || !accountNumber || !taxId) return null;

        return {
          id,
          type,
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
          type,
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
          type,
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
    .filter((tag): tag is ProfileTag => Boolean(tag))
    .slice(0, MAX_PROFILE_TAGS);
}

function cleanAccountKind(value: unknown): AccountKind {
  const text = cleanText(value, 40).toLowerCase();
  if (text === "corriente") return "Corriente";
  if (text === "empresarial") return "Empresarial";
  return "Ahorros";
}

export function subscribeProfileTags(userId: string, onData: (tags: ProfileTag[]) => void) {
  if (!userId) {
    onData([]);
    return () => undefined;
  }

  return onSnapshot(
    doc(db, "userProfiles", userId),
    (snapshot) => {
      onData(normalizeProfileTags(snapshot.data()?.profileTags));
    },
    () => onData([])
  );
}

export async function writeProfileTags(userId: string, tags: ProfileTag[]) {
  const normalized = normalizeProfileTags(tags).slice(0, MAX_PROFILE_TAGS);
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/profile/tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      profileTags: normalized,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "profile/tags-save-failed");
  }
}
