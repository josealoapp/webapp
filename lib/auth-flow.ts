"use client";

import { doc, getDoc } from "firebase/firestore";
import { signOut, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  getPostAuthDestination,
  loadAccountProfileFromBackend,
  readAccountProfile,
  writeAccountProfile,
} from "@/lib/account-profile";

export function waitForMinimumLoaderTime(startedAt: number) {
  const remaining = 2000 - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

export function getDeactivatedAccountMessage(reason: string) {
  if (!reason) return "";
  if (reason === "Estafa" || reason === "Artículo robado") {
    return "Lo sentimos, tu cuenta fue involucrada en una acción fraudulenta crítica y ha sido suspendida permanentemente. Contáctanos si no estás de acuerdo con esta decisión.";
  }
  return "Tu cuenta fue desactivada por soporte. Contáctanos si necesitas revisar esta decisión.";
}

export async function assertAccountIsActive(user: User) {
  const profileSnap = await getDoc(doc(db, "userProfiles", user.uid)).catch(() => null);
  const supportStatus = profileSnap?.data()?.supportStatus;

  if (supportStatus !== "deactivated") {
    return;
  }

  const reason = String(profileSnap?.data()?.supportDeactivationReason || "");
  await signOut(auth).catch(() => undefined);
  throw new Error(`account/deactivated|${reason}`);
}

export function cacheAuthUser(user: User, fallbackName?: string) {
  try {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName || fallbackName || "",
        signedInAt: Date.now(),
      })
    );
  } catch {
    // Local compatibility cache is best effort.
  }
}

export async function preparePostAuthDestination(user: User, nextPath: string, options?: { forceOnboarding?: boolean }) {
  if (options?.forceOnboarding) {
    const currentProfile = readAccountProfile();
    writeAccountProfile({
      ...currentProfile,
      userId: user.uid,
      onboardingRequired: true,
      onboardingCompleted: false,
      pendingBusinessUpgrade: false,
    });
  } else {
    await loadAccountProfileFromBackend(user.uid);
  }

  return getPostAuthDestination(nextPath);
}

export function getAuthErrorMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  const [code, detail] = message.split("|");

  if (code === "account/deactivated") {
    return getDeactivatedAccountMessage(detail || "");
  }

  const firebaseCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code)
      : code;

  if (firebaseCode === "auth/popup-closed-by-user") {
    return "Cerraste la ventana de Google antes de terminar.";
  }
  if (firebaseCode === "auth/account-exists-with-different-credential") {
    return "Ya existe una cuenta con ese email. Inicia sesión con email y contraseña.";
  }
  if (firebaseCode === "auth/unauthorized-domain") {
    return "Este dominio no está autorizado para iniciar sesión con Google en Firebase.";
  }
  if (firebaseCode === "auth/operation-not-allowed") {
    return "Google no está habilitado como método de acceso en Firebase.";
  }

  return fallback;
}
