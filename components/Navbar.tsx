import { Search } from "lucide-react";

export default function Navbar() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center gap-6 px-4 pt-4 text-base font-semibold sm:text-sm">
        <div className="flex flex-1 items-center justify-center gap-1">
          <button className="rounded-3xl border border-orange-400/80 px-5 py-2 text-orange-400 shadow-[0_0_0_1px_rgba(255,184,79,0.25)]">
            Para Ti
          </button>
          <button className="rounded-2xl px-2 py-2 text-neutral-300 hover:text-white">
            Tendencias
          </button>
          <button className="rounded-2xl px-2 py-2 text-neutral-300 hover:text-white">
            Cerca
          </button>
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
