import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual, createHmac, scryptSync } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";

const ADMIN_COOKIE_NAME = "josealo_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "LM9lpnslp0*";
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "josealo-admin-secret";
const ADMIN_CONFIG_COLLECTION = "adminConfig";
const ADMIN_CONFIG_DOC = "super-admin";

type AdminConfig = {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  updatedAt: number;
};

type AdminSessionPayload = {
  username: string;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function signPayload(payload: string) {
  return createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
}

function createSessionToken(payload: AdminSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): AdminSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const safeMatch =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!safeMatch) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
    if (!payload?.username || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function getAdminConfigDoc() {
  return getAdminDb().collection(ADMIN_CONFIG_COLLECTION).doc(ADMIN_CONFIG_DOC);
}

export async function ensureSuperAdminConfig() {
  const docRef = await getAdminConfigDoc();
  const snapshot = await docRef.get();
  if (snapshot.exists) {
    return snapshot.data() as AdminConfig;
  }

  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(DEFAULT_ADMIN_PASSWORD, passwordSalt);
  const config: AdminConfig = {
    username: ADMIN_USERNAME,
    passwordHash,
    passwordSalt,
    updatedAt: Date.now(),
  };

  await docRef.set(config);
  return config;
}

export async function verifyAdminCredentials(username: string, password: string) {
  const config = await ensureSuperAdminConfig();
  if (username.trim().toLowerCase() !== config.username.toLowerCase()) {
    return false;
  }

  const attemptedHash = hashPassword(password, config.passwordSalt);
  return attemptedHash === config.passwordHash;
}

export async function updateAdminPassword(nextPassword: string) {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(nextPassword, passwordSalt);
  const docRef = await getAdminConfigDoc();

  await docRef.set(
    {
      username: ADMIN_USERNAME,
      passwordHash,
      passwordSalt,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

export function buildAdminSessionResponse() {
  const payload: AdminSessionPayload = {
    username: ADMIN_USERNAME,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  };

  const response = NextResponse.json({ ok: true, username: ADMIN_USERNAME });
  response.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}

export function buildAdminSignOutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export function readAdminSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value || "";
  return verifySessionToken(token);
}

export async function readAdminSessionFromServer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
  return verifySessionToken(token);
}

export function assertAdminRequest(request: NextRequest) {
  const session = readAdminSessionFromRequest(request);
  if (!session) {
    return null;
  }

  return session;
}

export { ADMIN_USERNAME };
