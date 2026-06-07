"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, ImagePlus, Info, Plus, Search } from "lucide-react";
import { auth } from "@/lib/firebase";
import { createListing, getListingById, updateListing, uploadListingImages } from "@/lib/marketplace";
import { getPostAuthDestination, getWhatsappContactSettings, readAccountProfile } from "@/lib/account-profile";
import {
  appCategories,
  getCategoryInputKind,
  normalizeCategoryName,
  type CategoryInputKind,
  sortCategoriesByInterest,
} from "@/lib/categories";
import { requestCurrentSupportedLocation } from "@/lib/location";
import { readProfileAvatar } from "@/lib/profile-avatar";
import { BAZAR_DURATION_OPTIONS } from "@/lib/bazar-duration";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const maxArticlePhotos = 10;
const maxBazarItems = 20;

type DraftBazarItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  vehicleYear?: string;
  clothingSize?: string;
  shoeSize?: string;
  file?: File | null;
  previewUrl: string;
  imageUrl?: string;
};

const paymentOptions: Array<{ id: "efectivo" | "intercambio" | "transferencia"; label: string }> = [
  { id: "efectivo", label: "Efectivo" },
  { id: "intercambio", label: "Intercambio" },
  { id: "transferencia", label: "Transferencia" },
];

const normalizedCategoryMap = new Map(
  appCategories.map((category) => [normalizeCategoryName(category.name), category.name] as const)
);

function resolveCategoryName(value: string) {
  return normalizedCategoryMap.get(normalizeCategoryName(value)) || "";
}

const predictiveCategoryRules = [
  {
    category: "Celulares y smartphones",
    keywords: [
      "iphone",
      "samsung",
      "galaxy",
      "motorola",
      "xiaomi",
      "redmi",
      "huawei",
      "oppo",
      "pixel",
      "celular",
      "smartphone",
      "telefono",
    ],
  },
  {
    category: "Ropa para hombres",
    keywords: [
      "tshirt",
      "t-shirt",
      "camisa",
      "camiseta",
      "polo",
      "pantalon",
      "jean",
      "zara",
      "h&m",
      "vestido",
      "falda",
      "blusa",
    ],
  },
  {
    category: "Zapatos",
    keywords: [
      "zapato",
      "zapatos",
      "tenis",
      "sneakers",
      "botas",
      "sandalias",
      "tacones",
      "nike",
      "adidas",
      "jordan",
      "crocs",
    ],
  },
  {
    category: "Vehículos",
    keywords: [
      "carro",
      "auto",
      "vehiculo",
      "toyota",
      "honda",
      "hyundai",
      "kia",
      "nissan",
      "jeep",
      "bmw",
      "mercedes",
      "ford",
    ],
  },
  {
    category: "Propiedades en venta",
    keywords: [
      "casa",
      "apartamento",
      "solar",
      "terreno",
      "villa",
      "local",
      "propiedad",
      "penthouse",
      "residencial",
      "finca",
      "lote",
    ],
  },
];

function predictCategoryFromTitle(value: string) {
  const normalized = normalizeCategoryName(value);
  if (!normalized) return "";
  const padded = ` ${normalized} `;
  const words = normalized.split(/\s+/).filter(Boolean);

  return (
    predictiveCategoryRules.find((rule) =>
      rule.keywords.some((keyword) => {
        const normalizedKeyword = normalizeCategoryName(keyword);
        if (padded.includes(` ${normalizedKeyword} `)) return true;
        if (normalizedKeyword.length < 5) return false;

        return words.some((word) => {
          if (word.length < 5) return false;
          return getEditDistance(word, normalizedKeyword) <= 1;
        });
      })
    )?.category || ""
  );
}

function getEditDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1]
          : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1;
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function CategorySuggestField({
  label,
  value,
  options,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  error?: string | null;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const exactMatches = options.filter((option) => option.toLowerCase().startsWith(query));
    const partialMatches = options.filter(
      (option) => !exactMatches.includes(option) && option.toLowerCase().includes(query)
    );
    const matches = query ? [...exactMatches, ...partialMatches] : options;
    return matches.slice(0, 8);
  }, [options, value]);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs text-neutral-400">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-6 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) {
              event.preventDefault();
              onChange(suggestions[0]);
              setOpen(false);
            }
          }}
          className="h-12 w-full rounded-2xl border border-neutral-800 bg-neutral-900 pl-11 pr-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
        />
        {open && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            {suggestions.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center px-4 py-3 text-left text-sm transition",
                  option === value
                    ? "bg-orange-400/10 text-orange-300"
                    : "text-neutral-200 hover:bg-neutral-900 hover:text-white",
                ].join(" ")}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <span className="text-xs text-orange-400">{error}</span> : null}
    </label>
  );
}

