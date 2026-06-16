"use client";

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  getIdToken: () => Promise<string>;
  reload: () => Promise<void>;
};

type AuthStateListener = (user: User | null) => void;
type StoredAuth = {
  token: string;
  user: Omit<User, "getIdToken" | "reload">;
};

const AUTH_STORAGE_KEY = "josealo_auth_session";
const AUTH_TRANSFER_COOKIE = "josealo_auth_transfer";
const listeners = new Set<AuthStateListener>();

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function parseTransferCookie(value: string): StoredAuth | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded)) as StoredAuth;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value)) as StoredAuth;
    } catch {
      return null;
    }
  }
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null") as StoredAuth | null;
  } catch {
    return null;
  }
}

function writeStoredAuth(value: StoredAuth | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

function makeUser(stored: StoredAuth): User {
  const user: User = {
    ...stored.user,
    getIdToken: async () => stored.token,
    reload: async () => {
      const refreshed = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${stored.token}` },
        cache: "no-store",
      });
      if (!refreshed.ok) {
        auth.currentUser = null;
        writeStoredAuth(null);
        notify();
        return;
      }
      const payload = (await refreshed.json()) as StoredAuth;
      setAuthState(payload.token, payload.user);
    },
  };
  return user;
}

function notify() {
  listeners.forEach((listener) => listener(auth.currentUser));
}

function setAuthState(token: string, user: StoredAuth["user"]) {
  const stored = { token, user };
  writeStoredAuth(stored);
  auth.currentUser = makeUser(stored);
  notify();
}

export const auth: { currentUser: User | null } = {
  currentUser: (() => {
    const transfer = readCookie(AUTH_TRANSFER_COOKIE);
    if (transfer) {
      const parsed = parseTransferCookie(transfer);
      if (parsed?.token && parsed.user?.uid) {
        writeStoredAuth(parsed);
        clearCookie(AUTH_TRANSFER_COOKIE);
        return makeUser(parsed);
      }
      clearCookie(AUTH_TRANSFER_COOKIE);
    }
    const stored = readStoredAuth();
    return stored ? makeUser(stored) : null;
  })(),
};

if (typeof window !== "undefined" && auth.currentUser) {
  void auth.currentUser.reload().catch(() => undefined);
}

export function onAuthStateChanged(_auth: typeof auth, listener: AuthStateListener) {
  listeners.add(listener);
  queueMicrotask(() => listener(auth.currentUser));
  return () => {
    listeners.delete(listener);
  };
}

export async function signInWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const response = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => null)) as (StoredAuth & { error?: string }) | null;
  if (!response.ok || !payload?.token) {
    const error = new Error(payload?.error || "auth/invalid-credential") as Error & { code?: string };
    error.code = payload?.error || "auth/invalid-credential";
    throw error;
  }
  setAuthState(payload.token, payload.user);
  return { user: auth.currentUser as User };
}

export async function createUserWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const response = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => null)) as (StoredAuth & { error?: string }) | null;
  if (!response.ok || !payload?.token) {
    const error = new Error(payload?.error || "auth/create-failed") as Error & { code?: string };
    error.code = payload?.error || "auth/create-failed";
    throw error;
  }
  setAuthState(payload.token, payload.user);
  return { user: auth.currentUser as User, additionalUserInfo: { isNewUser: true } };
}

export async function updateProfile(user: User, input: { displayName?: string; photoURL?: string }) {
  const token = await user.getIdToken();
  const response = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as (StoredAuth & { error?: string }) | null;
  if (!response.ok || !payload?.token) throw new Error(payload?.error || "auth/update-profile-failed");
  setAuthState(payload.token, payload.user);
}

export async function signOut(_auth: typeof auth) {
  const token = await auth.currentUser?.getIdToken().catch(() => "");
  if (token) {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  auth.currentUser = null;
  writeStoredAuth(null);
  notify();
}

export async function sendEmailVerification(user: User) {
  const token = await user.getIdToken();
  await fetch("/api/auth/email-verification", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendPasswordResetEmail(_auth: typeof auth, email: string) {
  await fetch("/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function verifyPasswordResetCode(_auth: typeof auth, token: string) {
  const response = await fetch(`/api/auth/password-reset?token=${encodeURIComponent(token)}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as { email?: string; error?: string } | null;
  if (!response.ok || !payload?.email) throw new Error(payload?.error || "auth/invalid-action-code");
  return payload.email;
}

export async function confirmPasswordReset(_auth: typeof auth, token: string, password: string) {
  const response = await fetch("/api/auth/password-reset", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "auth/invalid-action-code");
}

export class GoogleAuthProvider {
  setCustomParameters(_params: Record<string, string>) {}
}

export async function signInWithPopup(
  _auth?: typeof auth,
  _provider?: GoogleAuthProvider
): Promise<{ user: User; additionalUserInfo: { isNewUser: boolean } }> {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  }
  return new Promise(() => undefined);
}

export function getAdditionalUserInfo(credential: { additionalUserInfo?: { isNewUser?: boolean } }) {
  return credential.additionalUserInfo || null;
}
