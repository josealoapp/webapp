"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "@/lib/auth-client";
import { ArrowLeft, Car, Download, Footprints, ImagePlus, Info, Package, Plus, Search, Shirt, Upload, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { createListing, getListingById, updateListing, uploadListingImages, type BazarItem, type ListingCurrency } from "@/lib/marketplace";
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
import { subscribeVerifiedUser } from "@/lib/user-verified";
import { BAZAR_DURATION_OPTIONS } from "@/lib/bazar-duration";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeSetting } from "@/components/ThemeProvider";
const maxArticlePhotos = 10;
const maxBazarItems = 20;

type DraftBazarItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: ListingCurrency;
  vehicleYear?: string;
  clothingSize?: string;
  shoeSize?: string;
  file?: File | null;
  previewUrl: string;
  imageUrl?: string;
};

const currencyOptions: Array<{ id: ListingCurrency; label: string }> = [
  { id: "DOP", label: "RD$" },
  { id: "USD", label: "USD" },
];

const paymentOptions: Array<{ id: "efectivo" | "intercambio" | "ambos"; label: string }> = [
  { id: "efectivo", label: "Efectivo" },
  { id: "intercambio", label: "Intercambio" },
  { id: "ambos", label: "Ambos" },
];

type CsvImportType = "normal" | "clothing" | "vehicle" | "shoes";
type CsvImportStatus = "idle" | "publishing" | "published" | "error";

type CsvImportRow = {
  key: string;
  rowNumber: number;
  title: string;
  price: number;
  currency: ListingCurrency;
  category: string;
  description: string;
  paymentMethod: "efectivo" | "intercambio" | "ambos";
  imageUrls: string[];
  tags: string[];
  vehicleYear: string;
  clothingSize: string;
  shoeSize: string;
  errors: string[];
  status: CsvImportStatus;
  listingId?: string;
  publishError?: string;
};

const csvImportTypes: Array<{ id: CsvImportType; label: string; description: string }> = [
  { id: "normal", label: "Artículo normal", description: "Libros, electrónicos, celulares y artículos generales." },
  { id: "clothing", label: "Ropa", description: "Ropa de niños, damas u hombres. Requiere talla." },
  { id: "vehicle", label: "Vehículos", description: "Autos, motos, camiones y botes. Requiere año." },
  { id: "shoes", label: "Zapatos", description: "Calzado. Requiere talla de zapato." },
];

