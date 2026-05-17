"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type StoredUserHandle = {
  uid: string;
  name: string;
  handle: string;
  updatedAt: number;
};

const USER_HANDLES_KEY = "user_handles";

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim();
}

function readHandleRegistry() {
  if (typeof window === "undefined") {
    return [] as StoredUserHandle[];
  }

  try {
    const raw = window.localStorage.getItem(USER_HANDLES_KEY);
    if (!raw) {
      return [] as StoredUserHandle[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUserHandle[]) : [];
  } catch {
    return [] as StoredUserHandle[];
  }
}

function writeHandleRegistry(entries: StoredUserHandle[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_HANDLES_KEY, JSON.stringify(entries));
}

async function loadRemoteHandle(uid: string) {
  if (!uid) return "";

  try {
    const snapshot = await getDoc(doc(db, "userProfiles", uid));
    return typeof snapshot.data()?.handle === "string" ? snapshot.data()?.handle : "";
  } catch {
    return "";
  }
}

function persistHandle(entry: StoredUserHandle) {
  void setDoc(
    doc(db, "userProfiles", entry.uid),
    {
      displayName: entry.name,
      handle: entry.handle,
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => {
    // Local handle cache remains available if Firestore is offline.
  });
}

function buildHandleBase(name: string) {
  const normalized = normalizeName(name);
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0].slice(0, 2)}${parts[1].slice(0, 2)}`.padEnd(4, "x").slice(0, 4);
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 4).padEnd(4, "x");
  }

  return "user";
}

export function getInitials(name: string) {
  const normalized = normalizeName(name);
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return "US";
}

export function getOrCreateUserHandle(input: { uid: string; name: string }) {
  const registry = readHandleRegistry();
  const existing = registry.find((entry) => entry.uid === input.uid);

  if (existing) {
    if (existing.name !== input.name.trim()) {
      const updated = registry.map((entry) =>
        entry.uid === input.uid
          ? { ...entry, name: input.name.trim(), updatedAt: Date.now() }
          : entry
      );
      writeHandleRegistry(updated);
    }

    persistHandle({ ...existing, name: input.name.trim(), updatedAt: Date.now() });
    return existing.handle;
  }

  const base = buildHandleBase(input.name);
  const nextNumber =
    registry.filter((entry) => entry.handle.startsWith(`${base}-`)).length + 1;
  const handle = `${base}-${String(nextNumber).padStart(3, "0")}`;

  const entry = {
    uid: input.uid,
    name: input.name.trim(),
    handle,
    updatedAt: Date.now(),
  };

  writeHandleRegistry([
    ...registry,
    entry,
  ]);
  persistHandle(entry);

  return handle;
}

export async function getOrCreateUserHandleFromBackend(input: { uid: string; name: string }) {
  const remote = await loadRemoteHandle(input.uid);
  if (remote) {
    const registry = readHandleRegistry();
    const entry = {
      uid: input.uid,
      name: input.name.trim(),
      handle: remote,
      updatedAt: Date.now(),
    };
    writeHandleRegistry([...registry.filter((row) => row.uid !== input.uid), entry]);
    return remote;
  }

  return getOrCreateUserHandle(input);
}
