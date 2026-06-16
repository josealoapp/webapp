"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, ImagePlus, LoaderCircle, MoreHorizontal, Repeat2, Send, X } from "lucide-react";
import { onAuthStateChanged } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
import {
  addChatMessage,
  ChatRecord,
  getListingById,
  listMessagesForChat,
  Listing,
  markChatRead,
  MessageRecord,
  subscribeChatById,
  subscribeMessagesForChat,
  updateListingChatAction,
  uploadListingImages,
} from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";
import {
  formatLastActive,
  isUserOnline,
  subscribeUserPresence,
  touchUserPresence,
  type UserPresence,
} from "@/lib/user-presence";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;

  const [chat, setChat] = useState<ChatRecord | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [tradeListing, setTradeListing] = useState<Listing | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [text, setText] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [authResolved, setAuthResolved] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [counterpartPresence, setCounterpartPresence] = useState<UserPresence | null>(null);
  const [presenceNow, setPresenceNow] = useState(Date.now());
  const [listingActionOpen, setListingActionOpen] = useState(false);
  const [listingActionLoading, setListingActionLoading] = useState<"" | "reserve" | "sell">("");
  const [listingActionError, setListingActionError] = useState("");
  const [actionListing, setActionListing] = useState<Listing | null>(null);
  const [soldListingOverlayDismissed, setSoldListingOverlayDismissed] = useState(false);
  const [olderMessagesCursor, setOlderMessagesCursor] = useState<number | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        if (user.emailVerified) {
          const destination = getPostAuthDestination(`/chat/${chatId}`);
          if (destination !== `/chat/${chatId}`) {
            router.replace(destination);
            return;
          }
        }
        setCurrentUserId(user.uid);
        setAuthResolved(true);
        return;
      }
      setCurrentUserId("");
      setAuthResolved(true);
    });
    return () => unsub();
  }, [chatId, router]);

  useEffect(() => {
    if (!authResolved) return;
    if (!currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/chat/${chatId}`)}`);
      return;
    }
    if (!chatId) return;

    const unsub = subscribeChatById(
      chatId,
      (row) => {
        setScreenError("");
        setChat(row);
      },
      (code) => {
        if (code === "permission-denied") {
          setScreenError("No tienes permisos para abrir este chat.");
        }
      }
    );
    return () => unsub();
  }, [authResolved, chatId, currentUserId, router]);

  useEffect(() => {
    if (!authResolved || !currentUserId || !chatId) return;

    const unsub = subscribeMessagesForChat(
      chatId,
      (rows) => {
        setScreenError("");
        setMessages((current) => {
          if (current.length === 0) {
            setOlderMessagesCursor(rows.length >= 50 ? rows[0]?.createdAt || null : null);
            return rows;
          }

          const merged = new Map<string, MessageRecord>();
          [...current, ...rows].forEach((message) => merged.set(message.id, message));
          return Array.from(merged.values()).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        });
      },
      (code) => {
        if (code === "permission-denied") {
          setScreenError("No tienes permisos para ver los mensajes de este chat.");
        }
      }
    );
    return () => unsub();
  }, [authResolved, chatId, currentUserId]);

  useEffect(() => {
    if (!chat?.listingId) {
      setListing(null);
      return;
    }

    let cancelled = false;
    getListingById(chat.listingId)
      .then((row) => {
        if (!cancelled) setListing(row);
      })
      .catch(() => {
        if (!cancelled) setListing(null);
      });

    return () => {
      cancelled = true;
    };
  }, [chat?.listingId]);

  useEffect(() => {
    if (!chat?.tradeListingId) {
      setTradeListing(null);
      return;
    }

    let cancelled = false;
    getListingById(chat.tradeListingId)
      .then((row) => {
        if (!cancelled) setTradeListing(row);
      })
      .catch(() => {
        if (!cancelled) setTradeListing(null);
      });

    return () => {
      cancelled = true;
    };
  }, [chat?.tradeListingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!chatId || !currentUserId || !chat) return;
    const unreadBy = chat.unreadBy || {};
    const hasStoredUnread = Object.prototype.hasOwnProperty.call(unreadBy, currentUserId);
    const storedUnread = Math.max(0, Number(unreadBy[currentUserId] || 0));
    const readAt = Number(chat.readBy?.[currentUserId] || 0);
    const fallbackUnread =
      !hasStoredUnread &&
      chat.lastMessageSenderId &&
      chat.lastMessageSenderId !== currentUserId &&
      Number(chat.updatedAt || 0) > readAt;

    if (storedUnread <= 0 && !fallbackUnread) return;

    void markChatRead(chatId, currentUserId).catch(() => {});
  }, [chat, chatId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    void touchUserPresence(currentUserId).catch(() => {});
    const intervalId = window.setInterval(() => {
      void touchUserPresence(currentUserId).catch(() => {});
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [currentUserId]);

  useEffect(() => {
    const counterpartId = chat && currentUserId === chat.sellerId ? chat.buyerId : chat?.sellerId || "";
    if (!counterpartId) {
      setCounterpartPresence(null);
      return;
    }

    return subscribeUserPresence(counterpartId, setCounterpartPresence);
  }, [chat, currentUserId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPresenceNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setSelectedImagePreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  useEffect(() => {
    setSoldListingOverlayDismissed(false);
  }, [listing?.id, listing?.status]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !selectedImage) || sending) return;

    if (!currentUserId) return;
    if (!chat) return;

    const senderRole = currentUserId === chat.sellerId ? "seller" : "buyer";

    setScreenError("");
    setSending(true);

    try {
      let imageUrl = "";
      if (selectedImage) {
        const uploads = await uploadListingImages([selectedImage]);
        imageUrl = uploads[0] || "";
      }

      await addChatMessage({
        chatId,
        senderId: currentUserId,
        senderRole,
        text: trimmed,
        ...(imageUrl ? { imageUrl } : {}),
      });

      setText("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : "";

      if (code === "permission-denied") {
        setScreenError("Firebase rechazó la respuesta por permisos. Revisa las reglas del chat.");
      } else {
        setScreenError("No se pudo enviar el mensaje. Intenta de nuevo.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScreenError("Selecciona una imagen válida.");
      return;
    }

    setScreenError("");
    setSelectedImage(file);
  };

  const loadOlderMessages = async () => {
    if (!chatId || !olderMessagesCursor || loadingOlderMessages) return;

    setLoadingOlderMessages(true);
    try {
      const result = await listMessagesForChat(chatId, olderMessagesCursor, 50);
      setMessages((current) => {
        const existingIds = new Set(current.map((message) => message.id));
        const olderRows = result.messages.filter((message) => !existingIds.has(message.id));
        return [...olderRows, ...current];
      });
      setOlderMessagesCursor(result.nextCursor);
    } catch {
      setScreenError("No pudimos cargar mensajes anteriores. Intenta de nuevo.");
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const counterpartName =
    chat && currentUserId === chat.sellerId ? chat.buyerName : chat?.sellerName;
  const recipientId = chat && currentUserId === chat.sellerId ? chat.buyerId : chat?.sellerId || "";
  const itemImage = listing?.image || "";
  const itemTitle = listing?.title || chat?.listingTitle || "Publicación";
  const itemPrice = Number(listing?.price || chat?.listingPrice || 0);
  const lastActiveAt = Number(counterpartPresence?.lastActiveAt || 0);
  const counterpartOnline = isUserOnline(lastActiveAt, presenceNow);
  const presenceLabel = formatLastActive(lastActiveAt, presenceNow);
  const canManageListing = Boolean(chat && listing && currentUserId === chat.sellerId && listing.status !== "sold");
  const hasTradeHeader = Boolean(chat?.tradeListingId && tradeListing && listing);
  const desiredListing = listing;
  const offeredListing = tradeListing;
  const gettingListing = currentUserId === chat?.buyerId ? desiredListing : offeredListing;
  const givingListing = currentUserId === chat?.buyerId ? offeredListing : desiredListing;
  const buyerTradeView = currentUserId === chat?.buyerId;
  const showSoldListingOverlay = listing?.status === "sold" && !soldListingOverlayDismissed;
  const soldListingOverlayTitle =
    listing?.soldToUserId === currentUserId ? "Adquiriste este artículo" : "Este artículo fue vendido";
  const listingActionTargetName =
    actionListing && chat
      ? actionListing.id === chat.listingId
        ? chat.buyerName || "comprador"
        : chat.sellerName || "comprador"
      : chat?.buyerName || "comprador";

  const handleListingAction = async (action: "reserve" | "sell") => {
    const targetListing = actionListing || listing;
    if (!chat || !targetListing || listingActionLoading) return;

    setListingActionLoading(action);
    setListingActionError("");

    try {
      const result = await updateListingChatAction({
        listingId: targetListing.id,
        chatId: chat.id,
        action,
      });
      const updateListingState = (current: Listing | null) =>
        current
          ? {
              ...current,
              status: result.status || current.status,
              reservedForUserId: result.reservedForUserId || current.reservedForUserId,
              reservedForUserName: result.reservedForUserName || current.reservedForUserName,
              reservedAt: result.reservedAt || current.reservedAt,
              soldAt: result.soldAt || current.soldAt,
            }
          : current;
      if (targetListing.id === listing?.id) setListing(updateListingState);
      if (targetListing.id === tradeListing?.id) setTradeListing(updateListingState);
      setListingActionOpen(false);
      setActionListing(null);
    } catch {
      setListingActionError("No pudimos completar la acción. Intenta de nuevo.");
    } finally {
      setListingActionLoading("");
    }
  };

  if (!authResolved || !currentUserId) {
    return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
  }

  if (!chat) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Link href="/messages" className="text-sm text-neutral-300 hover:text-white">
            ← Volver a negociaciones
          </Link>
          <div className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 text-sm text-neutral-300">
            Chat no encontrado (aún). Vuelve a negociaciones.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/0 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-800 hover:bg-neutral-900"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight text-white">{counterpartName}</div>
                <div
                  className={[
                    "mt-1 flex items-center gap-2 text-xs font-medium",
                    counterpartOnline ? "text-green-400" : "text-neutral-400",
                  ].join(" ")}
                >
                  <span>{presenceLabel}</span>
                  {counterpartOnline ? <span className="h-2.5 w-2.5 rounded-full bg-green-400" /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {hasTradeHeader && gettingListing && givingListing ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <TradeHeaderCard
                  listing={buyerTradeView ? givingListing : gettingListing}
                  borderClassName={buyerTradeView ? "border-red-600" : "border-green-600"}
                  currentUserId={currentUserId}
                  onActions={(target) => {
                    setActionListing(target);
                    setListingActionOpen(true);
                  }}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-200">
                  <Repeat2 className="h-5 w-5" />
                </div>
                <TradeHeaderCard
                  listing={buyerTradeView ? gettingListing : givingListing}
                  borderClassName={buyerTradeView ? "border-green-800" : "border-red-600"}
                  currentUserId={currentUserId}
                  onActions={(target) => {
                    setActionListing(target);
                    setListingActionOpen(true);
                  }}
                />
              </div>
            ) : (
              <div className="flex w-full min-w-0 items-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-950 p-3 transition hover:border-neutral-600">
                <Link href={`/item/${chat.listingId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                    {itemImage ? (
                      <img src={itemImage} alt={itemTitle} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-neutral-800" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-100">{itemTitle}</div>
                    <div className="mt-1 truncate text-sm font-bold text-orange-400">
                      {formatMoney(itemPrice, listing?.currency || "DOP")}
                    </div>
                  </div>
                </Link>
                {canManageListing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionListing(listing);
                      setListingActionOpen(true);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-900 hover:text-white"
                    aria-label="Acciones del artículo"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-3xl px-4 py-4 pb-28">
        {screenError ? (
          <div className="mb-4 rounded-3xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {screenError}
          </div>
        ) : null}
        <div className="space-y-3">
          {olderMessagesCursor ? (
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlderMessages}
              className="mx-auto mb-2 block rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-200 disabled:text-neutral-500"
            >
              {loadingOlderMessages ? "Cargando..." : "Cargar mensajes anteriores"}
            </button>
          ) : null}
          {messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            const isRead = isMine && recipientId
              ? Number(chat.readBy?.[recipientId] || 0) >= Number(m.createdAt || 0)
              : false;

            return (
              <div
                key={m.id}
                className={[
                  "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                  isMine
                    ? "ml-auto bg-white text-neutral-950"
                    : "mr-auto bg-neutral-900/0 border border-neutral-800 text-neutral-100",
                ].join(" ")}
              >
                {m.imageUrl ? (
                  <a
                    href={m.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 block overflow-hidden rounded-2xl bg-neutral-800"
                  >
                    <img src={m.imageUrl} alt="Imagen enviada" className="max-h-72 w-full object-cover" />
                  </a>
                ) : null}
                {m.text ? <div className="whitespace-pre-wrap break-words">{m.text}</div> : null}
                {isMine ? (
                  <div
                    className={[
                      "mt-1 flex items-center justify-end gap-1 text-[11px] font-medium",
                      isRead ? "text-orange-500" : "text-neutral-500",
                    ].join(" ")}
                  >
                    {isRead ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    <span>{isRead ? "Visto" : "Enviado"}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/10 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {selectedImagePreview ? (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-2">
              <img src={selectedImagePreview} alt="Vista previa" className="h-14 w-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-xs text-neutral-300">
                <div className="truncate font-semibold">{selectedImage?.name || "Imagen"}</div>
                <div className="mt-1 text-neutral-500">Se optimizará a WebP antes de enviarse.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 text-neutral-300"
                aria-label="Quitar imagen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600 disabled:opacity-60"
              aria-label="Adjuntar imagen"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe un mensaje…"
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none focus:border-neutral-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !selectedImage)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950 hover:opacity-90 disabled:opacity-60"
              aria-label="Enviar"
            >
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {listingActionOpen && chat ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              setListingActionOpen(false);
              setActionListing(null);
            }}
            aria-label="Cerrar acciones"
          />
          <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-800" />
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleListingAction("sell")}
                disabled={Boolean(listingActionLoading)}
                className="h-12 w-full rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {listingActionLoading === "sell" ? "Vendiendo..." : `Vender a ${listingActionTargetName}`}
              </button>
              <button
                type="button"
                onClick={() => void handleListingAction("reserve")}
                disabled={Boolean(listingActionLoading)}
                className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:bg-neutral-800 disabled:text-neutral-500"
              >
                {listingActionLoading === "reserve" ? "Reservando..." : `Reservar para ${listingActionTargetName}`}
              </button>
            </div>
            {listingActionError ? (
              <div className="mt-3 rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                {listingActionError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSoldListingOverlay ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setSoldListingOverlayDismissed(true)}
            aria-label="Cerrar aviso"
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-6 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => setSoldListingOverlayDismissed(true)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-lg font-semibold text-white">{soldListingOverlayTitle}</div>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Esta negociación queda visible como historial, pero el artículo ya no está disponible.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSoldListingOverlayDismissed(true)}
                className="h-11 flex-1 rounded-2xl bg-white px-4 text-sm font-semibold text-neutral-950"
              >
                Ver chat
              </button>
              <Link
                href="/messages"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-neutral-800 px-4 text-sm font-semibold text-neutral-100"
              >
                Volver
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TradeHeaderCard({
  listing,
  borderClassName,
  currentUserId,
  onActions,
}: {
  listing: Listing;
  borderClassName: string;
  currentUserId: string;
  onActions: (listing: Listing) => void;
}) {
  const canManage = listing.ownerId === currentUserId && listing.status !== "sold";

  return (
    <div className={["relative min-w-0 overflow-hidden rounded-3xl border bg-neutral-950 p-2", borderClassName].join(" ")}>
      <Link href={`/item/${listing.id}`} className="flex w-full min-w-0 items-center gap-2 pr-8">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-neutral-800">
          {listing.image ? (
            <img src={listing.image} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-neutral-800" />
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-neutral-100 sm:text-sm">
            {listing.title}
          </div>
          <div className="mt-1 truncate text-xs font-bold text-orange-400 sm:text-sm">
            {formatMoney(Number(listing.price || 0), listing.currency || "DOP")}
          </div>
        </div>
      </Link>
      {canManage ? (
        <button
          type="button"
          onClick={() => onActions(listing)}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-neutral-900 hover:text-white"
          aria-label="Acciones del artículo"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function formatMoney(value: number, currency: "DOP" | "USD" = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString()}`;
}
