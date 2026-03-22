"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOffer } from "@/lib/marketplace";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <SignInContent />
    </Suspense>
  );
}

function AuthFallback() {
  return (
    <div className="min-h-[100dvh] bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
        Cargando...
      </div>
    </div>
  );
}

function SignInContent() {
  const router = useRouter();
  const sp = useSearchParams();

  // Mantengo tu query param "next"
  const nextPath = useMemo(() => sp.get("next") || "/", [sp]);

  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const email = emailOrUser.trim();
    const pass = password.trim();

    if (!email || !pass) {
      setError("Completa tu email y tu contraseña.");
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setError("Por ahora, inicia sesión con un email válido (ej: luis@gmail.com).");
      setLoading(false);
      return;
    }

    try {
      // ✅ Firebase Auth real
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const user = cred.user;

      // ⚠️ Compat: tu app actual filtra chats por "auth_user" en localStorage.
      // Guardamos algo mínimo para que NO se rompa el flujo mientras migramos a Firebase.
      try {
        localStorage.setItem(
          "auth_user",
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            signedInAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      if (!user.emailVerified) {
        router.replace(`/verify-email?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      // Si venimos del modal "Me interesa", completamos el chat ahora (local storage MVP)
      try {
        const raw = sessionStorage.getItem("pending_interest");
        if (raw) {
          const pending = JSON.parse(raw) as {
            item: {
              id: string;
              title: string;
              price: number;
              sellerId?: string;
              sellerName?: string;
              sellerMaxDiscountPercent: number;
            };
            method: "cash" | "trade" | "cash_trade";
            cashOffer: number;
            minAccepted: number;
            message: string;
            sellerId?: string;
            sellerName?: string;
            createdAt: number;
          };

          const sellerName = pending.sellerName || pending.item.sellerName || "Vendedor";
          const sellerId = pending.sellerId || pending.item.sellerId || "seller";

          const chatId = await createOffer({
            listingId: pending.item.id,
            listingTitle: pending.item.title,
            listingPrice: pending.item.price,
            sellerId,
            sellerName,
            message: pending.message,
          });

          sessionStorage.removeItem("pending_interest");
          router.replace(`/chat/${chatId}`);
          return;
        }
      } catch {
        // si falla, seguimos normal
      }

      router.replace(nextPath);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;

      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Credenciales incorrectas. Revisa tu email y contraseña.");
      } else if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese email. Ve a 'Sign up'.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Intenta de nuevo en unos minutos.");
      } else {
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-neutral-800 bg-neutral-950">
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-neutral-400">
              Entra para enviar tu oferta y chatear con el vendedor.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Email</Label>
                <Input
                  id="user"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="ej: luis@gmail.com"
                  className="border-neutral-800 bg-neutral-950"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass">Contraseña</Label>
                <Input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-neutral-800 bg-neutral-950"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-400 text-black hover:bg-orange-300"
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Sign in"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/forgot-password"
                  className="text-neutral-300 hover:text-white underline underline-offset-4"
                >
                  Forgot password
                </Link>
                <Link
                  href="/sign-up"
                  className="text-neutral-300 hover:text-white underline underline-offset-4"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-xs text-neutral-500">
          By continuing you agree to our terms.
        </div>
      </div>
    </div>
  );
}
