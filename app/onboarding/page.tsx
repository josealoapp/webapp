"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Check, ChevronDown, ChevronUp, Circle, CircleCheck, Search, Store } from "lucide-react";
import { Country, State } from "country-state-city";
import { auth } from "@/lib/firebase";
import { appCategories } from "@/lib/categories";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BUSINESS_PROFILE,
  type AccountType,
  type BusinessProfile,
  readAccountProfile,
  writeAccountProfile,
} from "@/lib/account-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppSkeleton } from "@/components/AppSkeleton";

const BUSINESS_VERIFICATION_MESSAGE =
  "Te estaremos contactando en los proximos 7 a 14 dias laborales para verificar tu cuenta y colocarte la marca de perfil verificado.";

type Step = "accountType" | "personalInterests" | "businessDetails" | "businessVerification";

type CountryOption = {
  isoCode: string;
  name: string;
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingFallback() {
  return <AppSkeleton variant="auth" />;
}

function OnboardingContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp.get("next") || "/", [sp]);
  const requestedFlow = useMemo(() => sp.get("flow") || "", [sp]);
  const [authResolved, setAuthResolved] = useState(false);
  const [step, setStep] = useState<Step>("accountType");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [interests, setInterests] = useState<string[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [error, setError] = useState("");
  const [businessCategoryOpen, setBusinessCategoryOpen] = useState(false);
  const [businessCategoryQuery, setBusinessCategoryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [provinceOpen, setProvinceOpen] = useState(false);
  const businessCategoryRef = useRef<HTMLDivElement | null>(null);
  const countryRef = useRef<HTMLDivElement | null>(null);
  const provinceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace(`/sign-in?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (!user.emailVerified) {
        router.replace(`/verify-email?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const profile = readAccountProfile();
      if (profile.onboardingCompleted) {
        router.replace(nextPath);
        return;
      }

      if (profile.accountType === "business" || profile.pendingBusinessUpgrade || requestedFlow === "business") {
        setAccountType("business");
        setStep("businessDetails");
        if (profile.businessProfile) {
          setBusinessProfile(profile.businessProfile);
        }
      } else {
        setAccountType(profile.accountType);
        setInterests(profile.interests);
      }

      setAuthResolved(true);
    });

    return () => unsub();
  }, [nextPath, requestedFlow, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (businessCategoryRef.current && !businessCategoryRef.current.contains(target)) {
        setBusinessCategoryOpen(false);
      }

      if (countryRef.current && !countryRef.current.contains(target)) {
        setCountryOpen(false);
      }

      if (provinceRef.current && !provinceRef.current.contains(target)) {
        setProvinceOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleProgress = useMemo(() => {
    if (step === "businessDetails" || step === "businessVerification") {
      return ["accountType", "businessDetails", "businessVerification"] as Step[];
    }

    return ["accountType", "personalInterests"] as Step[];
  }, [step]);

  const regionNames = useMemo(() => new Intl.DisplayNames(["es"], { type: "region" }), []);
  const countryOptions = useMemo<CountryOption[]>(
    () =>
      Country.getAllCountries()
        .map((country) => ({
          isoCode: country.isoCode,
          name: regionNames.of(country.isoCode) || country.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [regionNames]
  );
  const selectedCountryOption = useMemo(
    () => countryOptions.find((country) => normalizeText(country.name) === normalizeText(businessProfile.country)),
    [businessProfile.country, countryOptions]
  );
  const provinceOptions = useMemo(() => {
    if (!selectedCountryOption) return [];

    return State.getStatesOfCountry(selectedCountryOption.isoCode)
      .map((state) => state.name.replace(/ Province$/i, "").trim())
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [selectedCountryOption]);
  const currentProgressIndex = visibleProgress.findIndex((item) => item === step);
  const filteredBusinessCategories = appCategories.filter((category) =>
    normalizeText(category.name).includes(normalizeText(businessCategoryQuery.trim()))
  );
  const filteredCountries = countryOptions.filter((country) =>
    normalizeText(country.name).includes(normalizeText(countryQuery.trim()))
  );

  const finishPersonalOnboarding = () => {
    const currentProfile = readAccountProfile();
    writeAccountProfile({
      ...currentProfile,
      accountType: "personal",
      onboardingCompleted: true,
      pendingBusinessUpgrade: false,
      interests,
      businessProfile: null,
      businessVerificationPending: false,
      businessVerificationMessage: null,
      updatedAt: Date.now(),
    });
    router.replace(nextPath);
  };

  const finishBusinessStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanedProfile: BusinessProfile = {
      businessName: businessProfile.businessName.trim(),
      country: businessProfile.country.trim(),
      province: businessProfile.province.trim(),
      hasPhysicalStore: businessProfile.hasPhysicalStore,
      storeAddress: businessProfile.storeAddress.trim(),
      whatsapp: businessProfile.whatsapp.trim(),
      categories: businessProfile.categories,
      rnc: businessProfile.rnc.trim(),
      email: businessProfile.email.trim(),
    };

    if (!cleanedProfile.businessName) {
      setError("Ingresa el nombre de tu negocio.");
      return;
    }

    if (!cleanedProfile.country) {
      setError("Selecciona el pais.");
      return;
    }

    if (!cleanedProfile.province) {
      setError("Selecciona la provincia.");
      return;
    }

    if (cleanedProfile.hasPhysicalStore && !cleanedProfile.storeAddress) {
      setError("Ingresa la direccion de tu tienda.");
      return;
    }

    if (!cleanedProfile.whatsapp) {
      setError("Ingresa tu numero de WhatsApp.");
      return;
    }

    if (cleanedProfile.categories.length === 0) {
      setError("Selecciona al menos una categoria.");
      return;
    }

    if (!cleanedProfile.rnc) {
      setError("Ingresa el codigo RNC.");
      return;
    }

    if (!cleanedProfile.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedProfile.email)) {
      setError("Ingresa un correo electronico valido.");
      return;
    }

    setBusinessProfile(cleanedProfile);
    const currentProfile = readAccountProfile();
    writeAccountProfile({
      ...currentProfile,
      accountType: "business",
      onboardingCompleted: true,
      pendingBusinessUpgrade: false,
      interests: [],
      businessProfile: cleanedProfile,
      businessVerificationPending: true,
      businessVerificationMessage: BUSINESS_VERIFICATION_MESSAGE,
      updatedAt: Date.now(),
    });
    setStep("businessVerification");
  };

  if (!authResolved) {
    return <OnboardingFallback />;
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 px-4 py-8 text-neutral-100">
      <div className="mx-auto w-full max-w-md lg:max-w-2xl">
        <div className="mb-5 flex gap-2">
          {visibleProgress.map((progressStep, index) => (
            <div
              key={progressStep}
              className={[
                "h-1.5 flex-1 rounded-full transition",
                index <= currentProgressIndex ? "bg-orange-400" : "bg-neutral-800",
              ].join(" ")}
            />
          ))}
        </div>

        <Card className="border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/20">
          {step === "accountType" ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl leading-tight sm:text-3xl lg:text-4xl">
                  Que tipo de cuenta te gustaria tener en JOSEALO?
                </CardTitle>
                <CardDescription className="text-sm text-neutral-400 sm:text-base">
                  Elige como quieres comenzar tu experiencia dentro de la app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioCard
                  title="Cuenta personal"
                  subtitle="Compra, vende y personaliza tu inicio con tus intereses."
                  checked={accountType === "personal"}
                  onClick={() => setAccountType("personal")}
                />
                <RadioCard
                  title="Cuenta empresarial"
                  subtitle="Solicita verificacion para tu negocio y vende con perfil de empresa."
                  checked={accountType === "business"}
                  onClick={() => setAccountType("business")}
                />

                <Button
                  type="button"
                  className="w-full bg-orange-400 text-black hover:bg-orange-300"
                  onClick={() => {
                    setError("");
                    setStep(accountType === "personal" ? "personalInterests" : "businessDetails");
                  }}
                >
                  Continuar
                </Button>
              </CardContent>
            </>
          ) : null}

          {step === "personalInterests" ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl leading-tight sm:text-3xl lg:text-4xl">Cuales son tus intereses?</CardTitle>
                <CardDescription className="text-sm text-neutral-400 sm:text-base">
                  Selecciona las categorias que mas te interesan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  {appCategories.map((category) => {
                    const selected = interests.includes(category.name);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          setInterests((current) =>
                            current.includes(category.name)
                              ? current.filter((item) => item !== category.name)
                              : [...current, category.name]
                          )
                        }
                        className={[
                          "rounded-full border px-4 py-2 text-sm font-medium transition",
                          selected
                            ? "border-orange-400 bg-orange-400 text-black"
                            : "border-neutral-800 bg-neutral-900 text-neutral-200 hover:border-neutral-600",
                        ].join(" ")}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>

                {error ? <InlineError message={error} /> : null}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-neutral-800 bg-neutral-950 text-neutral-100 hover:bg-neutral-900"
                    onClick={() => setStep("accountType")}
                  >
                    Atras
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-orange-400 text-black hover:bg-orange-300"
                    disabled={interests.length === 0}
                    onClick={finishPersonalOnboarding}
                  >
                    Finalizar
                  </Button>
                </div>
              </CardContent>
            </>
          ) : null}

          {step === "businessDetails" ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl leading-tight sm:text-3xl lg:text-4xl">Sobre tu negocio</CardTitle>
                <CardDescription className="text-sm text-neutral-400 sm:text-base">
                  Completa la informacion para continuar con tu cuenta empresarial.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={finishBusinessStep} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Nombre de tu negocio</Label>
                    <Input
                      id="businessName"
                      value={businessProfile.businessName}
                      onChange={(e) => setBusinessProfile((current) => ({ ...current, businessName: e.target.value }))}
                      placeholder="Ej: Tienda Josealo"
                      className="border-neutral-800 bg-neutral-950"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <Label htmlFor="businessCountry">Pais</Label>
                      <div ref={countryRef} className="relative">
                        <Button
                          id="businessCountry"
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-12 w-full justify-between rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm font-normal text-neutral-100 hover:bg-neutral-900 hover:text-neutral-100",
                            countryOpen && "border-orange-400 ring-2 ring-orange-400/20"
                          )}
                          onClick={() => setCountryOpen((current) => !current)}
                        >
                          <span className={businessProfile.country ? "text-neutral-100" : "text-neutral-500"}>
                            {businessProfile.country || "Selecciona un pais"}
                          </span>
                          {countryOpen ? (
                            <ChevronUp className="h-4 w-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400" />
                          )}
                        </Button>

                        {countryOpen ? (
                          <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/30">
                            <div className="border-b border-neutral-800 p-3">
                              <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                                <Input
                                  value={countryQuery}
                                  onChange={(e) => setCountryQuery(e.target.value)}
                                  placeholder="Buscar pais"
                                  className="h-11 rounded-2xl border-neutral-800 bg-neutral-950 pl-10 pr-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                                />
                              </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto py-2">
                              {filteredCountries.map((country) => (
                                <Button
                                  key={country.isoCode}
                                  type="button"
                                  variant="ghost"
                                  className={cn(
                                    "h-auto w-full justify-start rounded-none px-4 py-3 text-sm text-neutral-100 hover:bg-neutral-800/70",
                                    normalizeText(businessProfile.country) === normalizeText(country.name) &&
                                      "bg-neutral-800/70 text-orange-300 hover:text-orange-300"
                                  )}
                                  onClick={() => {
                                    setBusinessProfile((current) => ({
                                      ...current,
                                      country: country.name,
                                      province: "",
                                    }));
                                    setCountryOpen(false);
                                    setCountryQuery("");
                                  }}
                                >
                                  {country.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label className="space-y-2">
                      <Label htmlFor="businessProvince">Provincia</Label>
                      <div ref={provinceRef} className="relative">
                        <Button
                          id="businessProvince"
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-12 w-full justify-between rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm font-normal text-neutral-100 hover:bg-neutral-900 hover:text-neutral-100",
                            provinceOpen && "border-orange-400 ring-2 ring-orange-400/20"
                          )}
                          onClick={() => setProvinceOpen((current) => !current)}
                        >
                          <span className={businessProfile.province ? "text-neutral-100" : "text-neutral-500"}>
                            {businessProfile.province || "Selecciona una provincia"}
                          </span>
                          {provinceOpen ? (
                            <ChevronUp className="h-4 w-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400" />
                          )}
                        </Button>

                        {provinceOpen ? (
                          <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 max-h-72 overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-900 py-2 shadow-2xl shadow-black/30">
                            {provinceOptions.length === 0 ? (
                              <div className="px-4 py-6 text-sm text-neutral-400">
                                No hay provincias o estados disponibles para este pais.
                              </div>
                            ) : (
                              provinceOptions.map((province) => (
                                <Button
                                  key={province}
                                  type="button"
                                  variant="ghost"
                                  className={cn(
                                    "h-auto w-full justify-start rounded-none px-4 py-3 text-sm text-neutral-100 hover:bg-neutral-800/70",
                                    businessProfile.province === province && "bg-neutral-800/70 text-orange-300 hover:text-orange-300"
                                  )}
                                  onClick={() => {
                                    setBusinessProfile((current) => ({ ...current, province }));
                                    setProvinceOpen(false);
                                  }}
                                >
                                  {province}
                                </Button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <Label>Tienes tienda fisica?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <ToggleOption
                        label="Si"
                        active={businessProfile.hasPhysicalStore}
                        onClick={() => setBusinessProfile((current) => ({ ...current, hasPhysicalStore: true }))}
                      />
                      <ToggleOption
                        label="No"
                        active={!businessProfile.hasPhysicalStore}
                        onClick={() =>
                          setBusinessProfile((current) => ({
                            ...current,
                            hasPhysicalStore: false,
                            storeAddress: "",
                          }))
                        }
                      />
                    </div>
                  </div>

                  {businessProfile.hasPhysicalStore ? (
                    <div className="space-y-2">
                      <Label htmlFor="storeAddress">Direccion de tienda</Label>
                      <Input
                        id="storeAddress"
                        value={businessProfile.storeAddress}
                        onChange={(e) => setBusinessProfile((current) => ({ ...current, storeAddress: e.target.value }))}
                        placeholder="Direccion de la tienda"
                        className="border-neutral-800 bg-neutral-950"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">Numero de WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={businessProfile.whatsapp}
                      onChange={(e) => setBusinessProfile((current) => ({ ...current, whatsapp: e.target.value }))}
                      placeholder="809 000 0000"
                      className="border-neutral-800 bg-neutral-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessCategories">Categoria de negocios</Label>
                    <div ref={businessCategoryRef} className="relative">
                      <Button
                        id="businessCategories"
                        type="button"
                        variant="outline"
                        onClick={() => setBusinessCategoryOpen((current) => !current)}
                        className={[
                          "h-auto w-full justify-between rounded-2xl px-4 py-3 text-left text-sm font-normal shadow-sm transition",
                          businessCategoryOpen
                            ? "border-orange-400 bg-neutral-900 ring-2 ring-orange-400/20"
                            : "border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900",
                        ].join(" ")}
                      >
                        <span className={businessProfile.categories.length ? "text-neutral-100" : "text-neutral-500"}>
                          {businessProfile.categories.length
                            ? `${businessProfile.categories.length} seleccionada${businessProfile.categories.length > 1 ? "s" : ""}`
                            : "Selecciona categorias"}
                        </span>
                        {businessCategoryOpen ? (
                          <ChevronUp className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        )}
                      </Button>

                      {businessCategoryOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/30">
                          <div className="border-b border-neutral-800 p-3">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                              <Input
                                value={businessCategoryQuery}
                                onChange={(e) => setBusinessCategoryQuery(e.target.value)}
                                placeholder="Buscar"
                                className="h-11 rounded-2xl border-neutral-800 bg-neutral-950 pl-10 pr-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                              />
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto py-2">
                            {filteredBusinessCategories.length === 0 ? (
                              <div className="px-4 py-6 text-sm text-neutral-400">
                                No encontramos categorias.
                              </div>
                            ) : (
                              filteredBusinessCategories.map((category) => {
                                const selected = businessProfile.categories.includes(category.name);

                                return (
                                  <Button
                                    key={category.id}
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      setBusinessProfile((current) => ({
                                        ...current,
                                        categories: selected
                                          ? current.categories.filter((item) => item !== category.name)
                                          : [...current.categories, category.name],
                                      }))
                                    }
                                    className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left text-sm font-normal text-neutral-100 hover:bg-neutral-800/70"
                                  >
                                    <span
                                      className={[
                                        "flex h-5 w-5 items-center justify-center rounded-md border transition",
                                        selected
                                          ? "border-orange-400 bg-orange-400 text-black"
                                          : "border-neutral-600 bg-transparent text-transparent",
                                      ].join(" ")}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="text-sm text-neutral-100">{category.name}</span>
                                  </Button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-500">Puedes seleccionar multiples categorias.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rnc">Codigo RNC</Label>
                    <Input
                      id="rnc"
                      value={businessProfile.rnc}
                      onChange={(e) => setBusinessProfile((current) => ({ ...current, rnc: e.target.value }))}
                      placeholder="Tu codigo RNC"
                      className="border-neutral-800 bg-neutral-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">Correo electronico</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      value={businessProfile.email}
                      onChange={(e) => setBusinessProfile((current) => ({ ...current, email: e.target.value }))}
                      placeholder="negocio@correo.com"
                      className="border-neutral-800 bg-neutral-950"
                    />
                  </div>

                  {error ? <InlineError message={error} /> : null}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-neutral-800 bg-neutral-950 text-neutral-100 hover:bg-neutral-900"
                      onClick={() => setStep("accountType")}
                    >
                      Atras
                    </Button>
                    <Button type="submit" className="flex-1 bg-orange-400 text-black hover:bg-orange-300">
                      Continuar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          ) : null}

          {step === "businessVerification" ? (
            <>
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/30 bg-orange-400/10 text-orange-300">
                  <Store className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl leading-tight sm:text-3xl lg:text-4xl">Verificacion de cuenta</CardTitle>
                <CardDescription className="text-sm text-neutral-400 sm:text-base">
                  {BUSINESS_VERIFICATION_MESSAGE}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  className="w-full bg-orange-400 text-black hover:bg-orange-300"
                  onClick={() => router.replace(nextPath)}
                >
                  Ir al inicio
                </Button>
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">{message}</div>;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function RadioCard({
  title,
  subtitle,
  checked,
  onClick,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={[
        "h-auto w-full items-start justify-start gap-3 rounded-2xl px-4 py-4 text-left transition whitespace-normal",
        checked
          ? "border-orange-400 bg-orange-400/10"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-900",
      ].join(" ")}
    >
      <div className="shrink-0 pt-0.5 text-orange-300">
        {checked ? <CircleCheck className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold leading-6 text-neutral-100 sm:text-base">{title}</div>
        <div className="mt-1 break-words text-sm leading-6 text-neutral-400 sm:text-base">{subtitle}</div>
      </div>
    </Button>
  );
}

function ToggleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={[
        "h-12 rounded-2xl border px-4 text-sm font-semibold transition",
        active
          ? "border-white bg-white text-black hover:bg-white/95"
          : "border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-neutral-700 hover:bg-neutral-900",
      ].join(" ")}
    >
      {label}
    </Button>
  );
}
