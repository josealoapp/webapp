"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, ChevronDown, ImagePlus, Info } from "lucide-react";
import { auth } from "@/lib/firebase";
import { uploadListingImages } from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";

const categories = ["Electrónicos", "Hogar", "Belleza", "Ropa", "Zapatos", "Accesorios"];

export default function NewListingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "intercambio" | "transferencia">("efectivo");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const paymentOptions: Array<{ id: typeof paymentMethod; label: string }> = [
    { id: "efectivo", label: "Efectivo" },
    { id: "intercambio", label: "Intercambio" },
    { id: "transferencia", label: "Transferencia" },
  ];

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/item/new");
        if (destination !== "/item/new") {
          router.replace(destination);
        }
      }
    });

    return () => unsub();
  }, [router]);

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const current = selectedFiles.length;
    const remaining = Math.max(0, 10 - current);
    const next = incoming.slice(0, remaining);
    setSelectedFiles((prev) => [...prev, ...next]);
    setPhotoError(null);
    e.currentTarget.value = "";
  };

  const removePhoto = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
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
        <div className="text-sm font-semibold text-white">Nueva publicación</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-32">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesChange}
        />

        <button
          type="button"
          onClick={handlePickFiles}
          className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-300 shadow-sm hover:border-orange-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <ImagePlus className="h-7 w-7" />
          <div className="text-sm font-semibold">Agregar fotos</div>
          <div className="text-[11px] text-neutral-400">Máx 10 fotos</div>
        </button>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-[13px] text-neutral-300">
          Fotos: {selectedFiles.length}/10 · Solo fotos. Las convertimos a WebP y reducimos tamano automaticamente.
        </div>

        {previewUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previewUrls.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-800">
                <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                  aria-label="Eliminar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-blue-900/20 px-4 py-3 text-sm text-neutral-100">
          <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-blue-300">
            <Info className="h-4 w-4" />
          </div>
          <p className="leading-6 text-neutral-200">
            Usa buena iluminacion, fondo limpio y toma varias fotos en diferentes angulos.
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
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id)}
                  className={[
                    "h-11 shrink-0 whitespace-nowrap rounded-2xl border px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300",
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
            <span className="text-[11px] text-neutral-500">Ejemplo: &quot;nuevo, original, con garantía&quot;</span>
          </label>
        </form>

        {photoError ? <span className="text-xs text-orange-400">{photoError}</span> : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto max-w-md px-6 py-4">
          <button
            type="button"
            className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
            onClick={async () => {
              const numericPrice = Number(price);
              if (!numericPrice || numericPrice <= 0) {
                setPriceError("El precio debe ser mayor a 0.");
                return;
              }
              if (selectedFiles.length === 0) {
                setPhotoError("Agrega al menos una foto para publicar.");
                return;
              }

              const user = auth.currentUser;
              if (!user) {
                router.push(`/sign-in?next=${encodeURIComponent("/item/new")}`);
                return;
              }
              if (user.emailVerified) {
                const destination = getPostAuthDestination("/item/new");
                if (destination !== "/item/new") {
                  router.push(destination);
                  return;
                }
              }

              setUploading(true);
              setPriceError(null);
              setPhotoError(null);
              try {
                const urls = await uploadListingImages(selectedFiles);
                const params = new URLSearchParams({
                  title: title.trim(),
                  price: numericPrice.toString(),
                  category: category.trim(),
                  description: description.trim(),
                  tags: tags.trim(),
                  paymentMethod,
                  imageUrl: urls[0] || "",
                });
                router.push(`/item/new/preview?${params.toString()}`);
              } catch (err: unknown) {
                const code =
                  typeof err === "object" && err !== null && "code" in err
                    ? String((err as { code?: string }).code)
                    : typeof err === "object" && err !== null && "message" in err
                      ? String((err as { message?: string }).message)
                      : "";

                if (code.includes("upload/invalid-size")) {
                  setPhotoError("Cada foto debe pesar menos de 10 MB.");
                } else if (code.includes("upload/invalid-type")) {
                  setPhotoError("Solo puedes subir archivos de imagen.");
                } else if (code.includes("Missing required env var")) {
                  setPhotoError("Falta configurar AWS S3 en las variables del servidor.");
                } else if (code.includes("presign") || code.includes("put-failed")) {
                  setPhotoError("No se pudieron subir las fotos a AWS S3. Revisa la configuración del bucket.");
                } else if (code.includes("image-load-failed") || code.includes("webp-conversion-failed")) {
                  setPhotoError("No pudimos optimizar una foto antes de subirla. Intenta con otra imagen.");
                } else if (code.includes("timeout") || code.includes("canceled")) {
                  setPhotoError("La subida tardó demasiado. Intenta con una foto más liviana o mejor conexión.");
                } else {
                  setPhotoError("No se pudieron subir las fotos. Verifica AWS S3 e intenta de nuevo.");
                }
              } finally {
                setUploading(false);
              }
            }}
            disabled={uploading}
          >
            {uploading ? "Subiendo fotos..." : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
