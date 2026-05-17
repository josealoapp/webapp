"use client";

import Link from "next/link";
import { BarChart3, Home, ShieldUser, Users } from "lucide-react";

export default function AdminBottomNav({ active }: { active: "home" | "users" | "stats" | "profile" }) {
  const items = [
    { id: "home", label: "Home", href: "/admin", icon: Home },
    { id: "users", label: "Users", href: "/admin/users", icon: Users },
    { id: "stats", label: "Stats", href: "/admin/stats", icon: BarChart3 },
    { id: "profile", label: "Profile", href: "/admin/profile", icon: ShieldUser },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-4 py-3 text-xs">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={[
              "flex flex-col items-center gap-1 rounded-xl px-3 py-1",
              active === item.id ? "text-orange-400" : "text-neutral-400 hover:text-white",
            ].join(" ")}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