function CategoryMetadataFields({
  kind,
  vehicleYear,
  clothingSize,
  shoeSize,
  inputSurfaceClassName,
  onVehicleYearChange,
  onClothingSizeChange,
  onShoeSizeChange,
}: {
  kind: CategoryInputKind;
  vehicleYear: string;
  clothingSize: string;
  shoeSize: string;
  inputSurfaceClassName: string;
  onVehicleYearChange: (value: string) => void;
  onClothingSizeChange: (value: string) => void;
  onShoeSizeChange: (value: string) => void;
}) {
  if (kind === "vehicle") {
    return (
      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-400">Año del vehículo</span>
        <input
          type="number"
          inputMode="numeric"
          min="1900"
          max="2026"
          placeholder="Ej. 2022"
          value={vehicleYear}
          onChange={(e) => onVehicleYearChange(e.target.value)}
          className={[
            "h-12 rounded-2xl border border-neutral-800 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none",
            inputSurfaceClassName,
          ].join(" ")}
        />
      </label>
    );
  }

  if (kind === "clothing") {
    return (
      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-400">Talla</span>
        <select
          value={clothingSize}
          onChange={(e) => onClothingSizeChange(e.target.value)}
          className={[
            "h-12 rounded-2xl border border-neutral-800 px-4 text-sm text-neutral-100 focus:border-orange-400 focus:outline-none",
            inputSurfaceClassName,
          ].join(" ")}
        >
          <option value="">Selecciona una talla</option>
          <option value="XS">XS</option>
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
          <option value="XL">XL</option>
        </select>
      </label>
    );
  }

  if (kind === "shoes") {
    return (
      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-400">Talla de zapatos</span>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          placeholder="Ej. 40"
          value={shoeSize}
          onChange={(e) => onShoeSizeChange(e.target.value)}
          className={[
            "h-12 rounded-2xl border border-neutral-800 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none",
            inputSurfaceClassName,
          ].join(" ")}
        />
      </label>
    );
  }

  return null;
}

function getCategoryMetadataPayload(kind: CategoryInputKind, values: {
  vehicleYear: string;
  clothingSize: string;
  shoeSize: string;
}) {
  if (kind === "vehicle" && values.vehicleYear) {
    return { vehicleYear: Number(values.vehicleYear) };
  }
  if (kind === "clothing" && values.clothingSize) {
    return { clothingSize: values.clothingSize };
  }
  if (kind === "shoes" && values.shoeSize) {
    return { shoeSize: values.shoeSize };
  }
  return {};
}

