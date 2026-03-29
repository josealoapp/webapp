import Link from "next/link";
import { Search } from "lucide-react";

type NavbarTab = "para-ti" | "cerca-de-ti";

export default function Navbar({ activeTab = "para-ti" }: { activeTab?: NavbarTab }) {
  const tabClass = (tab: NavbarTab) =>
    tab === activeTab
      ? "rounded-3xl border border-orange-400/80 px-5 py-2 text-orange-400 shadow-[0_0_0_1px_rgba(255,184,79,0.25)]"
      : "rounded-2xl px-2 py-2 text-neutral-300 hover:text-white";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center gap-6 px-4 pt-4 text-base font-semibold sm:text-sm">
        <div className="flex flex-1 items-center justify-center gap-1">
          <Link href="/descubre" className={tabClass("para-ti")}>
            Para Ti
          </Link>
          <Link href="/descubre/cerca-de-ti" className={tabClass("cerca-de-ti")}>
            Cerca de ti
          </Link>
        </div>
        <button
          className="ml-auto flex h-10 w-10 items-center justify-center text-neutral-300 hover:text-white"
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
