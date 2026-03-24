"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  addChatMessage,
  ChatRecord,
  MessageRecord,
  subscribeChatById,
  subscribeMessagesForChat,
} from "@/lib/marketplace";
import { getPostAuthDestination } from "@/lib/account-profile";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;

  const [chat, setChat] = useState<ChatRecord | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [text, setText] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [authResolved, setAuthResolved] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
        setMessages(rows);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!currentUserId) return;
    if (!chat) return;

    const senderRole = currentUserId === chat.sellerId ? "seller" : "buyer";

    setScreenError("");
    setSending(true);

    try {
      await addChatMessage({
        chatId,
        senderId: currentUserId,
        senderRole,
        text: trimmed,
      });

      setText("");
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

  const counterpartName =
    chat && currentUserId === chat.sellerId ? chat.buyerName : chat?.sellerName;

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
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/messages"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-800 hover:bg-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{counterpartName}</div>
            <div className="truncate text-xs text-neutral-400">{chat.listingTitle}</div>
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
          {messages.map((m) => (
            <div
              key={m.id}
              className={[
                "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.senderId === currentUserId
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
            disabled={sending}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950 hover:opacity-90 disabled:opacity-60"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
