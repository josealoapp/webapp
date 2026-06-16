"use client";

import { signOut, type User } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
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
  const response = await fetch(`/api/profile?scope=public&userId=${encodeURIComponent(user.uid)}`, {
    cache: "no-store",
  }).catch(() => null);
  const payload = response
    ? ((await response.json().catch(() => null)) as
        | { profile?: { supportStatus?: string; supportDeactivationReason?: string } | null }
        | null)
    : null;
  const supportStatus = payload?.profile?.supportStatus;

  if (supportStatus !== "deactivated") {
    return;
  }

  const reason = String(payload?.profile?.supportDeactivationReason || "");
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

export async function verifyTurnstileToken(token: string, action: string) {
  if (!token) {
    throw new Error("turnstile/missing-token");
  }

  const response = await fetch("/api/auth/turnstile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, action }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || "turnstile/failed");
  }
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
  if (firebaseCode === "turnstile/missing-token") {
    return "Completa la verificación de seguridad antes de continuar.";
  }
  if (firebaseCode === "turnstile/not-configured") {
    return "Falta configurar Cloudflare Turnstile en el servidor.";
  }
  if (firebaseCode === "turnstile/action-mismatch" || firebaseCode === "turnstile/failed") {
    return "No pudimos validar la verificación de seguridad. Intenta de nuevo.";
  }
  if (firebaseCode === "turnstile/not-ready") {
    return "La verificación de seguridad aún está cargando. Intenta de nuevo.";
  }
  if (firebaseCode === "turnstile/expired") {
    return "La verificación de seguridad expiró. Intenta de nuevo.";
  }

  return fallback;
}
