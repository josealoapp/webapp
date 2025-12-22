import Link from "next/link";
import HomeHeader from "@/components/HomeHeader";
import HomeHero from "@/components/HomeHero";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";

const flashDeals = [
  {
    id: "fd1",
    title: "Set de skincare",
    price: 1200,
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "fd2",
    title: "Polos básicos",
    price: 950,
    image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "fd3",
    title: "Organizador viaje",
    price: 650,
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "fd4",
    title: "Audífonos",
    price: 1400,
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  },
];

const curated = [
  {
    id: "c1",
    title: "Outfits de verano",
    subtitle: "Shop ahora",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80",
    price: 2300,
  },
  {
    id: "c2",
    title: "Deportes y sneakers",
    subtitle: "Corre y entrena",
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80",
    price: 2800,
  },
  {
    id: "c3",
    title: "Tecnología",
    subtitle: "Hasta 40% off",
    image: "https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?auto=format&fit=crop&w=600&q=80",
    price: 5300,
  },
  {
    id: "c4",
    title: "Accesorios",
    subtitle: "Top picks",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
    price: 1200,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <HomeHeader />

      <div className="pt-28">
        <HomeHero />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-5">
        {/* Super deals */}
        <section className="rounded-[22px] p-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
            <span>En Caliente</span>
            <Link href="/descubre" className="text-xs text-orange-400 hover:text-orange-200">
              Ver más
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {flashDeals.map((deal) => (
              <div
                key={deal.id}
                className="min-w-[140px] max-w-[160px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 shadow-sm"
              >
                <div className="relative mb-2 h-28 w-full overflow-hidden rounded-[18px]">
                  <img src={deal.image} alt={deal.title} className="h-full w-full object-cover" />
                </div>
                <div className="text-xs text-neutral-300 line-clamp-2">{deal.title}</div>
                <div className="mt-1 text-sm font-semibold text-orange-400">
                  RD${deal.price.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Super deals 2 */}
        <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-100">
            <span>Super Ofertas</span>
            <Link href="/descubre" className="text-xs text-orange-400 hover:text-orange-200">
              Ver más
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {flashDeals.map((deal) => (
              <div
                key={`fd2-${deal.id}`}
                className="min-w-[140px] max-w-[160px] rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-2 shadow-sm"
              >
                <div className="relative mb-2 h-28 w-full overflow-hidden rounded-[18px]">
                  <img src={deal.image} alt={deal.title} className="h-full w-full object-cover" />
                </div>
                <div className="text-xs text-neutral-300 line-clamp-2">{deal.title}</div>
                <div className="mt-1 text-sm font-semibold text-orange-400">
                  RD${deal.price.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Curated */}
        <section className="rounded-[22px] border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {curated.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-neutral-800 bg-neutral-950/80 p-3 shadow-sm"
              >
                <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-[18px]">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="mt-2 text-sm font-semibold text-orange-400">
                  RD${item.price.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
          <NavIcon icon={Home} label="Inicio" href="/" active />
          <NavIcon icon={Navigation} label="Descubre" href="/descubre" />
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
        <span className="text-[11px] hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button className={className} aria-label={label}>
      <Icon className="h-5 w-5" />
      <span className="text-[11px] hidden sm:inline">{label}</span>
    </button>
  );
}
