"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { AppSkeleton } from "@/components/AppSkeleton";

type Stage = "request" | "reset" | "done";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

function PageFallback() {
  return <AppSkeleton variant="auth" />;
}

function ForgotPasswordContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const mode = sp.get("mode");
  const oobCode = sp.get("oobCode") || "";

  const [stage, setStage] = useState<Stage>(mode === "resetPassword" && oobCode ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    if (stage !== "reset") return;
    if (!oobCode) {
      setError("El enlace de recuperación es inválido.");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((foundEmail) => {
        if (!mounted) return;
        setEmail(foundEmail || "");
      })
      .catch(() => {
        if (!mounted) return;
        setError("El enlace expiró o no es válido. Solicita uno nuevo.");
      });

    return () => {
      mounted = false;
    };
  }, [oobCode, stage]);

  const requestReset = async () => {
    setError("");
    setNotice("");

    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setError("Ingresa un email válido.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, trimmed);
      setNotice("Enviamos un correo con instrucciones para restablecer tu contraseña.");
    } catch {
      setError("No se pudo enviar el correo. Verifica el email e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const applyReset = async () => {
    setError("");
    setNotice("");

    if (newPass.trim().length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPass !== confirmPass) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, newPass.trim());
      setStage("done");
      setNotice("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
    } catch {
      setError("No se pudo actualizar la contraseña. Solicita un enlace nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="mx-auto flex w-full max-w-md items-center px-4 pb-2 pt-5">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-100"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="mx-auto pr-10 text-sm font-semibold text-neutral-100">JOSEALO</div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-12 pt-4">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5">
          {stage === "request" && (
            <>
              <IconWrap>
                <KeyRound className="h-5 w-5 text-orange-400" />
              </IconWrap>
              <h1 className="mt-4 text-3xl font-semibold leading-tight">Forgot Your Password</h1>
              <p className="mt-2 text-sm text-neutral-400">Enter your account email and continue.</p>

              <div className="mt-6">
                <label className="text-xs text-neutral-500">Email</label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
                  <Mail className="h-4 w-4 text-neutral-500" />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
                    type="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <button
                onClick={requestReset}
                disabled={loading}
                className="mt-6 h-12 w-full rounded-2xl bg-orange-400 text-sm font-semibold text-black hover:bg-orange-300 disabled:opacity-60"
              >
                {loading ? "Sending..." : notice ? "Resend Link" : "Submit Now"}
              </button>

              <Link
                href="/sign-in"
                className="mt-4 inline-flex items-center justify-center gap-2 text-sm text-neutral-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                back to login
              </Link>
            </>
          )}

          {stage === "reset" && (
            <>
              <IconWrap>
                <ShieldCheck className="h-5 w-5 text-orange-400" />
              </IconWrap>
              <h1 className="mt-4 text-3xl font-semibold leading-tight">Reset Password</h1>
              <p className="mt-2 text-sm text-neutral-400">Set your new password to continue.</p>

              <div className="mt-6 space-y-3">
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter your new password"
                  className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm outline-none placeholder:text-neutral-500 focus:border-orange-400"
                />
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm your password"
                  className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm outline-none placeholder:text-neutral-500 focus:border-orange-400"
                />
              </div>

              <button
                onClick={applyReset}
                disabled={loading}
                className="mt-6 h-12 w-full rounded-2xl bg-orange-400 text-sm font-semibold text-black hover:bg-orange-300 disabled:opacity-60"
              >
                {loading ? "Updating..." : "Continue"}
              </button>

              <button
                onClick={() => router.push("/sign-in")}
                className="mt-3 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 text-sm font-medium text-neutral-100 hover:border-orange-400"
              >
                Cancel
              </button>
            </>
          )}

          {stage === "done" && (
            <>
              <IconWrap>
                <ShieldCheck className="h-5 w-5 text-orange-400" />
              </IconWrap>
              <h1 className="mt-4 text-3xl font-semibold leading-tight">Password Updated</h1>
              <p className="mt-2 text-sm text-neutral-400">You can now sign in with your new password.</p>

              <button
                onClick={() => router.push("/sign-in")}
                className="mt-6 h-12 w-full rounded-2xl bg-orange-400 text-sm font-semibold text-black hover:bg-orange-300"
              >
                Go to Sign In
              </button>
            </>
          )}

          {(error || notice) && (
            <div
              className={[
                "mt-5 rounded-xl border p-3 text-sm",
                error
                  ? "border-red-900/40 bg-red-950/30 text-red-200"
                  : "border-emerald-900/40 bg-emerald-950/30 text-emerald-200",
              ].join(" ")}
            >
              {error || notice}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950">
      {children}
    </div>
  );
}
