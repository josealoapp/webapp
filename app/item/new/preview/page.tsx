"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createListing } from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";
import { AppSkeleton } from "@/components/AppSkeleton";

export default function NewListingPreviewPage() {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <NewListingPreviewContent />
    </Suspense>
  );
}

function PreviewFallback() {
  return <AppSkeleton variant="detail" />;
}

function NewListingPreviewContent() {
  const router = useRouter();
  const search = useSearchParams();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const previewPath = useMemo(() => {
    const query = search.toString();
    return query ? `/item/new/preview?${query}` : "/item/new/preview";
  }, [search]);

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
      imageUrl: search.get("imageUrl") || "",
      isPriceValid: Number.isFinite(priceValue) && priceValue > 0,
    };
  }, [search]);

  const hasAny = data.title || data.category || data.description;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination(previewPath);
        if (destination !== previewPath) {
          router.replace(destination);
        }
      }
    });

    return () => unsub();
  }, [previewPath, router]);

  const handlePublish = async () => {
    if (!data.isPriceValid || publishing) return;

    const user = auth.currentUser;
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent(previewPath)}`);
      return;
    }
    if (user.emailVerified) {
      const destination = getPostAuthDestination(previewPath);
      if (destination !== previewPath) {
        router.push(destination);
        return;
      }
    }

    setPublishing(true);
    setPublishError("");
    try {
      await createListing({
        ownerId: user.uid,
        ownerName: user.displayName || user.email || "Vendedor",
        type: "article",
        title: data.title || "Sin título",
        price: data.price,
        category: data.category || "General",
        description: data.description || "Sin descripción",
        tags: data.tags,
        paymentMethod:
          data.paymentMethod === "intercambio" || data.paymentMethod === "transferencia"
            ? data.paymentMethod
            : "efectivo",
        location: "Santo Domingo",
        image:
          data.imageUrl ||
          "https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=1200&q=80",
        bazarItems: [],
      });
      router.push("/");
    } catch {
      setPublishError("No pudimos publicar en este momento. Intenta de nuevo.");
    } finally {
      setPublishing(false);
    }
  };

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
        <div className="text-sm font-semibold text-white">Preview artículo</div>
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
          {data.imageUrl && (
            <div className="mt-3 h-36 w-full overflow-hidden rounded-xl border border-neutral-800">
              <img src={data.imageUrl} alt={data.title || "Preview"} className="h-full w-full object-cover" />
            </div>
          )}
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

        {publishError && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
            {publishError}
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
                data.isPriceValid && !publishing
                  ? "bg-orange-400 hover:bg-orange-300"
                  : "bg-neutral-700 text-neutral-300",
              ].join(" ")}
              onClick={handlePublish}
            >
              {publishing ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
