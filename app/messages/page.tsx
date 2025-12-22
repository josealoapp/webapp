"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getChats, getMessages, Chat } from "@/lib/storage";
import { ArrowLeft, MessageCircle, Search } from "lucide-react";

export default function MessagesPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"comprando" | "vendiendo">("comprando");
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    setChats(getChats());
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const parsed = JSON.parse(raw) as { emailOrUser?: string };
        if (parsed?.emailOrUser) setCurrentUser(parsed.emailOrUser.trim().toLowerCase());
      }
    } catch {
      // ignore
    }
  }, []);

  const lastMessageByChat = useMemo(() => {
    const msgs = getMessages();
    const map = new Map<string, string>();
    const timeMap = new Map<string, number>();

    for (const m of msgs) {
      const prevTime = timeMap.get(m.chatId) ?? 0;
      if (m.createdAt >= prevTime) {
        timeMap.set(m.chatId, m.createdAt);
        map.set(m.chatId, m.text);
      }
    }
    return map;
  }, [chats]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const tabFiltered = chats.filter((c) => {
      if (!currentUser) return true;
      const buyer = c.buyerName?.toLowerCase?.() ?? "";
      const seller = c.sellerName?.toLowerCase?.() ?? "";
      if (activeTab === "comprando") return buyer === currentUser;
      return seller === currentUser;
    });

    if (!query) return tabFiltered;
    return tabFiltered.filter(
      (c) =>
        c.sellerName.toLowerCase().includes(query) ||
        c.listingTitle.toLowerCase().includes(query)
    );
  }, [q, chats, activeTab, currentUser]);

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
            {(["comprando", "vendiendo"] as const).map((tab) => (
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
            Aún no tienes conversaciones. Cuando hagas una oferta, aparecerá aquí.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((chat) => {
              const status: "en_espera" | "joseo" | "acuerdo" | "declinado" | "cerrado" =
                "en_espera";
              const statusStyles = {
                en_espera:
                  "border-neutral-700/70 bg-neutral-900/50 text-neutral-400",
                joseo: "border-amber-500/50 bg-amber-500/10 text-amber-200",
                acuerdo: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
                declinado: "border-red-500/50 bg-red-500/10 text-red-200",
                cerrado: "border-neutral-700/70 bg-neutral-900/50 text-neutral-400",
              }[status];

              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="block rounded-3xl border border-neutral-800 bg-neutral-900/20 p-4 hover:bg-neutral-900/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyles}`}
                        >
                          En espera
                        </span>
                      </div>
                      <div className="truncate text-sm font-semibold">
                        {chat.sellerName}
                      </div>
                      <div className="truncate text-xs text-neutral-400">
                        {chat.listingTitle}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-neutral-500">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="mt-3 line-clamp-1 text-sm text-neutral-300">
                    {lastMessageByChat.get(chat.id) ?? "—"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
