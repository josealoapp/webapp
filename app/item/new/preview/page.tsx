"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

export default function NewListingPreviewPage() {
  const router = useRouter();
  const search = useSearchParams();

  const data = useMemo(() => {
    const priceValue = Number(search.get("price") ?? "");
    const rawTags = (search.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
    return {
      title: search.get("title") || "",
      price: priceValue,
      category: search.get("category") || "",
      description: search.get("description") || "",
      tags: rawTags,
      paymentMethod: search.get("paymentMethod") || "",
      isPriceValid: Number.isFinite(priceValue) && priceValue > 0,
    };
  }, [search]);

  const hasAny = data.title || data.category || data.description;

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
        <div className="text-sm font-semibold text-white">Preview</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-28">
        {!data.isPriceValid && (
          <div className="flex items-start gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
            <div className="mt-0.5 rounded-full bg-orange-500/20 p-2 text-orange-200">
              <Info className="h-4 w-4" />
            </div>
            <p className="leading-6">
              El precio es obligatorio y debe ser mayor a 0. Vuelve y corrige el formulario.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Resumen</div>
          <div className="mt-2 text-lg font-semibold text-white">{data.title || "Sin título"}</div>
          <div className="mt-1 text-orange-400">
            {data.isPriceValid ? `RD$${data.price.toLocaleString()}` : "Precio inválido"}
          </div>
          <div className="mt-2 text-sm text-neutral-300">
            {data.category || "Sin categoría"} · {data.description ? "Con descripción" : "Sin descripción"}
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            {data.tags?.length ? `Tags: ${data.tags.join(", ")}` : "Sin tags"}
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            {data.paymentMethod ? `Método de pago: ${data.paymentMethod}` : "Método de pago pendiente"}
          </div>
        </div>

        {!hasAny && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            Completa los campos para ver un preview más detallado.
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto max-w-md px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-12 flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={!data.isPriceValid}
              className={[
                "h-12 flex-1 rounded-2xl px-4 text-sm font-semibold text-black shadow focus:outline-none focus:ring-2 focus:ring-orange-300",
                data.isPriceValid ? "bg-orange-400 hover:bg-orange-300" : "bg-neutral-700 text-neutral-300",
              ].join(" ")}
              onClick={() => {
                if (!data.isPriceValid) return;
                router.push("/");
              }}
            >
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
