"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Paperclip } from "lucide-react";

export default function FeedbackPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

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
        <div className="text-sm font-semibold text-white">Feedback</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs text-neutral-300">
          Ayúdanos a mejorar. Comparte ideas o reporta algo que no funcione.
        </div>

        <form className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Título</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Idea para mejorar la búsqueda"
              className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs text-neutral-400">Mensaje</span>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntanos más detalles..."
              className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            />
          </label>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200 hover:border-orange-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            <Paperclip className="h-4 w-4" />
            Adjuntar imagen
          </button>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
        <div className="mx-auto max-w-md px-6 py-4">
          <button
            type="button"
            className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
