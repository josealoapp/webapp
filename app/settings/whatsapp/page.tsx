"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getDefaultAccountProfile,
  getPostAuthDestination,
  getWhatsappContactSettings,
  readAccountProfile,
  writeAccountProfile,
} from "@/lib/account-profile";
import { syncSellerWhatsappAcrossListings } from "@/lib/marketplace";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

export default function WhatsappSettingsPage() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const profile = readAccountProfile();
    const whatsapp = getWhatsappContactSettings(profile);
    setNumber(profile.whatsappPhone || whatsapp.phone);
    setEnabled(profile.useWhatsappForCustomers);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/settings/whatsapp");
        if (destination !== "/settings/whatsapp") {
          router.replace(destination);
        }
      }
    });

    return () => unsub();
  }, [router]);

  const handleSave = async () => {
    if (saving) return;

    const trimmedNumber = number.trim();
    const normalizedNumber = normalizeWhatsappNumber(trimmedNumber);

    if (enabled && !normalizedNumber) {
      setError("Agrega un número de WhatsApp antes de activar esta opción.");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const currentProfile = readAccountProfile();
    const nextProfile = {
      ...getDefaultAccountProfile(),
      ...currentProfile,
      whatsappPhone: trimmedNumber,
      useWhatsappForCustomers: enabled && Boolean(normalizedNumber),
    };

    writeAccountProfile(nextProfile);

    const currentUser = auth.currentUser;

    if (currentUser?.uid) {
      try {
        await syncSellerWhatsappAcrossListings(currentUser.uid, {
          sellerWhatsappNumber: trimmedNumber,
          sellerUsesWhatsapp: enabled && Boolean(normalizedNumber),
        });
      } catch {
        setError("Guardamos la preferencia, pero no pudimos actualizar tus publicaciones actuales.");
        setSaving(false);
        return;
      }
    }

    setSuccess("Configuración de WhatsApp actualizada.");
    setSaving(false);
  };

  if (!loaded) {
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
        <div className="text-sm font-semibold text-white">Connectar con whatsapp</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5">
          <div className="text-lg font-semibold text-white">Configura tu canal de WhatsApp</div>
          <p className="mt-2 text-sm text-neutral-400">
            Si activas esta opción, tus publicaciones mostrarán WhatsApp en lugar de Mensaje.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-neutral-100">Número de WhatsApp</span>
          <input
            type="tel"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              setError("");
              setSuccess("");
            }}
            placeholder="Ej. +1 809 555 1234"
            className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <div className="flex items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900 px-4 py-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-neutral-100">Usar mi whatsapp para comunicarme con mis clientes</div>
            <div className="mt-1 text-xs text-neutral-400">
              Los compradores serán enviados directamente a tu chat de WhatsApp.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Usar mi whatsapp para comunicarme con mis clientes"
            onClick={() => {
              setEnabled((current) => !current);
              setError("");
              setSuccess("");
            }}
            className={[
              "relative h-7 w-12 rounded-full border transition",
              enabled ? "border-orange-400 bg-orange-400" : "border-neutral-700 bg-neutral-800",
            ].join(" ")}
          >
            <span
              className={[
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition",
                enabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-2 h-12 rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </main>
    </div>
  );
}
