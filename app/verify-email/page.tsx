"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { sendEmailVerification } from "@/lib/auth-client";
import { ArrowLeft, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPostAuthDestination } from "@/lib/account-profile";
import { AppSkeleton } from "@/components/AppSkeleton";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyFallback() {
  return <AppSkeleton variant="auth" />;
}

function VerifyEmailContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/", [sp]);
  const initialEmailStatus = useMemo(() => sp.get("email") || "", [sp]);
  const verificationToken = useMemo(() => sp.get("token") || "", [sp]);

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const user = auth.currentUser;
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    user.reload().then(() => {
      if (!cancelled && auth.currentUser?.emailVerified) {
        router.replace(getPostAuthDestination(nextPath));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  useEffect(() => {
    if (!verificationToken) return;

    let cancelled = false;
    setStatus("sending");
    setError("Verificando tu email...");

    fetch(`/api/auth/email-verification?token=${encodeURIComponent(verificationToken)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("auth/invalid-action-code");
        await auth.currentUser?.reload();
        if (!cancelled) router.replace(getPostAuthDestination(nextPath));
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setError("El link de verificación no es válido o expiró. Presiona Reenviar email.");
      });

    return () => {
      cancelled = true;
    };
  }, [verificationToken, nextPath, router]);

  useEffect(() => {
    if (initialEmailStatus !== "failed" || status !== "idle") return;

    const user = auth.currentUser;
    if (!user) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStatus("sending");
      setError("Estamos reenviando el correo de verificación.");

      sendEmailVerification(user)
        .then(() => {
          if (cancelled) return;
          setStatus("sent");
          setError("Correo de verificación reenviado. Si no lo ves, revisa spam o promociones.");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("error");
          setError("No pudimos enviar el correo automáticamente. Presiona Reenviar email.");
        });
    });

    return () => {
      cancelled = true;
    };
  }, [initialEmailStatus, nextPath, status]);

  const resend = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    setStatus("sending");
    setError("");
    try {
      await sendEmailVerification(user);
      setStatus("sent");
      setError("Correo reenviado. Si no lo ves, revisa spam o promociones.");
    } catch {
      setStatus("error");
      setError("No pudimos reenviar el email. Revisa tu conexión e intenta de nuevo.");
    }
  };

  const checkVerified = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    await user.reload();
    if (user.emailVerified) {
      router.replace(getPostAuthDestination(nextPath));
    } else {
      setError("Aún no vemos tu email verificado. Revisa tu bandeja o reenvía el correo.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="flex items-center justify-between px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-50 shadow-sm backdrop-blur active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-white">Verifica tu email</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24 pt-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900">
          <MailCheck className="h-8 w-8 text-orange-400" />
        </div>
        <div className="text-lg font-semibold text-white">Revisa tu bandeja</div>
        <p className="text-sm text-neutral-300">
          Te enviamos un correo de verificación. Abre el link para activar tu cuenta. Luego presiona
          “Ya verifiqué”.
        </p>

        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={checkVerified}
            className="w-full bg-orange-400 text-black hover:bg-orange-300"
            type="button"
          >
            Ya verifiqué
          </Button>
          <Button
            onClick={resend}
            variant="outline"
            className="flex w-full items-center justify-center gap-2 border-neutral-800 text-neutral-100 hover:border-orange-400"
            type="button"
            disabled={status === "sending"}
          >
            <RefreshCw className="h-4 w-4" />
            {status === "sending" ? "Enviando..." : status === "sent" ? "Reenviado" : "Reenviar email"}
          </Button>
        </div>
      </main>
    </div>
  );
}
