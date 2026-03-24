"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, User } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getDefaultAccountProfile,
  getPostAuthDestination,
  readAccountProfile,
  writeAccountProfile,
  type AccountProfile,
} from "@/lib/account-profile";
import { Button } from "@/components/ui/button";

export default function AccountTypePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile>(getDefaultAccountProfile());
  const [loaded, setLoaded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    setProfile(readAccountProfile());
    setLoaded(true);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/settings/account-type");
        if (destination !== "/settings/account-type") {
          router.replace(destination);
        }
      }
    });
    return () => unsub();
  }, [router]);

  const accountType = profile.accountType;
  const isBusiness = accountType === "business";

  const startBusinessOnboarding = () => {
    const nextProfile: AccountProfile = {
      ...profile,
      onboardingCompleted: false,
      pendingBusinessUpgrade: true,
      updatedAt: Date.now(),
    };

    setProfile(nextProfile);
    writeAccountProfile(nextProfile);
    setShowConfirmModal(false);
    router.push("/onboarding?next=%2F&flow=business");
  };

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
        <div className="text-sm font-semibold text-white">Tipo de cuenta</div>
        <div className="h-10 w-10" />
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5">
          <div className="text-lg font-semibold text-white">Administra tu tipo de cuenta</div>
          <p className="mt-2 text-sm text-neutral-400">
            La cuenta personal puede cambiar a empresarial. La cuenta empresarial no puede volver a personal.
          </p>
        </div>

        <AccountTypeRow
          icon={<User className="h-5 w-5" />}
          title="Cuenta personal"
          subtitle="Ideal para comprar y vender como usuario individual."
          checked={accountType === "personal"}
          disabled={isBusiness}
          onToggle={() => {}}
        />

        <AccountTypeRow
          icon={<Building2 className="h-5 w-5" />}
          title="Cuenta empresarial"
          subtitle="Activa verificacion de negocio y herramientas de empresa."
          checked={isBusiness}
          disabled={isBusiness}
          onToggle={() => setShowConfirmModal(true)}
        />

        {loaded && isBusiness ? (
          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-100">
            Tu cuenta esta marcada como empresarial. El cambio a cuenta personal esta deshabilitado.
          </div>
        ) : null}

        {loaded && !isBusiness ? (
          <Button className="mt-2 bg-orange-400 text-black hover:bg-orange-300" onClick={() => setShowConfirmModal(true)}>
            Cambiar a cuenta empresarial
          </Button>
        ) : null}
      </main>

      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-10 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl shadow-black/30">
            <div className="text-lg font-semibold text-white">Estas seguro que quieres ser una cuenta empresarial?</div>
            <p className="mt-2 text-sm text-neutral-400">
              Una vez seas una cuenta empresarial no podras pasar a cuenta personal.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-neutral-800 bg-neutral-950 text-neutral-100 hover:bg-neutral-900"
                onClick={() => setShowConfirmModal(false)}
              >
                No
              </Button>
              <Button type="button" className="flex-1 bg-orange-400 text-black hover:bg-orange-300" onClick={startBusinessOnboarding}>
                Si
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountTypeRow({
  icon,
  title,
  subtitle,
  checked,
  disabled,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-3xl border px-4 py-4",
        disabled ? "border-neutral-800 bg-neutral-900/50 opacity-70" : "border-neutral-800 bg-neutral-900",
      ].join(" ")}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-800 text-neutral-200">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-100">{title}</div>
        <div className="text-xs text-neutral-400">{subtitle}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={[
          "relative h-7 w-12 rounded-full border transition",
          checked ? "border-orange-400 bg-orange-400" : "border-neutral-700 bg-neutral-800",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