function CsvImportTypeIcon({ type }: { type: CsvImportType }) {
  const className = "h-5 w-5";
  if (type === "clothing") return <Shirt className={className} />;
  if (type === "vehicle") return <Car className={className} />;
  if (type === "shoes") return <Footprints className={className} />;
  return <Package className={className} />;
}

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

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitCsvList(value: string) {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImportPaymentMethod(value: string): "efectivo" | "intercambio" | "ambos" {
  const normalized = normalizeCategoryName(value);
  if (normalized === "intercambio") return "intercambio";
  if (normalized === "ambos" || normalized === "ambas" || normalized === "transferencia") return "ambos";
  return "efectivo";
}

function getExpectedImportKind(categoryName: string): CsvImportType {
  const kind = getCategoryInputKind(categoryName);
  if (kind === "vehicle") return "vehicle";
  if (kind === "clothing") return "clothing";
  if (kind === "shoes") return "shoes";
  return "normal";
}

function buildCsvTemplate(importType: CsvImportType) {
  const baseHeaders = ["title", "price", "currency", "category", "description", "paymentMethod", "imageUrls", "tags"];
  const headers =
    importType === "vehicle"
      ? [...baseHeaders, "vehicleYear"]
      : importType === "clothing"
        ? [...baseHeaders, "clothingSize"]
        : importType === "shoes"
          ? [...baseHeaders, "shoeSize"]
          : baseHeaders;
  const category =
    importType === "vehicle"
      ? "Vehículos"
      : importType === "clothing"
        ? "Ropa para mujeres"
        : importType === "shoes"
          ? "Zapatos"
          : "Celulares y smartphones";
  const example =
    importType === "vehicle"
      ? ["Honda Civic 2020", 650000, "DOP", category, "Sedán en buen estado", "efectivo", "https://example.com/foto1.jpg;https://example.com/foto2.jpg", "honda,civic", 2020]
      : importType === "clothing"
        ? ["Vestido floral", 1200, "DOP", category, "Vestido talla M", "ambos", "https://example.com/foto1.jpg", "vestido,nuevo", "M"]
        : importType === "shoes"
          ? ["Tenis Nike", 2500, "DOP", category, "Tenis originales", "efectivo", "https://example.com/foto1.jpg", "nike,tenis", 40]
          : ["iPhone 13", 35000, "DOP", category, "128GB en buen estado", "ambos", "https://example.com/foto1.jpg;https://example.com/foto2.jpg", "iphone,celular"];

  return `${headers.join(",")}\n${example.map(csvEscape).join(",")}\n`;
}

function buildCsvImportRows(text: string, importType: CsvImportType): CsvImportRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];

  const headers = parsed[0].map(normalizeCsvHeader);
  const getValue = (row: string[], keys: string[]) => {
    const index = keys.map(normalizeCsvHeader).map((key) => headers.indexOf(key)).find((idx) => idx >= 0);
    return index === undefined || index < 0 ? "" : row[index] || "";
  };

  return parsed.slice(1).map((row, index) => {
    const title = getValue(row, ["title", "titulo", "nombre"]);
    const rawPrice = getValue(row, ["price", "precio"]);
    const price = Number(rawPrice);
    const currency = getValue(row, ["currency", "moneda"]).toUpperCase() === "USD" ? "USD" : "DOP";
    const category = resolveCategoryName(getValue(row, ["category", "categoria"]));
    const description = getValue(row, ["description", "descripcion"]);
    const paymentMethod = normalizeImportPaymentMethod(getValue(row, ["paymentMethod", "metodoPago", "pago"]));
    const imageUrls = splitCsvList(getValue(row, ["imageUrls", "images", "imagenes", "imageLinks"]));
    const tags = splitCsvList(getValue(row, ["tags", "etiquetas"]));
    const vehicleYear = getValue(row, ["vehicleYear", "ano", "año", "year"]);
    const clothingSize = getValue(row, ["clothingSize", "talla", "size"]);
    const shoeSize = getValue(row, ["shoeSize", "tallaZapato", "shoe"]);
    const errors: string[] = [];

    if (!title) errors.push("Falta title.");
    if (!Number.isFinite(price) || price <= 0) errors.push("Price debe ser mayor a 0.");
    if (!category) errors.push("Category no coincide con una categoría válida.");
    if (!description) errors.push("Falta description.");
    if (!imageUrls.length) errors.push("Agrega al menos un enlace en imageUrls.");
    if (imageUrls.some((url) => !/^https?:\/\//i.test(url))) errors.push("imageUrls debe contener enlaces http/https.");
    if (category && getExpectedImportKind(category) !== importType) errors.push("La categoría no coincide con el tipo de importación seleccionado.");
    if (importType === "vehicle" && (!Number(vehicleYear) || Number(vehicleYear) < 1900)) errors.push("vehicleYear es obligatorio.");
    if (importType === "clothing" && !clothingSize) errors.push("clothingSize es obligatorio.");
    if (importType === "shoes" && !shoeSize) errors.push("shoeSize es obligatorio.");

    return {
      key: `row-${index + 2}`,
      rowNumber: index + 2,
      title,
      price,
      currency,
      category,
      description,
      paymentMethod,
      imageUrls,
      tags,
      vehicleYear,
      clothingSize,
      shoeSize,
      errors,
      status: "idle",
    };
  });
}

export default function NewListingPage() {
  const router = useRouter();
  const { theme } = useThemeSetting();
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
  const [currency, setCurrency] = useState<ListingCurrency>("DOP");
  const [category, setCategory] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [clothingSize, setClothingSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "intercambio" | "ambos">("efectivo");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingArticleImageUrl, setExistingArticleImageUrl] = useState("");
  const [existingArticleImageUrls, setExistingArticleImageUrls] = useState<string[]>([]);
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
  const [bazarItemCurrency, setBazarItemCurrency] = useState<ListingCurrency>("DOP");
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
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserVerified, setCurrentUserVerified] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<CsvImportType>("normal");
  const [csvText, setCsvText] = useState("");
  const [importRows, setImportRows] = useState<CsvImportRow[]>([]);
  const [publishingImport, setPublishingImport] = useState(false);
  const [importError, setImportError] = useState("");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

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
    const nextCurrency = searchParams.get("currency");
    const nextCategory = searchParams.get("category");
    const nextDescription = searchParams.get("description");
    const nextTags = searchParams.get("tags");
    const nextPaymentMethod = searchParams.get("paymentMethod");
    const nextVehicleYear = searchParams.get("vehicleYear");
    const nextClothingSize = searchParams.get("clothingSize");
    const nextShoeSize = searchParams.get("shoeSize");

    if (nextTitle !== null) setTitle(nextTitle);
    if (nextPrice !== null) setPrice(nextPrice);
    if (nextCurrency === "USD" || nextCurrency === "DOP") setCurrency(nextCurrency);
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
      nextPaymentMethod === "ambos" ||
      nextPaymentMethod === "transferencia"
    ) {
      setPaymentMethod(nextPaymentMethod === "transferencia" ? "ambos" : nextPaymentMethod);
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
        setCurrency(listing.currency || "DOP");
        setCategory(listing.category || "");
        setDescription(listing.description || "");
        setTags((listing.tags || []).join(", "));
        const listingPaymentMethod = String(listing.paymentMethod || "efectivo");
        setPaymentMethod(
          listingPaymentMethod === "intercambio"
            ? "intercambio"
            : listingPaymentMethod === "ambos" || listingPaymentMethod === "transferencia"
              ? "ambos"
              : "efectivo"
        );
        setVehicleYear(listing.vehicleYear ? String(listing.vehicleYear) : "");
        setClothingSize(listing.clothingSize || "");
        setShoeSize(listing.shoeSize || "");
        const listingImages = listing.images?.length ? listing.images : listing.image ? [listing.image] : [];
        setExistingArticleImageUrl(listingImages[0] || "");
        setExistingArticleImageUrls(listingImages);
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
          currency: item.currency || listing.currency || "DOP",
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
      setCurrentUserId(user?.uid || "");
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
    if (!currentUserId) {
      setCurrentUserVerified(false);
      return;
    }

    const unsub = subscribeVerifiedUser(currentUserId, setCurrentUserVerified);
    return () => unsub();
  }, [currentUserId]);

  useEffect(() => {
    setImportRows(buildCsvImportRows(csvText, importType));
    setImportError("");
  }, [csvText, importType]);

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
    const current = selectedFiles.length + existingArticleImageUrls.length;
    const remaining = Math.max(0, maxArticlePhotos - current);
    const next = incoming.slice(0, remaining);
    setSelectedFiles((prev) => [...prev, ...next]);
    if (next.length > 0) {
      setExistingArticleImageUrl("");
      setExistingArticleImageUrls([]);
    }
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

  const removeExistingArticlePhoto = (idx: number) => {
    setExistingArticleImageUrls((current) => {
      const next = current.filter((_, i) => i !== idx);
      setExistingArticleImageUrl(next[0] || "");
      return next;
    });
  };

  const resetBazarItemForm = (options?: { preservePreviewUrl?: boolean }) => {
    setBazarItemTitle("");
    setBazarItemDescription("");
    setBazarItemPrice("");
    setBazarItemCurrency("DOP");
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
        currency: bazarItemCurrency,
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
      return "No se pudieron subir las fotos. Intenta con imágenes más livianas o vuelve a intentarlo.";
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
    return "No se pudieron subir las fotos. Intenta de nuevo.";
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
    if (selectedFiles.length === 0 && existingArticleImageUrls.length === 0 && !existingArticleImageUrl) {
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
      const imageUrls = urls.length ? urls : existingArticleImageUrls.length ? existingArticleImageUrls : existingArticleImageUrl ? [existingArticleImageUrl] : [];
      const imageUrl = imageUrls[0] || "";
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
          currency,
          category: resolvedCategory,
          description: description.trim(),
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          paymentMethod,
          location: currentLocation.name,
          image: imageUrl,
          images: imageUrls,
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
        currency,
        category: resolvedCategory,
        description: description.trim(),
        tags: tags.trim(),
        paymentMethod,
        imageUrl,
        imageUrls: imageUrls.join(","),
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
      const publishedItems: BazarItem[] = [];
      for (const item of bazarItems) {
        const uploadedUrl = item.imageUrl
          ? item.imageUrl
          : item.file
            ? (await uploadListingImages([item.file]))[0] || ""
            : "";

        publishedItems.push({
          id: item.id,
          title: item.title,
          description: item.description,
          price: Number(item.price),
          currency: item.currency,
          image: uploadedUrl,
          ...(item.vehicleYear ? { vehicleYear: Number(item.vehicleYear) } : {}),
          ...(item.clothingSize ? { clothingSize: item.clothingSize } : {}),
          ...(item.shoeSize ? { shoeSize: item.shoeSize } : {}),
        });
      }
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
          currency: publishedItems[0]?.currency || "DOP",
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

  const validImportRows = importRows.filter((row) => row.errors.length === 0);
  const publishableImportRows = validImportRows.filter((row) => row.status !== "published");
  const importReadyLabel = `${String(validImportRows.length).padStart(2, "0")}/${String(importRows.length).padStart(2, "0")} artículos correctos`;

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    input.value = "";
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([buildCsvTemplate(importType)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `josealo-import-${importType}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePublishImportRows = async () => {
    const user = ensureAuthenticated();
    if (!user || publishingImport) return;
    if (publishableImportRows.length === 0) {
      setImportError("No hay artículos válidos para publicar.");
      return;
    }

    setPublishingImport(true);
    setImportError("");

    try {
      const currentLocation = await requestCurrentSupportedLocation();
      const whatsappContact = getWhatsappContactSettings();

      for (const row of publishableImportRows) {
        setImportRows((current) =>
          current.map((item) => (item.key === row.key ? { ...item, status: "publishing", publishError: "" } : item))
        );

        try {
          const listingId = await createListing({
            ownerId: user.uid,
            ownerName: user.displayName || user.email || "Vendedor",
            ownerAvatar: readProfileAvatar(user.uid),
            sellerWhatsappNumber: whatsappContact.phone,
            sellerUsesWhatsapp: whatsappContact.enabled,
            type: "article",
            title: row.title,
            price: row.price,
            currency: row.currency,
            category: row.category,
            description: row.description,
            tags: row.tags,
            paymentMethod: row.paymentMethod,
            location: currentLocation.name,
            image: row.imageUrls[0] || "",
            images: row.imageUrls,
            ...getCategoryMetadataPayload(getCategoryInputKind(row.category), {
              vehicleYear: row.vehicleYear,
              clothingSize: row.clothingSize,
              shoeSize: row.shoeSize,
            }),
            bazarItems: [],
          });
          setImportRows((current) =>
            current.map((item) => (item.key === row.key ? { ...item, status: "published", listingId } : item))
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "No se pudo publicar.";
          setImportRows((current) =>
            current.map((item) => (item.key === row.key ? { ...item, status: "error", publishError: message } : item))
          );
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message === "location/not-supported") {
        setImportError("Tu dispositivo no permite obtener ubicación. Activa el acceso a ubicación para publicar.");
      } else if (message === "location/not-available") {
        setImportError("Completa tu país y provincia en tu perfil para publicar con una ubicación válida.");
      } else if (message === "User denied Geolocation" || message === "location/permission-denied") {
        setImportError("Debes permitir acceso a tu ubicación para publicar.");
      } else {
        setImportError("No pudimos publicar el CSV. Intenta de nuevo.");
      }
    } finally {
      setPublishingImport(false);
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
        {currentUserVerified && listingType === "article" && !editingListingId ? (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-50 shadow-sm active:scale-95"
            aria-label="Importar artículos por CSV"
          >
            <Upload className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
      </header>

      {importOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 px-4 py-5 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Importar artículos</div>
                <div className="mt-1 text-xs text-neutral-400">{importReadyLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200"
                aria-label="Cerrar importador"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {csvImportTypes.map((type) => {
                  const active = importType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setImportType(type.id)}
                      className={[
                        "rounded-2xl border p-3 text-left transition",
                        active
                          ? "border-orange-400 bg-orange-400/10 text-orange-200"
                          : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-600",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                            active
                              ? "border-orange-400/40 bg-orange-400/15 text-orange-300"
                              : "border-neutral-800 bg-neutral-950 text-neutral-400",
                          ].join(" ")}
                        >
                          <CsvImportTypeIcon type={type.id} />
                        </span>
                        <span>{type.label}</span>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-neutral-400">{type.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <input ref={importFileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileChange} />
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  className="flex h-11 items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100"
                >
                  <Upload className="h-4 w-4" />
                  Subir CSV
                </button>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex h-11 items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100"
                >
                  <Download className="h-4 w-4" />
                  Descargar plantilla
                </button>
              </div>

              <label className="mt-4 flex flex-col gap-2">
                <span className="text-xs text-neutral-400">CSV</span>
                <textarea
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  rows={7}
                  placeholder={buildCsvTemplate(importType)}
                  className="min-h-36 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-orange-400 focus:outline-none"
                />
              </label>

              {importRows.length > 0 ? (
                <div className="mt-4 space-y-3 pb-24">
                  {importRows.map((row) => {
                    const hasIssue = row.errors.length > 0 || row.status === "error";
                    return (
                      <details
                        key={row.key}
                        className={[
                          "rounded-2xl border bg-neutral-900/60 p-3",
                          hasIssue ? "border-orange-400/70" : "border-neutral-800",
                        ].join(" ")}
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-neutral-100">
                                Fila {row.rowNumber}: {row.title || "Sin título"}
                              </div>
                              <div className="mt-1 text-xs text-neutral-400">
                                {row.category || "Sin categoría"} · {row.currency} {Number(row.price || 0).toLocaleString()}
                              </div>
                            </div>
                            <div
                              className={[
                                "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold uppercase",
                                row.status === "published"
                                  ? "bg-green-500/10 text-green-300"
                                  : hasIssue
                                    ? "bg-orange-400/10 text-orange-300"
                                    : "bg-neutral-800 text-neutral-300",
                              ].join(" ")}
                            >
                              {row.status === "published" ? "Publicado" : hasIssue ? "Revisar" : "Correcto"}
                            </div>
                          </div>
                        </summary>
                        <div className="mt-3 space-y-2 text-xs text-neutral-300">
                          <div>{row.description}</div>
                          <div>Imágenes: {row.imageUrls.length ? row.imageUrls.join(" · ") : "Sin imágenes"}</div>
                          {row.vehicleYear ? <div>Año: {row.vehicleYear}</div> : null}
                          {row.clothingSize ? <div>Talla: {row.clothingSize}</div> : null}
                          {row.shoeSize ? <div>Talla zapatos: {row.shoeSize}</div> : null}
                          {row.errors.length ? <div className="text-orange-300">{row.errors.join(" ")}</div> : null}
                          {row.publishError ? <div className="text-orange-300">{row.publishError}</div> : null}
                          {row.listingId ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/item/${row.listingId}`)}
                              className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-100"
                            >
                              Revisar publicación
                            </button>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">
                  Sube un CSV o pega el contenido para revisar tus artículos antes de publicar.
                </div>
              )}
            </div>

            <div className="border-t border-neutral-800 bg-neutral-950/95 px-4 py-4">
              {importError ? <div className="mb-3 text-xs text-orange-300">{importError}</div> : null}
              <button
                type="button"
                onClick={handlePublishImportRows}
                disabled={publishingImport || publishableImportRows.length === 0}
                className="h-12 w-full rounded-2xl bg-orange-400 px-5 text-sm font-semibold text-black disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {publishingImport ? "Publicando..." : "Publicar todo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              Fotos: {selectedFiles.length + existingArticleImageUrls.length}/{maxArticlePhotos} · Solo fotos. Las convertimos a WebP y reducimos tamano automaticamente.
            </div>

            {existingArticleImageUrls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {existingArticleImageUrls.map((url, idx) => (
                  <div key={url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-800">
                    <img src={url} alt={`Foto actual ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingArticlePhoto(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                      aria-label="Eliminar foto actual"
                    >
                      ×
                    </button>
                  </div>
                ))}
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
              <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-white">
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
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                  <Select value={currency} onValueChange={(value) => setCurrency(value as ListingCurrency)}>
                    <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-900 px-4 text-sm font-semibold text-neutral-100 shadow-none focus:border-orange-400 focus:ring-orange-400/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                      {currencyOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id} className="focus:bg-neutral-900 focus:text-neutral-100">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setPriceError(null);
                    }}
                    className="h-12 min-w-0 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
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

          <div className="item-new-fixed-footer fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
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
            <div className="rounded-2xl border border-neutral-800 bg-blue-500/20 p-4">
              <div className={[
                "text-sm font-semibold",
                theme === "light" ? "text-black" : "text-white",
              ].join(" ")}>
                Configura tu bazar
              </div>
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
              <div
                className={[
                  "text-sm font-semibold",
                  theme === "light" ? "text-black" : "text-white",
                ].join(" ")}
              >
                Agregar artículo al bazar
              </div>

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
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <Select value={bazarItemCurrency} onValueChange={(value) => setBazarItemCurrency(value as ListingCurrency)}>
                      <SelectTrigger className="h-12 rounded-2xl border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-neutral-100 shadow-none focus:border-orange-400 focus:ring-orange-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                        {currencyOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id} className="focus:bg-neutral-900 focus:text-neutral-100">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="number"
                      placeholder="0"
                      value={bazarItemPrice}
                      onChange={(e) => setBazarItemPrice(e.target.value)}
                      className="h-12 min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950 px-4 text-neutral-100 placeholder:text-neutral-500 focus:border-orange-400 focus:outline-none"
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
              <div
                className={[
                  "text-sm font-semibold",
                  theme === "light" ? "text-black" : "text-white",
                ].join(" ")}
              >
                Resumen del bazar
              </div>
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
                        <div className="listing-title text-sm font-medium text-neutral-100">{item.title}</div>
                        <div className="listing-price mt-1 text-sm font-bold text-orange-400">
                          {formatMoney(Number(item.price), item.currency)}
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

          <div className="item-new-fixed-footer fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/85 backdrop-blur">
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

function formatMoney(value: number, currency: ListingCurrency = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString()}`;
}
