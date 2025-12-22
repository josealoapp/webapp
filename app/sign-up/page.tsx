"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SignUpPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/messages", [sp]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    const trimmedConfirm = confirm.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPass || !trimmedConfirm) {
      setError("Completa todos los campos.");
      setLoading(false);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Ingresa un email válido (ej: luis@gmail.com).");
      setLoading(false);
      return;
    }

    if (trimmedPass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    if (trimmedPass !== trimmedConfirm) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPass);
      if (cred.user && trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName });
      }

      try {
        localStorage.setItem(
          "auth_user",
          JSON.stringify({
            uid: cred.user?.uid,
            email: cred.user?.email,
            name: cred.user?.displayName || trimmedName,
            signedInAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      router.replace(`/verify-email?next=${encodeURIComponent(nextPath)}`);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === "auth/email-already-in-use") {
        setError("Ese email ya está en uso. Intenta iniciar sesión.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña es muy débil. Usa 6+ caracteres.");
      } else {
        setError("No pudimos crear la cuenta. Intenta de nuevo.");
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
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription className="text-neutral-400">
              Regístrate para publicar y chatear con vendedores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="border-neutral-800 bg-neutral-950"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Repetir contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="border-neutral-800 bg-neutral-950"
                  autoComplete="new-password"
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
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link href="/sign-in" className="text-neutral-300 hover:text-white underline underline-offset-4">
                  ¿Ya tienes cuenta? Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
