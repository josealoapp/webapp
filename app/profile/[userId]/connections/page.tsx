"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { subscribeFollowers, subscribeFollowing } from "@/lib/follows";
import { getOrCreateUserHandle } from "@/lib/user-handle";

type ConnectionRow = {
  id: string;
  profileId: string;
  profileName: string;
  createdAt: number;
};

export default function ProfileConnectionsPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params?.userId || "";
  const tab = searchParams.get("tab") === "following" ? "following" : "followers";
  const profileName = searchParams.get("name")?.trim() || "Usuario";
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ConnectionRow[]>([]);

  useEffect(() => {
    if (!userId) return;

    const unsub =
      tab === "followers"
        ? subscribeFollowers(userId, (items) =>
            setRows(
              items.map((item) => ({
                id: item.id,
                profileId: item.followerId,
                profileName: item.followerName,
                createdAt: item.createdAt,
              }))
            )
          )
        : subscribeFollowing(userId, (items) =>
            setRows(
              items.map((item) => ({
                id: item.id,
                profileId: item.followeeId,
                profileName: item.followeeName,
                createdAt: item.createdAt,
              }))
            )
          );

    return () => unsub();
  }, [tab, userId]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      const handle = getOrCreateUserHandle({ uid: row.profileId, name: row.profileName }).toLowerCase();
      return row.profileName.toLowerCase().includes(normalizedQuery) || handle.includes(normalizedQuery);
    });
  }, [query, rows]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-100"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                {tab === "followers" ? "Seguidores" : "Siguiendo"}
              </div>
              <div className="truncate text-xs text-neutral-400">{profileName}</div>
            </div>
          </div>

          <div className="relative mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar en ${tab === "followers" ? "seguidores" : "siguiendo"}`}
              className="w-full rounded-full border border-neutral-800 bg-neutral-900 px-4 py-3 pr-12 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-orange-400"
            />
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-5">
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
            {query.trim()
              ? "No encontramos perfiles con esa búsqueda."
              : `Esta lista de ${tab === "followers" ? "seguidores" : "siguiendo"} está vacía.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const handle = getOrCreateUserHandle({ uid: row.profileId, name: row.profileName });

              return (
                <Link
                  key={row.id}
                  href={`/profile/${row.profileId}?name=${encodeURIComponent(row.profileName)}`}
                  className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-100">{row.profileName}</div>
                    <div className="mt-1 text-xs text-neutral-400">@{handle}</div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ""}
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
