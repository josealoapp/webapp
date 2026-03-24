"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  MapPin,
  LifeBuoy,
  MessageSquare,
  LogOut,
  ChevronRight,
  Power,
  SunMoon,
  UserRoundCog,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getPostAuthDestination } from "@/lib/account-profile";

type Item = {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
  href?: string;
};

const security: Item[] = [
  { title: "Cambiar contraseña", subtitle: "Actualiza tu password", icon: Shield, href: "/settings/password" },
  { title: "Ubicación", subtitle: "Administra tu ciudad o zona", icon: MapPin, href: "/settings/location" },
];

const support: Item[] = [
  { title: "Ayuda", subtitle: "Centro de soporte y FAQs", icon: LifeBuoy, href: "/settings/help" },
  { title: "Feedback", subtitle: "Envíanos tus comentarios", icon: MessageSquare, href: "/settings/feedback" },
];

const danger: Item[] = [
  { title: "Estado de cuenta", subtitle: "Hibernar o eliminar cuenta", icon: Power, href: "/settings/account-status" },
];

const appearance: Item[] = [{ title: "Apariencia", subtitle: "Claro u oscuro", icon: SunMoon, href: "/settings/appearance" }];
const accountPreferences: Item[] = [
  { title: "Tipo de cuenta", subtitle: "Personal o empresarial", icon: UserRoundCog, href: "/settings/account-type" },
];

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/settings");
        if (destination !== "/settings") {
          router.replace(destination);
        }
      }
    });

    return () => unsub();
  }, [router]);

  const renderItem = (item: Item) => (
    <button
      key={item.title}
      className={[
        "flex w-full items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300",
        item.tone === "danger" ? "hover:border-red-500" : "",
      ].join(" ")}
      onClick={() => {
        if (item.href) router.push(item.href);
      }}
    >
      <div
        className={[
          "flex h-11 w-11 items-center justify-center rounded-xl",
          item.tone === "danger" ? "bg-red-500/10 text-red-300" : "bg-neutral-800 text-neutral-200",
        ].join(" ")}
      >
        <item.icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className={["text-sm font-semibold", item.tone === "danger" ? "text-red-300" : "text-neutral-100"].join(" ")}>
          {item.title}
        </div>
        {item.subtitle ? (
          <div className="text-xs text-neutral-400">{item.subtitle}</div>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-500" />
    </button>
  );

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
        <div className="text-sm font-semibold text-white">Ajustes</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-24">
        <section className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Seguridad</div>
          {security.map(renderItem)}
        </section>

        <section className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Soporte</div>
          {support.map(renderItem)}
        </section>

        <section className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Preferencias</div>
          {accountPreferences.map(renderItem)}
          {appearance.map(renderItem)}
        </section>

        <section className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Cuenta</div>
          {danger.map(renderItem)}
          <button
            className="flex w-full items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left text-sm font-semibold text-neutral-100 transition hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch {
                // ignore errors to still clear client state
              }
              try {
                localStorage.removeItem("auth_user");
              } catch {
                // ignore
              }
              router.replace("/sign-in");
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-800 text-neutral-200">
              <LogOut className="h-5 w-5" />
            </div>
            <span className="flex-1">Cerrar sesión</span>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </button>
        </section>
      </main>
    </div>
  );
}
