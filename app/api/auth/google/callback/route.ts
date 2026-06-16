import { NextRequest, NextResponse } from "next/server";
import { signInWithPostgresGoogle } from "@/lib/postgres-auth";

export const runtime = "nodejs";

const STATE_COOKIE = "josealo_google_oauth_state";
const NEXT_COOKIE = "josealo_google_oauth_next";
const TRANSFER_COOKIE = "josealo_auth_transfer";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function cleanNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 500);
}

function redirectWithError(request: NextRequest, error: string) {
  const redirect = new URL("/sign-in", request.nextUrl.origin);
  redirect.searchParams.set("error", error);
  return NextResponse.redirect(redirect);
}

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(STATE_COOKIE)?.value || "";
  const next = cleanNext(request.cookies.get(NEXT_COOKIE)?.value || "/");
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";

  if (!expectedState || !state || expectedState !== state || !code) {
    return redirectWithError(request, "auth/google-state-invalid");
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new Error(tokenPayload?.error || "auth/google-token-failed");
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: "no-store",
    });
    const userInfo = (await userInfoResponse.json().catch(() => null)) as GoogleUserInfo | null;
    if (!userInfoResponse.ok || !userInfo?.sub || !userInfo.email) {
      throw new Error("auth/google-userinfo-failed");
    }

    const session = await signInWithPostgresGoogle({
      providerId: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name || userInfo.email.split("@")[0] || "Usuario",
      photoURL: userInfo.picture || "",
      emailVerified: userInfo.email_verified === true,
    });

    const destination = session.isNewUser ? "/onboarding" : next;
    const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin));
    response.cookies.delete(STATE_COOKIE);
    response.cookies.delete(NEXT_COOKIE);
    response.cookies.set(
      TRANSFER_COOKIE,
      encodeURIComponent(JSON.stringify({ token: session.token, user: session.user })),
      {
        httpOnly: false,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 60,
      }
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth/google-callback-failed";
    return redirectWithError(request, message);
  }
}
