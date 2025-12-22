"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, PauseCircle, Trash2, ChevronRight } from "lucide-react";

type Option = {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
};

const options: Option[] = [
  {
    title: "Hibernar cuenta",
    subtitle: "Pausa tu perfil temporalmente. Podrás reactivarlo cuando quieras.",
    icon: PauseCircle,
  },
  {
    title: "Eliminar cuenta",
    subtitle: "Borra todos tus datos y publicaciones de forma permanente.",
    icon: Trash2,
    tone: "danger",
  },
];

export default function AccountStatusPage() {
  const router = useRouter();

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
        <div className="text-sm font-semibold text-white">Estado de cuenta</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        {options.map((opt) => (
          <button
            key={opt.title}
            className={[
              "flex w-full items-center gap-3 rounded-2xl border bg-neutral-900 px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-orange-300",
              opt.tone === "danger"
                ? "border-red-500/50 hover:border-red-400"
                : "border-neutral-800 hover:border-orange-400",
            ].join(" ")}
            onClick={() => {}}
          >
            <div
              className={[
                "flex h-11 w-11 items-center justify-center rounded-xl",
                opt.tone === "danger" ? "bg-red-500/10 text-red-300" : "bg-neutral-800 text-neutral-200",
              ].join(" ")}
            >
              <opt.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className={["text-sm font-semibold", opt.tone === "danger" ? "text-red-300" : "text-neutral-100"].join(" ")}>
                {opt.title}
              </div>
              <div className="text-xs text-neutral-400">{opt.subtitle}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </button>
        ))}
      </main>
    </div>
  );
}
