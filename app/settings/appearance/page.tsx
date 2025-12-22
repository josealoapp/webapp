"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useThemeSetting } from "@/components/ThemeProvider";

export default function AppearancePage() {
  const router = useRouter();
  const { theme, setTheme } = useThemeSetting();

  const options: { id: "light" | "dark"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "light", label: "Modo claro", icon: Sun },
    { id: "dark", label: "Modo oscuro", icon: Moon },
  ];

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
        <div className="text-sm font-semibold text-white">Apariencia</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs text-neutral-300">
          Elige entre modo claro u oscuro. Tu preferencia aplica a todo el sitio.
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={[
                "flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300",
                theme === opt.id
                  ? "border-orange-400 bg-orange-500/10 text-orange-200"
                  : "border-neutral-800 bg-neutral-900 text-neutral-200 hover:border-orange-400 hover:text-white",
              ].join(" ")}
              aria-pressed={theme === opt.id}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800">
                <opt.icon className="h-6 w-6" />
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
