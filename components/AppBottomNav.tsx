"use client";

import Link from "next/link";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";

type AppBottomNavTab = "home" | "discover" | "create" | "messages" | "profile";

export default function AppBottomNav({ active }: { active: AppBottomNavTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
        <NavIcon icon={Home} label="Inicio" href="/" active={active === "home"} />
        <NavIcon icon={Navigation} label="Descubre" href="/descubre" active={active === "discover"} />
        <NavIcon icon={PlusSquare} label="Crear" href="/item/new" active={active === "create"} />
        <NavIcon icon={MessageCircle} label="Negociacion" href="/messages" active={active === "messages"} />
        <NavIcon icon={User} label="Perfil" href="/profile/me" active={active === "profile"} />
      </div>
    </nav>
  );
}

function NavIcon({
  icon: Icon,
  label,
  href,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1 hover:text-white",
    active ? "text-orange-400" : "text-neutral-400",
  ].join(" ");

  return (
    <Link href={href} className={className} aria-label={label}>
      <Icon className="h-5 w-5" />
      <span className="hidden text-[11px] sm:inline">{label}</span>
    </Link>
  );
}
