"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, MoreVertical, Search } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination, readAccountProfile } from "@/lib/account-profile";
import { ChatRecord, deleteChat, subscribeInboxChatsForUser } from "@/lib/marketplace";

export default function MessagesPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"comprando" | "vendiendo">("comprando");
  const [currentUserId, setCurrentUserId] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [authResolved, setAuthResolved] = useState(false);
  const [openMenuChatId, setOpenMenuChatId] = useState("");
  const [deletingChatId, setDeletingChatId] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const profile = readAccountProfile();
      const nextAccountType = profile.accountType === "business" ? "business" : "personal";
      setAccountType(nextAccountType);
      setActiveTab(nextAccountType === "business" ? "vendiendo" : "comprando");

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

    const unsub = subscribeInboxChatsForUser(currentUserId, (rows) => setChats(rows));
    return () => unsub();
  }, [currentUserId]);

  const visibleChats = useMemo(() => {
    if (activeTab === "comprando") {
      return chats.filter((chat) => chat.buyerId === currentUserId);
    }

    return chats.filter((chat) => chat.sellerId === currentUserId);
  }, [activeTab, chats, currentUserId]);

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
                {tab}
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
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 text-sm text-neutral-300">
            {activeTab === "comprando"
              ? "Aún no has enviado ofertas. Cuando ofertes un artículo, aparecerá aquí."
              : "Aún no has recibido ofertas en tus publicaciones. Cuando alguien te escriba, aparecerá aquí."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((chat) => {
              const isSellingChat = chat.sellerId === currentUserId;
              const counterpartName = isSellingChat ? chat.buyerName : chat.sellerName;
              const roleLabel = isSellingChat ? "Oferta recibida" : "Oferta enviada";
              const statusStyles =
                "border-neutral-700/70 bg-neutral-900/50 text-neutral-300";

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
        )}
      </main>
    </div>
  );
}
