"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { createOffer } from "@/lib/marketplace";
import { buildWhatsappUrl } from "@/lib/whatsapp";

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
    sellerWhatsappNumber?: string;
    sellerUsesWhatsapp?: boolean;
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
  const usesWhatsapp = Boolean(item.sellerUsesWhatsapp && item.sellerWhatsappNumber?.trim());

  if (!open) return null;

  const openWhatsapp = () => {
    setError("");

    if (!item.sellerWhatsappNumber || !item.sellerName) {
      setError("Este vendedor no tiene un número de WhatsApp disponible.");
      return;
    }

    const currentUser = auth.currentUser;
    if (currentUser?.uid && item.sellerId === currentUser.uid) {
      setError("No puedes abrir WhatsApp hacia tu propia publicación.");
      return;
    }

    const itemUrl = typeof window !== "undefined" ? window.location.href : "";
    const url = buildWhatsappUrl({
      phone: item.sellerWhatsappNumber,
      vendorName: item.sellerName,
      itemName: item.title,
      itemUrl,
    });

    if (!url) {
      setError("El número de WhatsApp del vendedor no es válido.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  const startChat = async (message: string, nextOnSignedOut = "/messages") => {
    setError("");

    if (!item.sellerId || !item.sellerName) {
      setError("No pudimos identificar al vendedor de esta publicación.");
      return;
    }

    const user = auth.currentUser;
    if (user?.uid) {
      if (item.sellerId && user.uid === item.sellerId) {
        setError("No puedes enviarte un mensaje a tu propia publicación.");
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
          message,
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
            "Firebase rechazó esta conversación por permisos. Si estás probando tu propia publicación, usa otra cuenta."
          );
        } else if (code === "offer/self-offer") {
          setError("No puedes enviarte un mensaje a tu propia publicación.");
        } else if (code === "auth/missing-token" || code === "unauthenticated") {
          setError("Tu sesión no está lista. Entra de nuevo e intenta otra vez.");
        } else {
          setError("No se pudo abrir el chat. Intenta de nuevo.");
        }
        return;
      } finally {
        setSubmitting(false);
      }
    }

    try {
      sessionStorage.setItem(
        "pending_interest",
        JSON.stringify({
          item,
          method,
          cashOffer: 0,
          minAccepted,
          message,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          createdAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    onClose();
    router.push(`/sign-in?next=${encodeURIComponent(nextOnSignedOut)}`);
  };

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
      await startChat(msg);
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
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Cerrar"
      />

      {/* sheet */}
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-800 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">
              {usesWhatsapp ? "Contacta por WhatsApp" : "¿Cómo piensas pagar?"}
            </div>
            <div className="mt-1 text-sm text-neutral-400">
              {item.title} ·{" "}
              <span className="text-neutral-200">
                RD${item.price.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 hover:bg-neutral-900"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {usesWhatsapp ? (
          <div className="mt-4 rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-100">
            Esta publicación usa WhatsApp como canal principal. Al continuar, abrirás una conversación con el vendedor.
          </div>
        ) : (
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
        )}

        {!usesWhatsapp && (method === "cash" || method === "cash_trade") && (
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

        {!usesWhatsapp && method === "trade" && (
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

        {usesWhatsapp ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={openWhatsapp}
              className="w-full rounded-2xl border border-green-500/30 bg-green-500/15 px-4 py-3 text-sm font-semibold text-green-100 hover:bg-green-500/20"
            >
              Whatsapp
            </button>
          </div>
        ) : (
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() =>
                startChat(`Hola, estoy interesado en tu ${item.title}. ¿Sigue disponible?`)
              }
              disabled={submitting}
              className="w-full rounded-2xl border border-neutral-800 px-4 py-3 text-sm hover:bg-neutral-900"
            >
              Mensaje
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Ofertar"}
            </button>
          </div>
        )}
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
      type="button"
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
