import { NextResponse } from "next/server";

type TurnstileVerification = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; action?: string } | null;
  const token = body?.token?.trim() || "";
  const expectedAction = body?.action?.trim() || "";
  const secret = process.env.TURNSTILE_SECRET_KEY || "";

  if (!secret) {
    return NextResponse.json({ error: "turnstile/not-configured" }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ error: "turnstile/missing-token" }, { status: 400 });
  }

  const remoteIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }

  const verificationResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  }).catch(() => null);

  const verification = (await verificationResponse?.json().catch(() => null)) as TurnstileVerification | null;

  if (!verificationResponse?.ok || !verification?.success) {
    return NextResponse.json(
      {
        error: "turnstile/failed",
        codes: verification?.["error-codes"] || [],
      },
      { status: 400 }
    );
  }

  if (expectedAction && verification.action && verification.action !== expectedAction) {
    return NextResponse.json({ error: "turnstile/action-mismatch" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
