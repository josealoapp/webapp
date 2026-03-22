import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { Heart, Home, MessageCircle, Navigation, PlusSquare, ShoppingBag, User } from "lucide-react";

const trendItems = [
  {
    id: "tr1",
    title: "Fresh Fruits & Vegetables",
    price: 700,
    image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "tr2",
    title: "Bakery & Pastries",
    price: 700,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "tr3",
    title: "Meat & Fish",
    price: 700,
    image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "tr4",
    title: "Cooking Oil & Ghee",
    price: 700,
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "tr5",
    title: "Apple & Grapes Juice",
    price: 700,
    image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "tr6",
    title: "Chicken Egg Red",
    price: 700,
    image: "https://images.unsplash.com/photo-1569288063643-c04c278cd144?auto=format&fit=crop&w=1000&q=80",
  },
];

export default function TrendsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar activeTab="tendencias" />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-24">
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          {trendItems.map((item, index) => (
            <article
              key={item.id}
              className={[
                "relative isolate overflow-hidden rounded-[26px] border border-neutral-700/80",
                "h-[270px] sm:h-[320px]",
                index % 2 === 1 ? "mt-8 sm:mt-10" : "",
              ].join(" ")}
            >
              <Image src={item.image} alt={item.title} fill className="object-cover" sizes="(max-width: 640px) 45vw, 22vw" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/30" />

              <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="max-w-[75%] text-lg font-semibold leading-6 text-white drop-shadow-md">
                    {item.title}
                  </h2>
                  <button
                    aria-label={`Marcar ${item.title} como favorito`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/70 bg-neutral-950/50 text-orange-400 backdrop-blur"
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-full border border-white/20 bg-neutral-950/65 px-3 py-2 backdrop-blur">
                  <span className="text-[16px] leading-none text-white">$07.00</span>
                  <button
                    aria-label={`Agregar ${item.title} al carrito`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-black"
                  >
                    <ShoppingBag className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
          <NavIcon icon={Home} label="Inicio" href="/" />
          <NavIcon icon={Navigation} label="Descubre" href="/descubre" active />
          <NavIcon icon={PlusSquare} label="Crear" href="/item/new" />
          <NavIcon icon={MessageCircle} label="Negociacion" href="/messages" />
          <NavIcon icon={User} label="Perfil" href="/profile/me" />
        </div>
      </nav>
    </div>
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
  href?: string;
  active?: boolean;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1 hover:text-white",
    active ? "text-orange-400" : "text-neutral-400",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        <Icon className="h-5 w-5" />
        <span className="hidden text-[11px] sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button className={className} aria-label={label}>
      <Icon className="h-5 w-5" />
      <span className="hidden text-[11px] sm:inline">{label}</span>
    </button>
  );
}
