"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import { onAuthStateChanged } from "@/lib/auth-client";
import { useThemeSetting } from "@/components/ThemeProvider";
import { auth } from "@/lib/firebase";
import { getPostAuthDestination, readAccountProfile, writeAccountProfile } from "@/lib/account-profile";
import { appCategories, normalizeCategoryName } from "@/lib/categories";

const MAX_INTERESTS = 8;
const categoryNameMap = new Map(appCategories.map((category) => [normalizeCategoryName(category.name), category.name]));

function resolveSavedInterests(interests: string[]) {
  const resolved: string[] = [];
  const seen = new Set<string>();

  interests.forEach((interest) => {
    const normalized = normalizeCategoryName(interest);
    const categoryName = categoryNameMap.get(normalized);

    if (!categoryName || seen.has(categoryName)) {
      return;
    }

    seen.add(categoryName);
    resolved.push(categoryName);
  });

  return resolved.slice(0, MAX_INTERESTS);
}

function resolveSpecificInterests(interests: string[]) {
  const resolved: string[] = [];
  const seen = new Set<string>();

  interests.forEach((interest) => {
    const value = interest.trim().replace(/\s+/g, " ");
    const normalized = normalizeCategoryName(value);

    if (!value || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    resolved.push(value);
  });

  return resolved;
}

export default function InterestsSettingsPage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
  const isLight = theme === "light";
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [specificInterests, setSpecificInterests] = useState<string[]>([]);
  const [specificInput, setSpecificInput] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/settings/interests");
        if (destination !== "/settings/interests") {
          router.replace(destination);
          return;
        }
      }

      const profile = readAccountProfile();
      setSelected(resolveSavedInterests(profile.interests));
      setSpecificInterests(resolveSpecificInterests(profile.specificInterests));
      setLoaded(true);
    });

    return () => unsub();
  }, [router]);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = normalizeCategoryName(query);
    const selectedSet = new Set(selected);
    const orderedCategories = [
      ...selected
        .map((name) => appCategories.find((category) => category.name === name))
        .filter((category): category is (typeof appCategories)[number] => Boolean(category)),
      ...appCategories.filter((category) => !selectedSet.has(category.name)),
    ];

    if (!normalizedQuery) {
      return orderedCategories;
    }

    return orderedCategories.filter((category) =>
      normalizeCategoryName(category.name).includes(normalizedQuery)
    );
  }, [query, selected]);

  const toggleInterest = (categoryName: string) => {
    setError("");
    setSuccess("");

    setSelected((current) => {
      if (current.includes(categoryName)) {
        return current.filter((item) => item !== categoryName);
      }

      if (current.length >= MAX_INTERESTS) {
        setError(`Solo puedes seleccionar hasta ${MAX_INTERESTS} categorías.`);
        return current;
      }

      return [...current, categoryName];
    });
  };

  const addSpecificInterest = (value: string) => {
    const nextValue = value.trim().replace(/\s+/g, " ");
    if (!nextValue) return;

    setError("");
    setSuccess("");
    setSpecificInterests((current) => resolveSpecificInterests([...current, nextValue]));
    setSpecificInput("");
  };

  const removeSpecificInterest = (value: string) => {
    setError("");
    setSuccess("");
    setSpecificInterests((current) => current.filter((item) => item !== value));
  };

  const handleSave = () => {
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const profile = readAccountProfile();
      const normalizedSelection = resolveSavedInterests(selected);
      const normalizedSpecificInterests = resolveSpecificInterests([
        ...specificInterests,
        specificInput,
      ]);
      writeAccountProfile({
        ...profile,
        interests: normalizedSelection,
        specificInterests: normalizedSpecificInterests,
      });
      setSelected(normalizedSelection);
      setSpecificInterests(normalizedSpecificInterests);
      setSpecificInput("");
      setSuccess("Tus intereses fueron actualizados.");
    } catch {
      setError("No pudimos guardar tus intereses.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div
        className={[
          "interests-settings-page min-h-screen",
          isLight ? "bg-neutral-100 text-slate-950" : "bg-neutral-950 text-neutral-50",
        ].join(" ")}
      />
    );
  }

  return (
    <div
      className={[
        "interests-settings-page min-h-screen",
        isLight ? "bg-neutral-100 text-slate-950" : "bg-neutral-950 text-neutral-50",
      ].join(" ")}
    >
      <header
        className={[
          "fixed inset-x-0 top-0 z-20 border-b px-4 py-4 backdrop-blur",
          isLight ? "border-slate-200 bg-neutral-100/95" : "border-neutral-900 bg-neutral-950/95",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
        <button
          onClick={() => router.back()}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur active:scale-95",
            isLight ? "border-slate-200 bg-white text-slate-950" : "border-neutral-800 bg-neutral-900/80 text-neutral-50",
          ].join(" ")}
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={["text-sm font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Configurar para ti</div>
        <div className="min-w-[40px] text-right text-sm font-semibold text-orange-300">
          {selected.length}/{MAX_INTERESTS}
        </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-40 pt-24">
        <div
          className={[
            "rounded-3xl border p-5",
            isLight ? "border-slate-200 bg-transparent" : "border-neutral-800 bg-neutral-900/60",
          ].join(" ")}
        >
          <div className={["text-lg font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Configurar para ti</div>
          <p className={["mt-2 text-sm leading-6", isLight ? "text-slate-600" : "text-neutral-400"].join(" ")}>
            Seguido de una coma agrega tus intereses. Esto nos ayuda a dar prioridad a lo que realmente te interesa cada vez que entres a Josealo.
          </p>
          <div
            className={[
              "mt-4 flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 focus-within:border-orange-400",
              isLight ? "border-slate-200 bg-transparent" : "border-neutral-800 bg-neutral-950",
            ].join(" ")}
          >
            {specificInterests.map((interest) => (
              <span
                key={interest}
                className={[
                  "inline-flex max-w-full items-center gap-2 rounded-full border border-orange-400/40 bg-orange-400/10 px-3 py-1.5 text-sm font-medium",
                  isLight ? "text-orange-700" : "text-orange-200",
                ].join(" ")}
              >
                <span className="max-w-[13rem] truncate">{interest}</span>
                <button
                  type="button"
                  onClick={() => removeSpecificInterest(interest)}
                  className={[
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition hover:bg-orange-400/20",
                    isLight ? "text-orange-700" : "text-orange-100",
                  ].join(" ")}
                  aria-label={`Eliminar ${interest}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={specificInput}
              onChange={(event) => setSpecificInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addSpecificInterest(specificInput);
                }
              }}
              onBlur={() => addSpecificInterest(specificInput)}
              placeholder={specificInterests.length === 0 ? "Ej. iPhone 17, Hyundai 2026" : "Agregar otro"}
              className={[
                "h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500",
                isLight ? "text-slate-950" : "text-white",
              ].join(" ")}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div className={["h-px flex-1", isLight ? "bg-slate-200" : "bg-neutral-800"].join(" ")} />
          <div className={["text-sm font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Intereses generales</div>
          <div className={["h-px flex-1", isLight ? "bg-slate-200" : "bg-neutral-800"].join(" ")} />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar categorías"
            className={[
              "h-12 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none placeholder:text-neutral-500 focus:border-orange-400",
              isLight ? "border-slate-200 bg-transparent text-slate-950" : "border-neutral-800 bg-neutral-900 text-white",
            ].join(" ")}
          />
        </div>

        <div>
          <div className={["mb-3 text-sm font-semibold", isLight ? "text-slate-950" : "text-white"].join(" ")}>Todas las categorías</div>
          <div className="space-y-3">
            {filteredCategories.map((category) => {
              const active = selected.includes(category.name);

              return (
                <label
                  key={category.id}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-2xl border bg-transparent px-4 py-3 transition",
                    active ? "border-orange-400" : isLight ? "border-slate-200 hover:border-orange-400/60" : "border-neutral-800 hover:border-orange-400/60",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={active ? `Quitar ${category.name}` : `Seleccionar ${category.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      toggleInterest(category.name);
                    }}
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                      active ? "border-orange-400" : isLight ? "border-slate-400" : "border-neutral-600",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full transition",
                        active ? "bg-orange-400" : "bg-transparent",
                      ].join(" ")}
                    />
                  </button>
                  <div className={["flex-1 text-sm font-medium", isLight ? "text-slate-950" : "text-white"].join(" ")}>
                    {category.name}
                  </div>
                </label>
              );
            })}
          </div>
          {filteredCategories.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
              No encontramos categorías con esa búsqueda.
            </div>
          ) : null}
        </div>

      </main>

      <div
        className={[
          "fixed inset-x-0 bottom-0 z-20 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur",
          isLight ? "border-slate-200 bg-white/95" : "border-neutral-800 bg-neutral-950/95",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {error ? (
            <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-green-900/50 bg-green-600/10 p-4 text-sm text-green-600/100">
              {success}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 rounded-2xl bg-orange-400 px-4 text-sm font-semibold text-black hover:bg-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
