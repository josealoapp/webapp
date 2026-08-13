"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { getAdditionalUserInfo, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
import { AppSkeleton } from "@/components/AppSkeleton";
import LogoLoadAnimation from "@/components/LogoLoadAnimation";
import {
  assertAccountIsActive,
  cacheAuthUser,
  getAuthErrorMessage,
  getDeactivatedAccountMessage,
  preparePostAuthDestination,
  waitForMinimumLoaderTime,
} from "@/lib/auth-flow";

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
  return <AppSkeleton variant="auth" />;
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPostAuthPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const signUpHref = useMemo(
    () => `/sign-up?next=${encodeURIComponent(defaultPostAuthPath)}`,
    [defaultPostAuthPath]
  );
  const forgotPasswordHref = useMemo(
    () => `/forgot-password?next=${encodeURIComponent(defaultPostAuthPath)}`,
    [defaultPostAuthPath]
  );
  const isDeactivatedRedirect = searchParams.get("account") === "deactivated";
  const deactivatedReason = isDeactivatedRedirect ? searchParams.get("reason") || "" : "";

  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() =>
    isDeactivatedRedirect ? getDeactivatedAccountMessage(deactivatedReason) : ""
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const loaderStartedAt = Date.now();

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
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const user = cred.user;
      await assertAccountIsActive(user);
      cacheAuthUser(user);

      if (!user.emailVerified) {
        await waitForMinimumLoaderTime(loaderStartedAt);
        router.replace(`/verify-email?next=${encodeURIComponent(defaultPostAuthPath)}`);
        return;
      }

      const postAuthDestination = await preparePostAuthDestination(user, defaultPostAuthPath);
      await waitForMinimumLoaderTime(loaderStartedAt);
      router.replace(postAuthDestination);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;

      if (err instanceof Error && err.message.startsWith("account/deactivated")) {
        setError(getAuthErrorMessage(err, "No se pudo iniciar sesión. Intenta de nuevo."));
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Credenciales incorrectas. Revisa tu email y contraseña.");
      } else if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese email. Ve a 'Sign up'.");
      } else if (code === "auth/password-reset-required") {
        setError("Esta cuenta necesita crear una contraseña local. Usa 'Forgot password' para configurar una nueva.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Intenta de nuevo en unos minutos.");
      } else {
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const loaderStartedAt = Date.now();

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      await assertAccountIsActive(user);
      cacheAuthUser(user);
      const postAuthDestination = await preparePostAuthDestination(user, defaultPostAuthPath, {
        forceOnboarding: Boolean(getAdditionalUserInfo(cred)?.isNewUser),
      });
      await waitForMinimumLoaderTime(loaderStartedAt);
      router.replace(postAuthDestination);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "No se pudo iniciar sesión con Google. Intenta de nuevo."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-50 px-4 py-10 text-slate-950 dark:bg-neutral-950 dark:text-neutral-100">
      {loading ? <LogoLoadAnimation fullscreen /> : null}
      {googleLoading ? <LogoLoadAnimation fullscreen /> : null}

      <div className="mx-auto w-full max-w-md">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Atrás"
          className="mb-5 h-11 w-11 rounded-full border border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-50 hover:text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:shadow-none dark:hover:bg-neutral-900 dark:hover:text-white"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
              return;
            }

            router.push("/");
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Card className="border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.10)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-slate-600 dark:text-neutral-400">
              Entra para enviar tu oferta y chatear con el vendedor.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user" className="text-slate-950 dark:text-neutral-100">Email</Label>
                <Input
                  id="user"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="ej: luis@gmail.com"
                  className="h-12 rounded-2xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass" className="text-slate-950 dark:text-neutral-100">Contraseña</Label>
                <Input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-2xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:shadow-none">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-400 text-black hover:bg-orange-300"
                disabled={loading || googleLoading}
              >
                {loading ? "Ingresando..." : "Sign in"}
              </Button>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-500">
                <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
                <span>o</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-neutral-800" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={signInWithGoogle}
                className="w-full border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-50 hover:text-slate-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:shadow-none dark:hover:bg-neutral-900 dark:hover:text-white"
                disabled={loading || googleLoading}
              >
                <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-900">
                  G
                </span>
                {googleLoading ? "Conectando..." : "Continuar con Google"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link
                  href={forgotPasswordHref}
                  className="text-slate-950 underline underline-offset-4 hover:text-slate-600 dark:text-neutral-300 dark:hover:text-white"
                >
                  Forgot password
                </Link>
                <Link
                  href={signUpHref}
                  className="text-slate-950 underline underline-offset-4 hover:text-slate-600 dark:text-neutral-300 dark:hover:text-white"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-xs text-slate-500 dark:text-neutral-500">
          By continuing you agree to our terms.
        </div>
      </div>
    </div>
  );
}
