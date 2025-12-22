"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

export default function PasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

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
        <div className="text-sm font-semibold text-white">Cambiar contraseña</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs text-neutral-300">
          Usa una contraseña segura y no la compartas con nadie.
        </div>

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Contraseña actual</span>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 focus-within:border-orange-400">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Tu contraseña actual"
                className="h-12 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Nueva contraseña</span>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 focus-within:border-orange-400">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Crea una nueva contraseña"
                className="h-12 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Repetir contraseña</span>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 focus-within:border-orange-400">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
                className="h-12 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          </label>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto max-w-md px-6 py-4">
          <button
            type="button"
            className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
