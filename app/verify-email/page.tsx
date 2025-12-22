"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { sendEmailVerification } from "firebase/auth";
import { ArrowLeft, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const VERIFY_CONTINUE_URL =
  process.env.NEXT_PUBLIC_VERIFY_CONTINUE_URL || "http://localhost:3000/messages";

export default function VerifyEmailPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/messages", [sp]);

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/sign-in");
      return;
    }

    if (user.emailVerified) {
      router.replace(nextPath);
    }
  }, [router, nextPath]);

  const resend = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      await sendEmailVerification(user, {
        url: VERIFY_CONTINUE_URL,
      });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError("No pudimos reenviar el email. Intenta de nuevo.");
    }
  };

  const checkVerified = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    await user.reload();
    if (user.emailVerified) {
      router.replace(nextPath);
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
