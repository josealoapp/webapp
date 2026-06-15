"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { useThemeSetting } from "@/components/ThemeProvider";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination } from "@/lib/account-profile";
import {
  normalizeInstagramUsername,
  subscribeInstagramUsername,
  writeInstagramUsername,
} from "@/lib/user-instagram";

export default function InstagramSettingsPage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const isLight = theme === "light";
  const [currentUserId, setCurrentUserId] = useState("");
  const [username, setUsername] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/settings/instagram");
        if (destination !== "/settings/instagram") {
          router.replace(destination);
          return;
        }
      }

      setCurrentUserId(user?.uid ?? "");
      setLoaded(true);
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!currentUserId) {
      setUsername("");
      return;
    }

    const unsub = subscribeInstagramUsername(currentUserId, (value) => {
      setUsername(value);
    });

    return () => unsub();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId || saving) return;

    const normalized = normalizeInstagramUsername(username);

    if (!normalized) {
      setError("Agrega un usuario de Instagram válido.");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await writeInstagramUsername(currentUserId, normalized);
      setUsername(normalized);
      setSuccess("Usuario de Instagram actualizado.");
    } catch {
      setError("No pudimos guardar tu usuario de Instagram.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
  }

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
        <div className="text-sm font-semibold text-white">Agregar instagram</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        <div
          className={[
            "rounded-3xl border p-5",
            isLight ? "border-slate-200 bg-transparent" : "border-neutral-800 bg-neutral-900/60",
          ].join(" ")}
        >
          <div className={["text-lg font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>
            Conecta tu perfil de Instagram
          </div>
          <p className={["mt-2 text-sm", isLight ? "text-slate-600" : "text-neutral-400"].join(" ")}>
            Cuando lo configures, otros usuarios verán el botón de Instagram en tu perfil.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-neutral-100">Usuario de Instagram</span>
          <input
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError("");
              setSuccess("");
            }}
            placeholder="Ej. josealo"
            className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-2 h-12 rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </main>
    </div>
  );
}
