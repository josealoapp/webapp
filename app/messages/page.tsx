"use client";

import Link from "next/link";
import AppBottomNav from "@/components/AppBottomNav";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, MoreVertical, Search } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination, readAccountProfile } from "@/lib/account-profile";
import {
  ChatRecord,
  deleteChat,
  getListingById,
  Listing,
  listChatsForUser,
  subscribeChatsForUser,
} from "@/lib/marketplace";

export default function MessagesPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"comprando" | "vendiendo">("comprando");
  const [currentUserId, setCurrentUserId] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [usesWhatsappForCustomers, setUsesWhatsappForCustomers] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [openMenuChatId, setOpenMenuChatId] = useState("");
  const [deletingChatId, setDeletingChatId] = useState("");
  const [screenError, setScreenError] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [chatListings, setChatListings] = useState<Record<string, Listing>>({});
  const [buyerChats, setBuyerChats] = useState<ChatRecord[]>([]);
  const [sellerChats, setSellerChats] = useState<ChatRecord[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const profile = readAccountProfile();
      const nextAccountType = profile.accountType === "business" ? "business" : "personal";
      setAccountType(nextAccountType);
      setActiveTab(nextAccountType === "business" ? "vendiendo" : "comprando");
      setUsesWhatsappForCustomers(profile.useWhatsappForCustomers);

      if (user?.uid) {
        if (user.emailVerified) {
          const destination = getPostAuthDestination("/messages");
          if (destination !== "/messages") {
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
  }, [router]);

  useEffect(() => {
    if (authResolved && !currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent("/messages")}`);
    }
  }, [authResolved, currentUserId, router]);

  useEffect(() => {
    if (!currentUserId) return;

    const role = activeTab === "comprando" ? "buyer" : "seller";
    setLoadingChats(true);
    setNextCursor(null);

    const unsub = subscribeChatsForUser(
      currentUserId,
      role,
      (rows) => {
        setScreenError("");
        setChats(rows);
        setLoadingChats(false);
      },
      (code) => {
        setChats([]);
        setNextCursor(null);
        setLoadingChats(false);
        if (code === "permission-denied") {
          setScreenError("No tienes permisos para ver estas negociaciones.");
        } else if (code === "failed-precondition") {
          setScreenError("Firestore necesita crear/desplegar el índice de chats para cargar negociaciones.");
        } else {
          setScreenError("No pudimos cargar tus negociaciones. Intenta de nuevo.");
        }
      }
    );

    return () => {
      unsub();
    };
  }, [activeTab, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setBuyerChats([]);
      setSellerChats([]);
      return;
    }

    const unsubBuyer = subscribeChatsForUser(currentUserId, "buyer", setBuyerChats, () => setBuyerChats([]));
    const unsubSeller = subscribeChatsForUser(currentUserId, "seller", setSellerChats, () => setSellerChats([]));

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (chats.length === 0) {
      setChatListings({});
      return;
    }

    let cancelled = false;
    const listingIds = Array.from(new Set(chats.map((chat) => chat.listingId).filter(Boolean)));

    Promise.all(
      listingIds.map(async (listingId) => {
        const listing = await getListingById(listingId);
        return listing ? ([listingId, listing] as const) : null;
      })
    )
      .then((rows) => {
        if (cancelled) return;
        setChatListings(
          Object.fromEntries(rows.filter((row): row is readonly [string, Listing] => Boolean(row)))
        );
      })
      .catch(() => {
        if (!cancelled) setChatListings({});
      });

    return () => {
      cancelled = true;
    };
  }, [chats]);

  const visibleChats = useMemo(() => {
    return chats;
  }, [chats]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return visibleChats;
    return visibleChats.filter((chat) => {
      const counterpartName =
        chat.sellerId === currentUserId ? chat.buyerName : chat.sellerName;

      return (
        counterpartName.toLowerCase().includes(query) ||
        chat.listingTitle.toLowerCase().includes(query)
      );
    });
  }, [currentUserId, q, visibleChats]);
  const messageTabs = accountType === "business"
    ? (["vendiendo", "comprando"] as const)
    : (["comprando", "vendiendo"] as const);
  const tabUnreadCounts = useMemo(
    () => ({
      comprando: buyerChats.reduce((total, chat) => total + getUnreadCount(chat, currentUserId), 0),
      vendiendo: sellerChats.reduce((total, chat) => total + getUnreadCount(chat, currentUserId), 0),
    }),
    [buyerChats, currentUserId, sellerChats]
  );
  const loadMoreChats = async () => {
    if (!currentUserId || !nextCursor || loadingChats) return;

    const role = activeTab === "comprando" ? "buyer" : "seller";
    setLoadingChats(true);
    try {
      const result = await listChatsForUser(currentUserId, role, nextCursor, 25);
      setChats((current) => [...current, ...result.chats]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : undefined;
      const message = error instanceof Error ? error.message : "";
      if (code === "failed-precondition" || message.toLowerCase().includes("index")) {
        setScreenError("Firestore necesita crear/desplegar el índice de chats para cargar más negociaciones.");
      } else if (code === "permission-denied") {
        setScreenError("No tienes permisos para cargar más negociaciones.");
      } else {
        setScreenError("No pudimos cargar más negociaciones. Intenta de nuevo.");
      }
    } finally {
      setLoadingChats(false);
    }
  };

  if (!authResolved || !currentUserId) {
    return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 hover:bg-neutral-900"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4 text-neutral-300" />
          </Link>

          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-neutral-300" />
            <h1 className="text-base font-semibold">Negociacion</h1>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-4">
          <div className="mb-3 flex items-center justify-center gap-10 border-b border-neutral-800 px-1">
            {messageTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "relative pb-3 text-base font-semibold capitalize tracking-wide transition",
                  activeTab === tab
                    ? "text-orange-400"
                    : "text-neutral-400 hover:text-neutral-200",
                  "after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:rounded-full",
                  activeTab === tab ? "after:bg-orange-400" : "after:bg-transparent",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{tab}</span>
                  {tabUnreadCounts[tab] > 0 ? (
                    <span
                      className={[
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold leading-none",
                        activeTab === tab ? "bg-orange-400 text-black" : "bg-neutral-800 text-neutral-200",
                      ].join(" ")}
                    >
                      {formatUnreadCount(tabUnreadCounts[tab])}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar chat…"
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 py-3 pl-11 pr-4 text-sm outline-none focus:border-neutral-600"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-24">
        {screenError ? (
          <div className="mb-4 rounded-3xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {screenError}
          </div>
        ) : null}
        {activeTab === "vendiendo" && usesWhatsappForCustomers ? (
          <div className="mb-4 rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-100">
            Tus negociaciones están siendo manejadas por WhatsApp.
          </div>
        ) : null}
        {loadingChats && filtered.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 text-sm text-neutral-300">
            Cargando negociaciones...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 text-sm text-neutral-300">
            {activeTab === "comprando"
              ? "Aún no has enviado ofertas. Cuando ofertes un artículo, aparecerá aquí."
              : "Aún no has recibido ofertas en tus publicaciones. Cuando alguien te escriba, aparecerá aquí."}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((chat) => {
              const isSellingChat = chat.sellerId === currentUserId;
              const counterpartName = isSellingChat ? chat.buyerName : chat.sellerName;
              const listing = chatListings[chat.listingId];
              const isSold = listing?.status === "sold";
              const wasPurchasedByCurrentUser = isSold && listing.soldToUserId === currentUserId;
              const roleLabel = isSold
                ? wasPurchasedByCurrentUser
                  ? "Adquiriste este artículo"
                  : "No disponible"
                : isSellingChat
                  ? "Oferta recibida"
                  : "Oferta enviada";
              const unreadCount = getUnreadCount(chat, currentUserId);
              const statusStyles =
                isSold
                  ? "border-neutral-700/70 bg-neutral-800/80 text-neutral-300"
                  : "border-neutral-700/70 bg-neutral-900/50 text-neutral-300";

              return (
                <div
                  key={chat.id}
                  className="relative rounded-3xl border border-neutral-800 bg-neutral-900/20 p-4 hover:bg-neutral-900/30"
                >
                  <Link href={`/chat/${chat.id}`} className="block pr-14">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles}`}
                          >
                            {roleLabel}
                          </span>
                          {unreadCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-black">
                              {unreadCount > 99 ? "+99" : unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-sm font-semibold">
                          {counterpartName}
                        </div>
                        <div className="truncate text-xs text-neutral-400">
                          {chat.listingTitle}
                        </div>
                      </div>
                      <div className="shrink-0 pr-6 text-xs text-neutral-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-3 line-clamp-1 text-sm text-neutral-300">
                      {chat.lastMessage ?? "Nueva oferta iniciada"}
                    </div>
                  </Link>

                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpenMenuChatId((current) => (current === chat.id ? "" : chat.id));
                      }}
                      className="flex h-10 w-10 items-center justify-center text-neutral-300 hover:text-white"
                      aria-label="Opciones del chat"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuChatId === chat.id ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[170px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDeletingChatId(chat.id);
                            try {
                              await deleteChat(chat.id);
                              setOpenMenuChatId("");
                            } finally {
                              setDeletingChatId("");
                            }
                          }}
                          disabled={deletingChatId === chat.id}
                          className="flex w-full items-center justify-start px-4 py-3 text-sm text-red-300 hover:bg-neutral-900 disabled:opacity-60"
                        >
                          {deletingChatId === chat.id ? "Deleting..." : "Delete message"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
              })}
            </div>
            {nextCursor ? (
              <button
                type="button"
                onClick={loadMoreChats}
                disabled={loadingChats}
                className="mt-4 h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 disabled:text-neutral-500"
              >
                {loadingChats ? "Cargando..." : "Cargar más"}
              </button>
            ) : null}
          </>
        )}
      </main>

      <AppBottomNav active="messages" />
    </div>
  );
}

function getUnreadCount(chat: ChatRecord, userId: string) {
  if (!userId) return 0;
  const unreadBy = chat.unreadBy || {};
  const hasStoredUnread = Object.prototype.hasOwnProperty.call(unreadBy, userId);
  const storedUnread = Math.max(0, Number(unreadBy[userId] || 0));
  if (hasStoredUnread) return storedUnread;

  const readAt = Number(chat.readBy?.[userId] || 0);
  const lastMessageAt = Number(chat.updatedAt || 0);
  if (chat.lastMessageSenderId && chat.lastMessageSenderId !== userId && lastMessageAt > readAt) {
    return 1;
  }

  return 0;
}

function formatUnreadCount(count: number) {
  return count > 99 ? "+99" : String(count);
}
