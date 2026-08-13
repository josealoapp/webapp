"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, Plus, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { createOffer, getExistingOfferChat, Listing, searchListings } from "@/lib/marketplace";
import { savePendingAuthAction } from "@/lib/pending-auth-action";
import { buildWhatsappUrl } from "@/lib/whatsapp";

type Method = "cash" | "trade" | "cash_trade";
type ListingPaymentMethod = "efectivo" | "intercambio" | "ambos" | "transferencia";

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
    currency?: "DOP" | "USD";
    sellerId?: string;
    sellerName?: string;
    sellerWhatsappNumber?: string;
    sellerUsesWhatsapp?: boolean;
    sellerMaxDiscountPercent: number;
    paymentMethod?: ListingPaymentMethod;
  };
}) {
  const router = useRouter();
  const itemCurrency = item.currency || "DOP";
  const [method, setMethod] = useState<Method>("cash");
  const [cashOffer, setCashOffer] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingExistingChat, setCheckingExistingChat] = useState(false);
  const [buyerListings, setBuyerListings] = useState<Listing[]>([]);
  const [loadingBuyerListings, setLoadingBuyerListings] = useState(false);
  const [selectedTradeListingId, setSelectedTradeListingId] = useState("");
  const [tradePickerOpen, setTradePickerOpen] = useState(false);

  const minAccepted = useMemo(() => {
    const min = item.price * (1 - item.sellerMaxDiscountPercent / 100);
    return Math.ceil(min);
  }, [item.price, item.sellerMaxDiscountPercent]);
  const offerChips = useMemo(() => {
    const price = Math.max(0, Number(item.price || 0));
    return [
      { label: formatMoney(price, itemCurrency), value: price },
      { label: formatMoney(Math.round(price * 0.95), itemCurrency), value: Math.round(price * 0.95) },
      { label: formatMoney(Math.round(price * 0.9), itemCurrency), value: Math.round(price * 0.9) },
    ].filter((chip, index, rows) => chip.value > 0 && rows.findIndex((row) => row.value === chip.value) === index);
  }, [item.price, itemCurrency]);
  const usesWhatsapp = Boolean(item.sellerUsesWhatsapp && item.sellerWhatsappNumber?.trim());
  const sellerPaymentMethod = item.paymentMethod === "transferencia" ? "ambos" : item.paymentMethod || "efectivo";
  const availableMethods = useMemo<Method[]>(() => {
    if (sellerPaymentMethod === "efectivo") return ["cash"];
    if (sellerPaymentMethod === "intercambio") return ["trade"];
    return ["cash", "trade", "cash_trade"];
  }, [sellerPaymentMethod]);

  useEffect(() => {
    if (!open) return;
    if (availableMethods.some((availableMethod) => availableMethod === method)) return;
    setMethod(availableMethods[0]);
  }, [availableMethods, method, open]);

  useEffect(() => {
    if (!open) return;

    const user = auth.currentUser;
    if (!user?.uid || !item.sellerId || item.sellerId === user.uid) {
      setCheckingExistingChat(false);
      return;
    }

    let cancelled = false;
    setCheckingExistingChat(true);
    getExistingOfferChat(item.id, user.uid)
      .then((chat) => {
        if (cancelled || !chat) return;
        onClose();
        router.push(`/chat/${chat.id}`);
      })
      .catch(() => {
        // If the lookup fails, keep the normal offer flow available.
      })
      .finally(() => {
        if (!cancelled) setCheckingExistingChat(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.sellerId, onClose, open, router]);

  useEffect(() => {
    if (!open || usesWhatsapp) return;
    if (method !== "trade" && method !== "cash_trade") return;

    const user = auth.currentUser;
    if (!user?.uid) {
      setBuyerListings([]);
      return;
    }

    let cancelled = false;
    setLoadingBuyerListings(true);
    searchListings({
      ownerId: user.uid,
      status: "active",
      limit: 30,
    })
      .then((result) => {
        if (cancelled) return;
        setBuyerListings(result.items.filter((listing) => listing.id !== item.id && listing.status !== "sold"));
      })
      .catch(() => {
        if (!cancelled) setBuyerListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBuyerListings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, method, open, usesWhatsapp]);

  if (!open) return null;
  if (checkingExistingChat) return null;

  const selectedTradeListing = buyerListings.find((listing) => listing.id === selectedTradeListingId) || null;
  const selectedTradeValue = Number(selectedTradeListing?.price || 0);
  const selectedTradeCurrency = selectedTradeListing?.currency || "DOP";
  const hasCurrencyMismatch = Boolean(selectedTradeListing && selectedTradeCurrency !== itemCurrency);
  const numericCashOffer = Number(cashOffer || 0);
  const tradeShortfall = Math.max(0, minAccepted - selectedTradeValue);
  const combinedOfferValue = selectedTradeValue + (method === "cash_trade" ? numericCashOffer : 0);

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

  const startChat = async (message: string, nextOnSignedOut?: string, tradeListing?: Listing | null) => {
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
          ...(tradeListing
            ? {
                tradeListingId: tradeListing.id,
                tradeListingTitle: tradeListing.title,
                tradeListingPrice: tradeListing.price,
                tradeListingImage: tradeListing.image,
                tradeListingCurrency: tradeListing.currency || "DOP",
              }
            : {}),
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          message,
        });

        try {
          localStorage.removeItem("pending_trade_offer");
        } catch {
          // ignore
        }
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

    const returnTo =
      nextOnSignedOut ||
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `/item/${item.id}`);

    try {
      savePendingAuthAction({
        type: "interest",
        returnTo,
        listingId: item.id,
        createdAt: Date.now(),
      });
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
    router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  };

  const handleContinue = async () => {
    setError("");

    if (!item.sellerId || !item.sellerName) {
      setError("No pudimos identificar al vendedor de esta publicación.");
      return;
    }

    if (method === "cash" || method === "cash_trade") {
      if (method === "cash_trade" && !selectedTradeListing) {
        setError("Selecciona el artículo que quieres ofrecer como parte del pago.");
        return;
      }
      if (method === "cash_trade" && hasCurrencyMismatch) {
        setError("Por favor selecciona un artículo que comparta la misma unidad de cambio.");
        return;
      }
      const offer = Number(cashOffer);
      if (!offer || Number.isNaN(offer)) {
        setError("Escribe un monto válido en efectivo.");
        return;
      }
      if (method === "cash" && offer < minAccepted) {
        setError(
          `El vendedor no acepta menos de ${formatMoney(minAccepted, itemCurrency)} (máx. ${item.sellerMaxDiscountPercent}% menos del precio).`
        );
        return;
      }
      if (method === "cash_trade" && combinedOfferValue < minAccepted) {
        setError(`Agrega al menos ${formatMoney(tradeShortfall, itemCurrency)} para llegar al mínimo esperado por el vendedor.`);
        return;
      }

      await startChat(
        method === "cash_trade" && selectedTradeListing
          ? buildTradeOfferMessage(item.title, selectedTradeListing, offer, combinedOfferValue, minAccepted, itemCurrency)
          : buildOfferMessage(item.title, offer, itemCurrency),
        undefined,
        method === "cash_trade" ? selectedTradeListing : null
      );
      return;
    }

    if (method === "trade") {
      if (!selectedTradeListing) {
        setError("Selecciona el artículo que quieres ofrecer como pago.");
        return;
      }
      if (hasCurrencyMismatch) {
        setError("Por favor selecciona un artículo que comparta la misma unidad de cambio.");
        return;
      }
      if (selectedTradeValue < minAccepted) {
        setError(`Este artículo queda ${formatMoney(tradeShortfall, itemCurrency)} por debajo. Selecciona "Ambos" para agregar el balance.`);
        return;
      }

      await startChat(buildTradeOfferMessage(item.title, selectedTradeListing, 0, selectedTradeValue, minAccepted, itemCurrency), undefined, selectedTradeListing);
      return;
    }
  };

  const handleCreateTradeListing = () => {
    try {
      localStorage.setItem(
        "pending_trade_offer",
        JSON.stringify({
          listingId: item.id,
          listingTitle: item.title,
          listingPrice: item.price,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          createdAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    onClose();
    router.push("/item/new");
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
              <span className="listing-title font-medium">{item.title}</span> ·{" "}
              <span className="listing-price font-bold text-neutral-200">
                {formatMoney(item.price, itemCurrency)}
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
          <div
            className={[
              "mt-4 grid gap-2",
              availableMethods.length === 1 ? "grid-cols-1" : "grid-cols-3",
            ].join(" ")}
          >
            {availableMethods.includes("cash") ? (
              <Option active={method === "cash"} onClick={() => setMethod("cash")}>
                Efectivo
              </Option>
            ) : null}
            {availableMethods.includes("trade") ? (
              <Option active={method === "trade"} onClick={() => setMethod("trade")}>
                Intercambio
              </Option>
            ) : null}
            {availableMethods.includes("cash_trade") ? (
              <Option
                active={method === "cash_trade"}
                onClick={() => setMethod("cash_trade")}
              >
                Ambos
              </Option>
            ) : null}
          </div>
        )}

        {!usesWhatsapp && (method === "cash" || method === "cash_trade") && (
          <div className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/0 p-4">
            <div className="text-sm font-medium">Oferta en efectivo</div>
            <div className="mt-1 text-xs text-neutral-400">
              Mínimo aceptado: {formatMoney(minAccepted, itemCurrency)}
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
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {offerChips.map((chip) => {
                  const isActive = cashOffer === String(chip.value);

                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setCashOffer(String(chip.value))}
                      className={[
                        "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-orange-400 bg-orange-400 text-black"
                          : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-500",
                      ].join(" ")}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!usesWhatsapp && (method === "trade" || method === "cash_trade") && (
          <div className="relative mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Intercambio</div>
                <div className="mt-1 text-xs text-neutral-400">
                  Selecciona uno de tus artículos como pago.
                </div>
              </div>
              {selectedTradeListing ? (
                <div className="text-right text-xs text-neutral-400">
                  Valor: {formatMoney(selectedTradeValue, selectedTradeCurrency)}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setTradePickerOpen((current) => !current)}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-left"
            >
              {selectedTradeListing?.image ? (
                <img src={selectedTradeListing.image} alt={selectedTradeListing.title} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-neutral-800" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-neutral-100">
                  {selectedTradeListing?.title || "Seleccionar artículo"}
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  {selectedTradeListing
                    ? formatMoney(selectedTradeValue, selectedTradeCurrency)
                    : loadingBuyerListings
                      ? "Cargando tus artículos..."
                      : "Tus publicaciones activas"}
                </div>
              </div>
              <ChevronUp className={["h-4 w-4 text-neutral-400 transition", tradePickerOpen ? "rotate-180" : ""].join(" ")} />
            </button>

            {tradePickerOpen ? (
              <div className="absolute bottom-[calc(100%-0.75rem)] left-4 right-4 z-[110] max-h-72 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
                {loadingBuyerListings ? (
                  <div className="px-3 py-3 text-sm text-neutral-400">Cargando artículos...</div>
                ) : buyerListings.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleCreateTradeListing}
                    className="flex w-full items-center gap-3 rounded-xl border border-orange-400/40 bg-orange-400/10 px-2 py-2 text-left hover:bg-orange-400/15"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-400 text-black">
                      <Plus className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-orange-100">Crear artículo</span>
                      <span className="mt-1 block truncate text-xs text-orange-100/70">
                        No tienes artículos para intercambio
                      </span>
                    </span>
                  </button>
                ) : (
                  <>
                    {buyerListings.map((listing) => (
                      <button
                        key={listing.id}
                        type="button"
                        onClick={() => {
                          setSelectedTradeListingId(listing.id);
                          setTradePickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-neutral-900"
                      >
                        {listing.image ? (
                          <img src={listing.image} alt={listing.title} className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-neutral-800" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="listing-title truncate text-sm font-medium text-neutral-100">{listing.title}</div>
                          <div className="listing-price mt-1 text-xs font-bold text-neutral-400">{formatMoney(Number(listing.price || 0), listing.currency || "DOP")}</div>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleCreateTradeListing}
                      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-neutral-800 px-2 py-2 text-left hover:border-orange-400 hover:bg-neutral-900"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-orange-300">
                        <Plus className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-100">Crear artículo</span>
                        <span className="mt-1 block truncate text-xs text-neutral-400">
                          Agrega otro artículo para intercambio
                        </span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {selectedTradeListing ? (
              <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3 text-xs leading-5 text-neutral-300">
                {hasCurrencyMismatch ? (
                  <span>Por favor selecciona un artículo que comparta la misma unidad de cambio.</span>
                ) : selectedTradeValue >= minAccepted ? (
                  <span>Tu artículo cubre el mínimo esperado por el vendedor.</span>
                ) : (
                  <span>
                    Este artículo queda {formatMoney(tradeShortfall, itemCurrency)} por debajo del mínimo esperado.
                    {method === "cash_trade" ? " Agrega ese balance en efectivo." : " Selecciona Ambos para agregar el balance."}
                  </span>
                )}
              </div>
            ) : null}
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
              onClick={() => {
                const offer = Number(cashOffer);
                const message =
                  offer && Number.isFinite(offer)
                    ? buildOfferMessage(item.title, offer, itemCurrency)
                    : buildInterestMessage(item.title);
                void startChat(message);
              }}
              disabled={submitting}
              className="w-full rounded-2xl border border-neutral-800 px-4 py-3 text-sm hover:bg-neutral-900"
            >
              Mensaje
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Ofertar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildInterestMessage(itemTitle: string) {
  return `Hola, estoy interesado en tu ${itemTitle}. ¿Sigue disponible?`;
}

function buildOfferMessage(itemTitle: string, offer: number, currency: "DOP" | "USD") {
  return `Hola, estoy interesado en tu ${itemTitle}. Te ofrezco ${formatMoney(offer, currency)} en efectivo. Me gustaría saber más detalles del producto.`;
}

function buildTradeOfferMessage(
  itemTitle: string,
  tradeListing: Listing,
  cashBalance: number,
  totalValue: number,
  minAccepted: number,
  currency: "DOP" | "USD"
) {
  const tradeValue = Number(tradeListing.price || 0);
  const balanceText =
    cashBalance > 0 ? ` más ${formatMoney(cashBalance, currency)} en efectivo` : "";

  return `Hola, estoy interesado en tu ${itemTitle}. Te ofrezco mi artículo "${tradeListing.title}" valorado en ${formatMoney(tradeValue, currency)}${balanceText}. Valor total de la oferta: ${formatMoney(totalValue, currency)}. Mínimo esperado: ${formatMoney(minAccepted, currency)}.`;
}

function formatMoney(value: number, currency: "DOP" | "USD" = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString()}`;
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
