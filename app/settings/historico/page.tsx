"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination } from "@/lib/account-profile";
import { getListingHistoryDate, isListingInHistory, Listing, subscribeListings } from "@/lib/marketplace";

export default function HistoricPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState("");
  const [authResolved, setAuthResolved] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        if (user.emailVerified) {
          const destination = getPostAuthDestination("/settings/historico");
          if (destination !== "/settings/historico") {
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
      router.replace(`/sign-in?next=${encodeURIComponent("/settings/historico")}`);
    }
  }, [authResolved, currentUserId, router]);

  useEffect(() => {
    if (!currentUserId) return;
    const unsub = subscribeListings((rows) => setListings(rows));
    return () => unsub();
  }, [currentUserId]);

  const soldListings = useMemo(
    () =>
      listings
        .filter((item) => item.ownerId === currentUserId && isListingInHistory(item))
        .sort((a, b) => getListingHistoryDate(b) - getListingHistoryDate(a)),
    [currentUserId, listings]
  );

  if (!authResolved || !currentUserId) {
    return <div className="min-h-screen bg-neutral-950 text-neutral-50" />;
  }

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
        <div className="text-sm font-semibold text-white">Historico</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        {soldListings.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
            Aún no tienes publicaciones vendidas en tu histórico.
          </div>
        ) : (
          soldListings.map((item) => {
            const republishParams = new URLSearchParams({
              title: item.title,
              price: String(item.price),
              category: item.category,
              description: item.description,
              tags: item.tags.join(", "),
              paymentMethod: item.paymentMethod,
              location: item.location,
            });

            return (
              <div key={item.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <Link href={`/item/${item.id}`} className="block">
                  <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
                  <div className="mt-1 text-sm text-orange-400">RD${item.price.toLocaleString()}</div>
                  <div className="mt-2 text-xs text-neutral-400">{item.category} · {item.location}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Vendida {getListingHistoryDate(item) ? new Date(getListingHistoryDate(item)).toLocaleDateString() : ""}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => router.push(`/item/new?${republishParams.toString()}`)}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Publicar de nuevo
                </button>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
