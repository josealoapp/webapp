"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ImagePlus, Link as LinkIcon, Trash2 } from "lucide-react";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optimizeListingImage } from "@/lib/image-upload";
import type { MarketplaceAd } from "@/lib/marketplace-ads";

export default function AdminAdsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ads, setAds] = useState<MarketplaceAd[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/auth/session`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { authenticated: boolean };
        if (!payload.authenticated) router.replace("/admin/sign-in");
      })
      .catch(() => router.replace("/admin/sign-in"));
  }, [router]);

  useEffect(() => {
    fetch("/api/admin/ads", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("admin/ads-failed");
        const payload = (await response.json()) as { ads?: MarketplaceAd[] };
        setAds(payload.ads || []);
      })
      .catch(() => setAds([]));
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const canPublish = useMemo(
    () => Boolean(selectedFile && campaignName.trim() && startDate && endDate && linkUrl.trim() && !submitting),
    [campaignName, endDate, linkUrl, selectedFile, startDate, submitting]
  );

  const handleFile = (file?: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setError("");
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] || null);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0] || null);
  };

  const resetForm = () => {
    setCampaignName("");
    setStartDate("");
    setEndDate("");
    setLinkUrl("");
    setSelectedFile(null);
    setError("");
  };

  const publishAd = async () => {
    if (!canPublish || !selectedFile) return;
    setSubmitting(true);
    setError("");

    try {
      const optimizedFile = await optimizeListingImage(selectedFile, 0);
      const formData = new FormData();
      formData.append("image", optimizedFile);
      formData.append("campaignName", campaignName.trim());
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("linkUrl", linkUrl.trim());

      const response = await fetch("/api/admin/ads", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { ad?: MarketplaceAd; error?: string } | null;
      if (!response.ok || !payload?.ad) {
        throw new Error(payload?.error || "No pudimos publicar la campaña.");
      }

      setAds((current) => [payload.ad as MarketplaceAd, ...current]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos publicar la campaña.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeAd = async (adId: string) => {
    await fetch("/api/admin/ads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId }),
    });
    setAds((current) => current.filter((ad) => ad.id !== adId));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="text-lg font-semibold">Ads</div>
          <div className="mt-1 text-sm text-neutral-400">Administra las imágenes del carousel del marketplace.</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-28 pt-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="text-lg font-semibold">Nueva campaña</div>
          <div className="mt-1 text-sm text-neutral-400">La imagen publicada se reflejará en el carousel del marketplace.</div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              "mt-5 flex aspect-[16/5] w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed bg-neutral-950 text-center transition",
              dragging ? "border-orange-400" : "border-neutral-700 hover:border-orange-400",
            ].join(" ")}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
            ) : (
              <>
                <ImagePlus className="h-8 w-8 text-orange-400" />
                <div className="mt-3 text-sm font-semibold text-neutral-100">Arrastra una imagen o toca para subir</div>
                <div className="mt-1 text-xs text-neutral-500">Recomendado: 1152 x 180 o mayor, formato horizontal.</div>
              </>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileInput} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <Label>Nombre de campaña</Label>
              <Input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Ej. Semana de ofertas"
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950"
              />
            </label>
            <label className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950"
              />
            </label>
            <label className="space-y-2">
              <Label>Fecha de cierre</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-12 rounded-2xl border-neutral-800 bg-neutral-950"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <Label>Link</Label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://..."
                  className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 pl-11"
                />
              </div>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={publishAd}
            disabled={!canPublish}
            className="mt-5 h-12 w-full rounded-2xl bg-orange-400 text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
          >
            {submitting ? "Publicando..." : "Publicar"}
          </Button>
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="text-lg font-semibold">Campañas publicadas</div>
          <div className="mt-4 space-y-3">
            {ads.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                No hay campañas publicadas.
              </div>
            ) : ads.map((ad) => (
              <div key={ad.id} className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70">
                <img src={ad.imageUrl} alt={ad.campaignName} className="h-28 w-full object-cover" />
                <div className="p-4">
                  <div className="truncate text-sm font-semibold text-neutral-100">{ad.campaignName}</div>
                  <div className="mt-1 text-xs text-neutral-500">{ad.startDate} - {ad.endDate}</div>
                  <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-orange-300">
                    {ad.linkUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAd(ad.id)}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AdminBottomNav active="ads" />
    </div>
  );
}
