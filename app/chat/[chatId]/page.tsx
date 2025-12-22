"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMessage,
  getChats,
  getChatMessages,
  uid,
  Chat,
} from "@/lib/storage";
import { ArrowLeft, Send } from "lucide-react";

export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;

  const [chat, setChat] = useState<Chat | null>(null);
  const [text, setText] = useState("");
  const [messagesTick, setMessagesTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const found = getChats().find((c) => c.id === chatId) ?? null;
    setChat(found);
  }, [chatId]);

  const messages = useMemo(() => {
    return getChatMessages(chatId);
  }, [chatId, messagesTick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    addMessage({
      id: uid("msg"),
      chatId,
      sender: "buyer",
      text: trimmed,
      createdAt: Date.now(),
    });

    setText("");
    setMessagesTick((t) => t + 1);

    // (MVP) Simulación opcional: respuesta automática del vendedor
    setTimeout(() => {
      addMessage({
        id: uid("msg"),
        chatId,
        sender: "seller",
        text: "¡Dale! Dime qué detalles necesitas y coordinamos 👌",
        createdAt: Date.now(),
      });
      setMessagesTick((t) => t + 1);
    }, 900);
  };

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
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/messages"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 hover:bg-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{chat.sellerName}</div>
            <div className="truncate text-xs text-neutral-400">{chat.listingTitle}</div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-3xl px-4 py-4 pb-28">
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={[
                "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.sender === "buyer"
                  ? "ml-auto bg-white text-neutral-950"
                  : "mr-auto bg-neutral-900/40 border border-neutral-800 text-neutral-100",
              ].join(" ")}
            >
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
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
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950 hover:opacity-90"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
