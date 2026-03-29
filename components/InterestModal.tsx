"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { createOffer } from "@/lib/marketplace";

type Method = "cash" | "trade" | "cash_trade";

export default function InterestModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: {
    id: string;
    title: string;
    price: number;
    sellerId?: string;
    sellerName?: string;
    sellerMaxDiscountPercent: number;
  };
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("cash");
  const [cashOffer, setCashOffer] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minAccepted = useMemo(() => {
    const min = item.price * (1 - item.sellerMaxDiscountPercent / 100);
    return Math.ceil(min);
  }, [item.price, item.sellerMaxDiscountPercent]);

  if (!open) return null;

  const handleContinue = async () => {
    setError("");

    if (!item.sellerId || !item.sellerName) {
      setError("No pudimos identificar al vendedor de esta publicación.");
      return;
    }

    if (method === "cash" || method === "cash_trade") {
      const offer = Number(cashOffer);
      if (!offer || Number.isNaN(offer)) {
        setError("Escribe un monto válido en efectivo.");
        return;
      }
      if (offer < minAccepted) {
        setError(
          `El vendedor no acepta menos de RD$${minAccepted.toLocaleString()} (máx. ${item.sellerMaxDiscountPercent}% menos del precio).`
        );
        return;
      }

      const msg = `Hola, estoy interesado en tu ${item.title}. Te ofrezco RD$${offer.toLocaleString()} en efectivo. Me gustaría saber más detalles del producto.`;

      const user = auth.currentUser;
      if (user?.uid) {
        if (item.sellerId && user.uid === item.sellerId) {
          setError("No puedes enviarte una oferta a tu propia publicación.");
          return;
        }

        try {
          setSubmitting(true);
          const chatId = await createOffer({
            listingId: item.id,
            listingTitle: item.title,
            listingPrice: item.price,
            sellerId: item.sellerId,
            sellerName: item.sellerName,
            message: msg,
          });

          onClose();
          router.push(`/chat/${chatId}`);
          return;
        } catch (err: unknown) {
          console.error("offer-submit-debug", {
            buyerUid: user.uid,
            sellerId: item.sellerId,
            listingId: item.id,
          });
          const code =
            typeof err === "object" && err !== null && "code" in err
              ? String((err as { code?: string }).code)
              : "";

          console.error("offer-submit-failed", err);

          if (code === "permission-denied") {
            setError(
              "Firebase rechazó esta oferta por permisos. Si estás probando tu propia publicación, usa otra cuenta."
            );
          } else if (code === "offer/self-offer") {
            setError("No puedes enviarte una oferta a tu propia publicación.");
          } else if (code === "auth/missing-token") {
            setError("Tu sesión no está lista. Entra de nuevo e intenta otra vez.");
          } else if (code === "unauthenticated") {
            setError("Tu sesión no está lista. Entra de nuevo e intenta otra vez.");
          } else {
            setError("No se pudo enviar la oferta. Intenta de nuevo.");
          }
          return;
        } finally {
          setSubmitting(false);
        }
      }

      // Guardamos un borrador en sessionStorage para completarlo luego del login.
      try {
        sessionStorage.setItem(
          "pending_interest",
          JSON.stringify({
            item,
            method,
            cashOffer: offer,
            minAccepted,
            message: msg,
            sellerId: item.sellerId,
            sellerName: item.sellerName,
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      onClose();
      router.push(`/sign-in?next=${encodeURIComponent("/messages")}`);
      return;
    }

    if (method === "trade") {
      setError("No tienes artículos registrados para intercambio. ¿Deseas registrar uno?");
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Cerrar"
      />

      {/* sheet */}
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-800 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">¿Cómo piensas pagar?</div>
            <div className="mt-1 text-sm text-neutral-400">
              {item.title} ·{" "}
              <span className="text-neutral-200">
                RD${item.price.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 hover:bg-neutral-900"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Option active={method === "cash"} onClick={() => setMethod("cash")}>
            Efectivo
          </Option>
          <Option active={method === "trade"} onClick={() => setMethod("trade")}>
            Intercambio
          </Option>
          <Option
            active={method === "cash_trade"}
            onClick={() => setMethod("cash_trade")}
          >
            Ambos
          </Option>
        </div>

        {(method === "cash" || method === "cash_trade") && (
          <div className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="text-sm font-medium">Oferta en efectivo</div>
            <div className="mt-1 text-xs text-neutral-400">
              Mínimo aceptado: RD${minAccepted.toLocaleString()}
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-400">¿Cuánto ofreces?</label>
              <input
                value={cashOffer}
                onChange={(e) => setCashOffer(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Ej: 28000"
                className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none focus:border-neutral-600"
              />
            </div>
          </div>
        )}

        {method === "trade" && (
          <div className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="text-sm font-medium">Intercambio</div>
            <div className="mt-1 text-xs text-neutral-400">
              Verificaremos si tienes artículos registrados para intercambiar.
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-3xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              onClose();
              router.push("/messages");
            }}
            className="w-full rounded-2xl border border-neutral-800 px-4 py-3 text-sm hover:bg-neutral-900"
          >
            Mensaje
          </button>
          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Ofertar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl border px-3 py-3 text-sm",
        active
          ? "border-neutral-200 bg-neutral-200 text-neutral-950"
          : "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
