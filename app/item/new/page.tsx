"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ImagePlus, Info } from "lucide-react";

const categories = ["Electrónicos", "Hogar", "Belleza", "Ropa", "Zapatos", "Accesorios"];

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "intercambio" | "ambas">("efectivo");
  const [priceError, setPriceError] = useState<string | null>(null);

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
        <div className="text-sm font-semibold text-white">Nueva publicación</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-32">
        <button className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-300 shadow-sm hover:border-orange-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
          <ImagePlus className="h-7 w-7" />
          <div className="text-sm font-semibold">Agregar fotos</div>
          <div className="text-[11px] text-neutral-400">Máx 10 fotos</div>
        </button>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-[13px] text-neutral-300">
          Fotos: 0/10 · Solo fotos. Elige la portada primero para destacarla.
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-blue-900/20 px-4 py-3 text-sm text-neutral-100">
          <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-blue-300">
            <Info className="h-4 w-4" />
          </div>
          <p className="leading-6 text-neutral-200">
            Usa buena iluminación, fondo limpio y toma varias fotos en diferentes ángulos.
          </p>
        </div>

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Título</span>
            <input
              type="text"
              placeholder="Ej. iPhone 13 128GB en buen estado"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Precio</span>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm focus-within:border-orange-400">
              <span className="text-neutral-500">RD$</span>
              <input
                type="number"
                placeholder="0"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceError(null);
                }}
                className="h-12 flex-1 bg-transparent text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
            {priceError ? <span className="text-xs text-orange-400">{priceError}</span> : null}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Método de pago</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "efectivo", label: "Efectivo" },
                { id: "intercambio", label: "Intercambio" },
                { id: "ambas", label: "Ambas" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id as typeof paymentMethod)}
                  className={[
                    "h-11 rounded-2xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300",
                    paymentMethod === opt.id
                      ? "border-orange-400 text-orange-400"
                      : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-orange-400 hover:text-white",
                  ].join(" ")}
                  aria-pressed={paymentMethod === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Categoría</span>
            <div className="relative">
              <select
                className="h-12 w-full appearance-none rounded-2xl border border-neutral-800 bg-neutral-900 px-4 pr-10 text-sm text-neutral-100 focus:border-orange-400 focus:outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Descripción</span>
            <textarea
              rows={4}
              placeholder="Cuenta detalles clave, estado, accesorios incluidos y ubicación."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Tags (separados por coma)</span>
            <input
              type="text"
              placeholder="Ej. nuevo, original, con caja"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
            <span className="text-[11px] text-neutral-500">Ejemplo: \"nuevo, original, con garantía\"</span>
          </label>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto max-w-md px-6 py-4">
          <button
            type="button"
            className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
            onClick={() => {
              const numericPrice = Number(price);
              if (!numericPrice || numericPrice <= 0) {
                setPriceError("El precio debe ser mayor a 0.");
                return;
              }
              setPriceError(null);
              const params = new URLSearchParams({
                title: title.trim(),
                price: numericPrice.toString(),
                category: category.trim(),
                description: description.trim(),
                tags: tags.trim(),
                paymentMethod,
              });
              router.push(`/item/new/preview?${params.toString()}`);
            }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