export default function NewListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderedCategories, setOrderedCategories] = useState<string[]>(() =>
    appCategories.map((category) => category.name)
  );
  const articleFileInputRef = useRef<HTMLInputElement | null>(null);
  const bazarImageInputRef = useRef<HTMLInputElement | null>(null);
  const bazarItemsRef = useRef<DraftBazarItem[]>([]);
  const bazarItemPreviewUrlRef = useRef("");
  const categoryWasManuallyChangedRef = useRef(false);
  const lastPredictedCategoryRef = useRef("");

  const [listingType, setListingType] = useState<"article" | "bazar">("article");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [clothingSize, setClothingSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "intercambio" | "transferencia">("efectivo");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingArticleImageUrl, setExistingArticleImageUrl] = useState("");
  const [existingArticleLocation, setExistingArticleLocation] = useState("");
  const [uploadingArticle, setUploadingArticle] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [bazarCategory, setBazarCategory] = useState("");
  const [bazarDurationHours, setBazarDurationHours] = useState("");
  const [bazarTitle, setBazarTitle] = useState("");
  const [bazarDescription, setBazarDescription] = useState("");
  const [bazarTitleTouched, setBazarTitleTouched] = useState(false);
  const [bazarDescriptionTouched, setBazarDescriptionTouched] = useState(false);
  const [bazarItems, setBazarItems] = useState<DraftBazarItem[]>([]);
  const [bazarItemTitle, setBazarItemTitle] = useState("");
  const [bazarItemDescription, setBazarItemDescription] = useState("");
  const [bazarItemPrice, setBazarItemPrice] = useState("");
  const [bazarItemVehicleYear, setBazarItemVehicleYear] = useState("");
  const [bazarItemClothingSize, setBazarItemClothingSize] = useState("");
  const [bazarItemShoeSize, setBazarItemShoeSize] = useState("");
  const [bazarItemFile, setBazarItemFile] = useState<File | null>(null);
  const [bazarItemPreviewUrl, setBazarItemPreviewUrl] = useState("");
  const [bazarError, setBazarError] = useState<string | null>(null);
  const [bazarCategoryError, setBazarCategoryError] = useState<string | null>(null);
  const [publishingBazar, setPublishingBazar] = useState(false);
  const [editingListingId, setEditingListingId] = useState("");
  const [republishingListing, setRepublishingListing] = useState(false);

  const currentUser = auth.currentUser;
  const currentUserName =
    currentUser?.displayName?.trim() ||
    currentUser?.email?.split("@")[0]?.trim() ||
    "usuario";
  const defaultBazarTitle = `El Bazar de ${currentUserName}`;
  const defaultBazarDescription = bazarCategory
    ? `Venta de articulos de ${bazarCategory} aparta el tuyo.`
    : "Venta de articulos aparta el tuyo.";
  const articleCategoryKind = getCategoryInputKind(resolveCategoryName(category) || category);
  const bazarCategoryKind = getCategoryInputKind(resolveCategoryName(bazarCategory) || bazarCategory);

  const handleTitleChange = (value: string) => {
    setTitle(value);

    if (categoryWasManuallyChangedRef.current) return;

    const predictedCategory = predictCategoryFromTitle(value);
    if (!predictedCategory) return;
    if (category && category !== lastPredictedCategoryRef.current) return;

    lastPredictedCategoryRef.current = predictedCategory;
    setCategory(predictedCategory);
    setCategoryError(null);
  };

  useEffect(() => {
    setOrderedCategories(
      sortCategoriesByInterest(appCategories, readAccountProfile().interests).map(
        (category) => category.name
      )
    );
  }, []);

  useEffect(() => {
    const nextTitle = searchParams.get("title");
    const nextPrice = searchParams.get("price");
    const nextCategory = searchParams.get("category");
    const nextDescription = searchParams.get("description");
    const nextTags = searchParams.get("tags");
    const nextPaymentMethod = searchParams.get("paymentMethod");
    const nextVehicleYear = searchParams.get("vehicleYear");
    const nextClothingSize = searchParams.get("clothingSize");
    const nextShoeSize = searchParams.get("shoeSize");

    if (nextTitle !== null) setTitle(nextTitle);
    if (nextPrice !== null) setPrice(nextPrice);
    if (nextCategory !== null) {
      setCategory(nextCategory);
      categoryWasManuallyChangedRef.current = true;
    }
    if (nextDescription !== null) setDescription(nextDescription);
    if (nextTags !== null) setTags(nextTags);
    if (nextVehicleYear !== null) setVehicleYear(nextVehicleYear);
    if (nextClothingSize !== null) setClothingSize(nextClothingSize);
    if (nextShoeSize !== null) setShoeSize(nextShoeSize);
    const nextListingId = searchParams.get("listingId");
    if (nextListingId) {
      setEditingListingId(nextListingId);
      setRepublishingListing(searchParams.get("republish") === "1");
    }
    if (
      nextPaymentMethod === "efectivo" ||
      nextPaymentMethod === "intercambio" ||
      nextPaymentMethod === "transferencia"
    ) {
      setPaymentMethod(nextPaymentMethod);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!editingListingId) return;

    let mounted = true;

    getListingById(editingListingId).then((listing) => {
      if (!mounted || !listing) return;

      if ((listing.type || "article") === "article") {
        setListingType("article");
        setTitle(listing.title || "");
        setPrice(String(listing.price || ""));
        setCategory(listing.category || "");
        setDescription(listing.description || "");
        setTags((listing.tags || []).join(", "));
        setPaymentMethod(listing.paymentMethod || "efectivo");
        setVehicleYear(listing.vehicleYear ? String(listing.vehicleYear) : "");
        setClothingSize(listing.clothingSize || "");
        setShoeSize(listing.shoeSize || "");
        setExistingArticleImageUrl(listing.image || "");
        setExistingArticleLocation(listing.location || "");
        categoryWasManuallyChangedRef.current = true;
        return;
      }

      if (listing.type !== "bazar") return;

      setListingType("bazar");
      setBazarCategory(listing.bazarCategory || listing.category || "");
      setBazarDurationHours(listing.bazarDurationHours ? String(listing.bazarDurationHours) : "");
      setBazarTitle(listing.title || "");
      setBazarDescription(listing.description || "");
      setBazarTitleTouched(true);
      setBazarDescriptionTouched(true);
      setBazarItems(
        (listing.bazarItems || []).map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          price: String(item.price),
          vehicleYear: item.vehicleYear ? String(item.vehicleYear) : "",
          clothingSize: item.clothingSize || "",
          shoeSize: item.shoeSize || "",
          previewUrl: item.image,
          imageUrl: item.image,
          file: null,
        }))
      );
    });

    return () => {
      mounted = false;
    };
  }, [editingListingId]);

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  useEffect(() => {
    bazarItemsRef.current = bazarItems;
  }, [bazarItems]);

  useEffect(() => {
    bazarItemPreviewUrlRef.current = bazarItemPreviewUrl;
  }, [bazarItemPreviewUrl]);

  useEffect(() => {
    return () => {
      if (bazarItemPreviewUrlRef.current) {
        URL.revokeObjectURL(bazarItemPreviewUrlRef.current);
      }

      bazarItemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        const destination = getPostAuthDestination("/item/new");
        if (destination !== "/item/new") {
          router.replace(destination);
        }
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!bazarTitleTouched) {
      setBazarTitle(defaultBazarTitle);
    }
  }, [bazarTitleTouched, defaultBazarTitle]);

  useEffect(() => {
    if (!bazarDescriptionTouched) {
      setBazarDescription(defaultBazarDescription);
    }
  }, [bazarDescriptionTouched, defaultBazarDescription]);

  const handleArticleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const current = selectedFiles.length;
    const remaining = Math.max(0, maxArticlePhotos - current);
    const next = incoming.slice(0, remaining);
    setSelectedFiles((prev) => [...prev, ...next]);
    if (next.length > 0) setExistingArticleImageUrl("");
    setPhotoError(null);
    e.currentTarget.value = "";
  };

  const handleBazarImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (bazarItemPreviewUrl) {
      URL.revokeObjectURL(bazarItemPreviewUrl);
    }

    setBazarItemFile(file);
    setBazarItemPreviewUrl(URL.createObjectURL(file));
    setBazarError(null);
    e.currentTarget.value = "";
  };

  const removeArticlePhoto = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetBazarItemForm = (options?: { preservePreviewUrl?: boolean }) => {
    setBazarItemTitle("");
    setBazarItemDescription("");
    setBazarItemPrice("");
    setBazarItemVehicleYear("");
    setBazarItemClothingSize("");
    setBazarItemShoeSize("");
    setBazarItemFile(null);
    if (bazarItemPreviewUrl && !options?.preservePreviewUrl) {
      URL.revokeObjectURL(bazarItemPreviewUrl);
    }
    setBazarItemPreviewUrl("");
  };

  const addBazarItem = () => {
    if (bazarItems.length >= maxBazarItems) {
      setBazarError(`Puedes agregar un máximo de ${maxBazarItems} artículos en tu bazar.`);
      return;
    }

    const numericPrice = Number(bazarItemPrice);
    if (!bazarItemTitle.trim()) {
      setBazarError("Cada artículo del bazar necesita un nombre.");
      return;
    }
    if (!bazarItemDescription.trim()) {
      setBazarError("Cada artículo del bazar necesita una descripción.");
      return;
    }
    if (!numericPrice || numericPrice <= 0) {
      setBazarError("Cada artículo del bazar necesita un precio mayor a 0.");
      return;
    }
    if (!bazarItemFile || !bazarItemPreviewUrl) {
      setBazarError("Cada artículo del bazar necesita una imagen.");
      return;
    }

    setBazarItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: bazarItemTitle.trim(),
        description: bazarItemDescription.trim(),
        price: String(numericPrice),
        ...(bazarCategoryKind === "vehicle" && bazarItemVehicleYear
          ? { vehicleYear: bazarItemVehicleYear }
          : {}),
        ...(bazarCategoryKind === "clothing" && bazarItemClothingSize
          ? { clothingSize: bazarItemClothingSize }
          : {}),
        ...(bazarCategoryKind === "shoes" && bazarItemShoeSize ? { shoeSize: bazarItemShoeSize } : {}),
        file: bazarItemFile,
        previewUrl: bazarItemPreviewUrl,
        imageUrl: "",
      },
    ]);
    setBazarError(null);
    resetBazarItemForm({ preservePreviewUrl: true });
  };

  const removeBazarItem = (id: string) => {
    setBazarItems((current) => {
      const match = current.find((item) => item.id === id);
      if (match) {
        URL.revokeObjectURL(match.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const normalizeUploadError = (err: unknown) => {
    const rawCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: string }).code)
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "";
    const [code, detail] = rawCode.split("|");

    if (code.includes("upload/invalid-size")) {
      return "Cada foto debe pesar menos de 10 MB.";
    }
    if (code.includes("upload/invalid-type")) {
      return "Solo puedes subir archivos de imagen.";
    }
    if (code.includes("upload/too-many-files")) {
      return "Intentaste subir demasiadas imágenes al mismo tiempo.";
    }
    if (code.includes("upload/unsafe-content")) {
      return "Bloqueamos una o más fotos por desnudez o contenido sexual explícito.";
    }
    if (code.includes("upload/s3-access-denied")) {
      return "AWS bloqueó la subida: tu usuario IAM no tiene permiso s3:PutObject sobre el bucket.";
    }
    if (code.includes("auth/missing-token")) {
      return "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.";
    }
    if (code.includes("upload/no-files")) {
      return "No se recibió ninguna imagen para subir.";
    }
    if (code.includes("Missing required env var")) {
      return "Falta configurar AWS S3 en las variables del servidor.";
    }
    if (code.includes("presign") || code.includes("put-failed")) {
      return "No se pudieron subir las fotos a AWS S3. Revisa la configuración del bucket.";
    }
    if (code.includes("image-load-failed") || code.includes("webp-conversion-failed")) {
      return "No pudimos optimizar una foto antes de subirla. Intenta con otra imagen.";
    }
    if (code.includes("timeout") || code.includes("canceled")) {
      return "La subida tardó demasiado. Intenta con una foto más liviana o mejor conexión.";
    }
    if (detail) {
      return `No se pudieron subir las fotos: ${detail}.`;
    }
    return "No se pudieron subir las fotos. Verifica AWS S3 e intenta de nuevo.";
  };

  const normalizePublishError = (err: unknown) => {
    const message =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: string }).message)
        : "";

    if (message.includes("permission-denied") || message.includes("missing or insufficient permissions")) {
      return "No tienes permiso para publicar este bazar en este momento.";
    }

    if (message.includes("unavailable")) {
      return "No pudimos guardar el bazar ahora mismo. Intenta de nuevo.";
    }

    if (message) {
      return `No se pudo publicar el bazar: ${message}.`;
    }

    return "No se pudo publicar el bazar. Intenta de nuevo.";
  };

  const ensureAuthenticated = () => {
    const user = auth.currentUser;
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent("/item/new")}`);
      return null;
    }
    if (user.emailVerified) {
      const destination = getPostAuthDestination("/item/new");
      if (destination !== "/item/new") {
        router.push(destination);
        return null;
      }
    }
    return user;
  };

  const handleArticleContinue = async () => {
    const numericPrice = Number(price);
    const resolvedCategory = resolveCategoryName(category);
    if (!numericPrice || numericPrice <= 0) {
      setPriceError("El precio debe ser mayor a 0.");
      return;
    }
    if (!resolvedCategory) {
      setCategoryError("Selecciona una categoría válida de la lista.");
      return;
    }
    if (selectedFiles.length === 0 && !existingArticleImageUrl) {
      setPhotoError("Agrega al menos una foto para publicar.");
      return;
    }

    const user = ensureAuthenticated();
    if (!user) return;

    setUploadingArticle(true);
    setPriceError(null);
    setCategoryError(null);
    setPhotoError(null);
    setLocationError(null);
    try {
      const currentLocation = editingListingId && existingArticleLocation
        ? { name: existingArticleLocation }
        : await requestCurrentSupportedLocation();
      const urls = selectedFiles.length ? await uploadListingImages(selectedFiles) : [];
      const imageUrl = urls[0] || existingArticleImageUrl;
      if (editingListingId) {
        const whatsappContact = getWhatsappContactSettings();
        await updateListing(editingListingId, {
          ownerId: user.uid,
          ownerName: user.displayName || user.email || "Vendedor",
          ownerAvatar: readProfileAvatar(user.uid),
          sellerWhatsappNumber: whatsappContact.phone,
          sellerUsesWhatsapp: whatsappContact.enabled,
          type: "article",
          title: title.trim(),
          price: numericPrice,
          category: resolvedCategory,
          description: description.trim(),
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          paymentMethod,
          location: currentLocation.name,
          image: imageUrl,
          ...getCategoryMetadataPayload(articleCategoryKind, {
            vehicleYear,
            clothingSize,
            shoeSize,
          }),
          bazarItems: [],
        });
        router.replace(`/item/${editingListingId}`);
        return;
      }
      const params = new URLSearchParams({
        title: title.trim(),
        price: numericPrice.toString(),
        category: resolvedCategory,
        description: description.trim(),
        tags: tags.trim(),
        paymentMethod,
        imageUrl,
        location: currentLocation.name,
      });
      const metadata = getCategoryMetadataPayload(articleCategoryKind, {
        vehicleYear,
        clothingSize,
        shoeSize,
      });
      Object.entries(metadata).forEach(([key, value]) => {
        params.set(key, String(value));
      });
      router.push(`/item/new/preview?${params.toString()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "location/not-supported") {
        setLocationError("Tu dispositivo no permite obtener ubicación. Activa el acceso a ubicación para publicar.");
      } else if (message === "location/not-available") {
        setLocationError("Completa tu país y provincia en tu perfil para publicar con una ubicación válida.");
      } else if (message === "User denied Geolocation" || message === "location/permission-denied") {
        setLocationError("Debes permitir acceso a tu ubicación para publicar.");
      } else if (message === "Timeout expired") {
        setLocationError("No pudimos obtener tu ubicación a tiempo. Intenta de nuevo.");
      } else {
        setPhotoError(normalizeUploadError(err));
      }
    } finally {
      setUploadingArticle(false);
    }
  };

  const handlePublishBazar = async () => {
    const resolvedBazarCategory = resolveCategoryName(bazarCategory);
    if (!resolvedBazarCategory) {
      setBazarCategoryError("Selecciona una categoría válida de la lista.");
      return;
    }
    if (!bazarTitle.trim()) {
      setBazarError("Agrega un título para tu bazar.");
      return;
    }
    if (!bazarDurationHours) {
      setBazarError("Selecciona la duración del bazar.");
      return;
    }
    if (bazarItems.length === 0) {
      setBazarError("Agrega al menos un artículo a tu bazar.");
      return;
    }

    const user = ensureAuthenticated();
    if (!user) return;

    setPublishingBazar(true);
    setBazarError(null);
    setBazarCategoryError(null);

    try {
      const currentLocation = await requestCurrentSupportedLocation();
      const pendingUploadItems = bazarItems.filter((item) => item.file);
      const uploadedUrls = pendingUploadItems.length
        ? await uploadListingImages(pendingUploadItems.map((item) => item.file as File))
        : [];
      let uploadedIndex = 0;
      const publishedItems = bazarItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        price: Number(item.price),
        image: item.imageUrl || uploadedUrls[uploadedIndex++] || "",
        ...(item.vehicleYear ? { vehicleYear: Number(item.vehicleYear) } : {}),
        ...(item.clothingSize ? { clothingSize: item.clothingSize } : {}),
        ...(item.shoeSize ? { shoeSize: item.shoeSize } : {}),
      }));
      const lowestPrice = publishedItems.reduce((min, item) => Math.min(min, item.price), publishedItems[0]?.price || 0);

      try {
        const whatsappContact = getWhatsappContactSettings();
        const payload = {
          ownerId: user.uid,
          ownerName: user.displayName || user.email || "Vendedor",
          ownerAvatar: readProfileAvatar(user.uid),
          sellerWhatsappNumber: whatsappContact.phone,
          sellerUsesWhatsapp: whatsappContact.enabled,
          type: "bazar" as const,
          title: bazarTitle.trim(),
          price: lowestPrice,
          category: resolvedBazarCategory,
          bazarCategory: resolvedBazarCategory,
          bazarDurationHours: Number(bazarDurationHours),
          description: bazarDescription.trim() || `${publishedItems.length} artículos en este bazar.`,
          tags: [],
          paymentMethod: "efectivo" as const,
          location: currentLocation.name,
          image: publishedItems[0]?.image || "",
          bazarItems: publishedItems,
        };

        if (editingListingId) {
          await updateListing(editingListingId, payload);
        } else {
          await createListing(payload);
        }
      } catch (err: unknown) {
        setBazarError(normalizePublishError(err));
        return;
      }

      if (editingListingId) {
        router.replace(`/item/${editingListingId}`);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "location/not-supported") {
        setBazarError("Tu dispositivo no permite obtener ubicación. Activa el acceso a ubicación para publicar.");
      } else if (message === "location/not-available") {
        setBazarError("Completa tu país y provincia en tu perfil para publicar con una ubicación válida.");
      } else if (message === "User denied Geolocation" || message === "location/permission-denied") {
        setBazarError("Debes permitir acceso a tu ubicación para publicar.");
      } else if (message === "Timeout expired") {
        setBazarError("No pudimos obtener tu ubicación a tiempo. Intenta de nuevo.");
      } else {
        setBazarError(normalizeUploadError(err));
      }
    } finally {
      setPublishingBazar(false);
    }
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
        <div className="flex rounded-2xl border border-neutral-800 bg-neutral-900 p-1">
          {[
            { id: "article", label: "Articulo" },
            { id: "bazar", label: "Bazar" },
          ].map((tab) => {
            const isActive = listingType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setListingType(tab.id as "article" | "bazar")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  isActive ? "bg-orange-400 text-black" : "text-neutral-300 hover:text-white",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="h-10 w-10" />
      </header>

      {listingType === "article" ? (
        <>
          <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-32">
            <input
              ref={articleFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleArticleFilesChange}
            />

            <button
              type="button"
              onClick={() => articleFileInputRef.current?.click()}
              className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-300 shadow-sm hover:border-orange-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <ImagePlus className="h-7 w-7" />
              <div className="text-sm font-semibold">Agregar fotos</div>
              <div className="text-[11px] text-neutral-400">Máx {maxArticlePhotos} fotos</div>
            </button>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-[13px] text-neutral-300">
              Fotos: {selectedFiles.length}/{maxArticlePhotos} · Solo fotos. Las convertimos a WebP y reducimos tamano automaticamente.
            </div>

            {existingArticleImageUrl ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-800">
                  <img src={existingArticleImageUrl} alt="Foto actual" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setExistingArticleImageUrl("")}
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                    aria-label="Eliminar foto actual"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}

            {previewUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {previewUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-800">
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeArticlePhoto(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                      aria-label="Eliminar foto"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-blue-900/20 px-4 py-3 text-sm text-neutral-100">
              <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-blue-300">
                <Info className="h-4 w-4" />
              </div>
              <p className="leading-6 text-neutral-200">
                Usa buena iluminacion, fondo limpio y toma varias fotos en diferentes angulos.
              </p>
            </div>

            <form className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400">Título</span>
                <input
                  type="text"
                  placeholder="Ej. iPhone 13 128GB en buen estado"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400">Precio</span>
                <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm focus-within:border-orange-400">
                  <span className="text-neutral-500">RD$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setPriceError(null);
                    }}
                    className="h-12 flex-1 bg-transparent text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                  />
                </div>
                {priceError ? <span className="text-xs text-orange-400">{priceError}</span> : null}
              </label>

              <CategorySuggestField
                label="Categoría"
                value={category}
                options={orderedCategories}
                placeholder="Escribe para buscar una categoría"
                error={categoryError}
                onChange={(value) => {
                  categoryWasManuallyChangedRef.current = true;
                  setCategory(value);
                  setCategoryError(null);
                }}
              />

              <CategoryMetadataFields
                kind={articleCategoryKind}
                vehicleYear={vehicleYear}
                clothingSize={clothingSize}
                shoeSize={shoeSize}
                inputSurfaceClassName="bg-neutral-900"
                onVehicleYearChange={setVehicleYear}
                onClothingSizeChange={setClothingSize}
                onShoeSizeChange={setShoeSize}
              />

              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400">Método de pago</span>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {paymentOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={[
                        "h-11 shrink-0 whitespace-nowrap rounded-2xl border px-5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-300",
                        paymentMethod === opt.id
                          ? "border-orange-400 text-orange-400"
                          : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-orange-400 hover:text-white",
                      ].join(" ")}
                      aria-pressed={paymentMethod === opt.id}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400">Descripción</span>
                <textarea
                  rows={4}
                  placeholder="Cuenta detalles clave, estado, accesorios incluidos y ubicación."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400">Tags (separados por coma)</span>
                <input
                  type="text"
                  placeholder="Ej. nuevo, original, con caja"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                />
                <span className="text-[11px] text-neutral-500">Ejemplo: &quot;nuevo, original, con garantía&quot;</span>
              </label>
            </form>

            {photoError ? <span className="text-xs text-orange-400">{photoError}</span> : null}
            {locationError ? <span className="text-xs text-orange-400">{locationError}</span> : null}
          </main>

          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
            <div className="mx-auto max-w-md px-6 py-4">
              <button
                type="button"
                className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
                onClick={handleArticleContinue}
                disabled={uploadingArticle}
              >
                {uploadingArticle ? "Guardando..." : editingListingId ? "Guardar cambios" : "Siguiente"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-32">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
              <div className="text-sm font-semibold text-white">Configura tu bazar</div>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Un bazar agrupa múltiples artículos en una sola publicación. Puedes cargar hasta {maxBazarItems} artículos.
              </p>
            </div>

            <CategorySuggestField
              label="Tipo de bazar"
              value={bazarCategory}
              options={orderedCategories}
              placeholder="Escribe para buscar una categoría"
              error={bazarCategoryError}
              onChange={(value) => {
                setBazarCategory(value);
                setBazarCategoryError(null);
              }}
            />

            <label className="flex flex-col gap-2">
              <span className="text-xs text-neutral-400">Duración del bazar</span>
              <Select
                value={bazarDurationHours}
                onValueChange={(value) => {
                  setBazarDurationHours(value);
                  setBazarError(null);
                }}
              >
                <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 shadow-none focus:ring-orange-400/20">
                  <SelectValue placeholder="Selecciona la duración" />
                </SelectTrigger>
                <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                  {BAZAR_DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)} className="focus:bg-neutral-900 focus:text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-neutral-400">Título de bazar</span>
              <input
                type="text"
                placeholder="Ej. Bazar de accesorios y ropa nueva"
                value={bazarTitle}
                onChange={(e) => {
                  setBazarTitleTouched(true);
                  setBazarTitle(e.target.value);
                }}
                className="h-12 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-neutral-400">Descripción general del bazar</span>
              <textarea
                rows={3}
                placeholder="Opcional. Agrega un resumen general de este bazar."
                value={bazarDescription}
                onChange={(e) => {
                  setBazarDescriptionTouched(true);
                  setBazarDescription(e.target.value);
                }}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
              />
            </label>

            <input
              ref={bazarImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBazarImageChange}
            />

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="text-sm font-semibold text-white">Agregar artículo al bazar</div>

              <button
                type="button"
                onClick={() => bazarImageInputRef.current?.click()}
                className="mt-4 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-orange-400 hover:text-white"
              >
                {bazarItemPreviewUrl ? (
                  <img src={bazarItemPreviewUrl} alt="Preview artículo bazar" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  <>
                    <ImagePlus className="h-7 w-7" />
                    <div className="text-sm font-semibold">Agregar imagen</div>
                  </>
                )}
              </button>

              <div className="mt-4 grid gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs text-neutral-400">Nombre del artículo</span>
                  <input
                    type="text"
                    placeholder="Ej. Collar dorado"
                    value={bazarItemTitle}
                    onChange={(e) => setBazarItemTitle(e.target.value)}
                    className="h-12 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs text-neutral-400">Descripción</span>
                  <textarea
                    rows={3}
                    placeholder="Detalles del artículo."
                    value={bazarItemDescription}
                    onChange={(e) => setBazarItemDescription(e.target.value)}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs text-neutral-400">Precio</span>
                  <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-sm focus-within:border-orange-400">
                    <span className="text-neutral-500">RD$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={bazarItemPrice}
                      onChange={(e) => setBazarItemPrice(e.target.value)}
                      className="h-12 flex-1 bg-transparent text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                    />
                  </div>
                </label>

                <CategoryMetadataFields
                  kind={bazarCategoryKind}
                  vehicleYear={bazarItemVehicleYear}
                  clothingSize={bazarItemClothingSize}
                  shoeSize={bazarItemShoeSize}
                  inputSurfaceClassName="bg-neutral-950"
                  onVehicleYearChange={setBazarItemVehicleYear}
                  onClothingSizeChange={setBazarItemClothingSize}
                  onShoeSizeChange={setBazarItemShoeSize}
                />
              </div>

              <button
                type="button"
                onClick={addBazarItem}
                disabled={bazarItems.length >= maxBazarItems}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-950 text-sm font-semibold text-neutral-100 hover:border-orange-400 hover:text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Agregar artículo
              </button>

              <div className="mt-3 text-xs text-neutral-500">
                Artículos agregados: {bazarItems.length}/{maxBazarItems}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="text-sm font-semibold text-white">Resumen del bazar</div>
              {bazarItems.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-4 text-sm text-neutral-400">
                  Aún no has agregado artículos.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {bazarItems.map((item) => (
                    <div key={item.id} className="relative flex gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-800">
                        <img src={item.previewUrl} alt={item.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 pr-8">
                        <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
                        <div className="mt-1 text-sm font-semibold text-orange-400">
                          RD${Number(item.price).toLocaleString()}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-400">{item.description}</p>
                        {item.vehicleYear || item.clothingSize || item.shoeSize ? (
                          <div className="mt-1 text-xs text-neutral-500">
                            {item.vehicleYear
                              ? `Año: ${item.vehicleYear}`
                              : item.clothingSize
                                ? `Talla: ${item.clothingSize}`
                                : `Talla zapatos: ${item.shoeSize}`}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBazarItem(item.id)}
                        className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
                        aria-label={`Eliminar ${item.title}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {bazarError ? <span className="text-xs text-orange-400">{bazarError}</span> : null}
          </main>

          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
            <div className="mx-auto max-w-md px-6 py-4">
              <button
                type="button"
                className="h-12 w-full rounded-2xl bg-orange-400 px-6 text-sm font-semibold text-black shadow hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-neutral-700 disabled:text-neutral-300"
                onClick={handlePublishBazar}
                disabled={publishingBazar}
              >
                {publishingBazar
                  ? republishingListing
                    ? "Publicando de nuevo..."
                    : "Publicando bazar..."
                  : republishingListing
                    ? "Publicar de nuevo"
                    : editingListingId
                      ? "Guardar cambios"
                      : "Publicar bazar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
