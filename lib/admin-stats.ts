import { getAdminDb } from "@/lib/firebase-admin";

type RawBazarItem = {
  id?: string;
  title?: string;
  price?: number;
  image?: string;
  status?: "active" | "sold";
  soldAt?: number;
};

type RawListing = {
  title?: string;
  price?: number;
  category?: string;
  bazarCategory?: string;
  tags?: string[];
  location?: string;
  type?: "article" | "bazar";
  bazarItems?: RawBazarItem[];
  image?: string;
  views?: number;
  viewCount?: number;
  impressions?: number;
  createdAt?: number;
  status?: "active" | "sold";
  soldAt?: number;
};

type RawSearchEvent = {
  query?: string;
  normalizedQuery?: string;
  category?: string;
  location?: string;
  userId?: string;
};

export type AdminSoldItem = {
  id: string;
  listingId: string;
  status: "active" | "sold";
  image: string;
  href: string;
  title: string;
  category: string;
  brand: string;
  model: string;
  price: number;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  soldAt: number;
  daysToSell: number | null;
  views: number;
  interactions: number;
  interactionUsers: string[];
  searchCount: number;
  searchUsers: string[];
};

export type AdminStatsGroup = {
  name: string;
  soldCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  avgDaysToSell: number | null;
};

export type AdminStatsLocation = {
  name: string;
  latitude: number;
  longitude: number;
  soldCount: number;
  topCategory: string;
  topBrand: string;
  minPrice: number;
  maxPrice: number;
  avgDaysToSell: number | null;
  items: AdminSoldItem[];
};

export type AdminMarketplaceStats = {
  generatedAt: number;
  totalSold: number;
  totalRevenue: number;
  avgPrice: number;
  avgDaysToSell: number | null;
  categoryStats: AdminStatsGroup[];
  brandStats: AdminStatsGroup[];
  modelStats: AdminStatsGroup[];
  bestSellers: AdminStatsGroup[];
  locations: AdminStatsLocation[];
  items: AdminSoldItem[];
  activeItems: AdminSoldItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const LOCATION_POINTS = [
  { name: "Santo Domingo", latitude: 18.4861, longitude: -69.9312, aliases: ["distrito nacional", "sdn"] },
  { name: "San Cristóbal", latitude: 18.4167, longitude: -70.1167, aliases: ["san cristobal"] },
  { name: "Santiago", latitude: 19.4517, longitude: -70.697, aliases: ["santiago de los caballeros"] },
  { name: "La Romana", latitude: 18.4273, longitude: -68.9728, aliases: [] },
  { name: "La Altagracia", latitude: 18.617, longitude: -68.7081, aliases: ["punta cana", "higuey", "higüey"] },
  { name: "San Pedro de Macorís", latitude: 18.4539, longitude: -69.3067, aliases: ["san pedro de macoris"] },
  { name: "Puerto Plata", latitude: 19.7902, longitude: -70.6884, aliases: [] },
  { name: "La Vega", latitude: 19.2221, longitude: -70.5296, aliases: [] },
  { name: "Duarte", latitude: 19.3009, longitude: -70.2526, aliases: ["san francisco de macoris"] },
  { name: "Espaillat", latitude: 19.397, longitude: -70.525, aliases: ["moca"] },
  { name: "Peravia", latitude: 18.2796, longitude: -70.3319, aliases: ["bani", "baní"] },
  { name: "Azua", latitude: 18.4532, longitude: -70.7349, aliases: [] },
  { name: "Barahona", latitude: 18.2085, longitude: -71.1008, aliases: [] },
  { name: "Samaná", latitude: 19.2056, longitude: -69.3369, aliases: ["samana"] },
  { name: "Monte Cristi", latitude: 19.8483, longitude: -71.6453, aliases: [] },
  { name: "Valverde", latitude: 19.5523, longitude: -71.0752, aliases: ["mao"] },
  { name: "Hermanas Mirabal", latitude: 19.3776, longitude: -70.4176, aliases: ["salcedo"] },
  { name: "María Trinidad Sánchez", latitude: 19.3832, longitude: -69.8474, aliases: ["maria trinidad sanchez", "nagua"] },
  { name: "Monseñor Nouel", latitude: 18.9369, longitude: -70.4092, aliases: ["monsenor nouel", "bonao"] },
  { name: "San Juan", latitude: 18.8059, longitude: -71.2299, aliases: [] },
] as const;

const PRODUCT_RULES = [
  { brand: "Apple", model: "iPhone", keywords: ["iphone", "i phone"] },
  { brand: "Apple", model: "iPad", keywords: ["ipad"] },
  { brand: "Apple", model: "MacBook", keywords: ["macbook", "mac book"] },
  { brand: "Apple", model: "AirPods", keywords: ["airpods", "air pods"] },
  { brand: "Samsung", model: "Galaxy", keywords: ["galaxy", "samsung galaxy"] },
  { brand: "Samsung", model: "Samsung", keywords: ["samsung"] },
  { brand: "Hyundai", model: "Tucson", keywords: ["tucson", "tucsón"] },
  { brand: "Hyundai", model: "Sonata", keywords: ["sonata"] },
  { brand: "Hyundai", model: "Elantra", keywords: ["elantra"] },
  { brand: "Hyundai", model: "Santa Fe", keywords: ["santa fe"] },
  { brand: "Toyota", model: "Corolla", keywords: ["corolla"] },
  { brand: "Toyota", model: "Camry", keywords: ["camry"] },
  { brand: "Toyota", model: "RAV4", keywords: ["rav4", "rav 4"] },
  { brand: "Toyota", model: "Hilux", keywords: ["hilux"] },
  { brand: "Toyota", model: "4Runner", keywords: ["4runner", "4 runner"] },
  { brand: "Honda", model: "Civic", keywords: ["civic"] },
  { brand: "Honda", model: "Accord", keywords: ["accord"] },
  { brand: "Honda", model: "CR-V", keywords: ["crv", "cr-v"] },
  { brand: "Kia", model: "Sportage", keywords: ["sportage"] },
  { brand: "Kia", model: "Sorento", keywords: ["sorento"] },
  { brand: "Nissan", model: "Sentra", keywords: ["sentra"] },
  { brand: "Nissan", model: "Frontier", keywords: ["frontier"] },
  { brand: "Jeep", model: "Wrangler", keywords: ["wrangler"] },
  { brand: "Jeep", model: "Grand Cherokee", keywords: ["grand cherokee", "cherokee"] },
  { brand: "Nike", model: "Nike", keywords: ["nike", "air force", "jordan"] },
  { brand: "Adidas", model: "Adidas", keywords: ["adidas", "yeezy"] },
  { brand: "Sony", model: "PlayStation", keywords: ["playstation", "ps4", "ps5"] },
  { brand: "Microsoft", model: "Xbox", keywords: ["xbox"] },
  { brand: "LG", model: "LG", keywords: ["lg"] },
  { brand: "Dell", model: "Dell", keywords: ["dell"] },
  { brand: "HP", model: "HP", keywords: ["hp"] },
  { brand: "Lenovo", model: "Lenovo", keywords: ["lenovo"] },
  { brand: "Xiaomi", model: "Xiaomi", keywords: ["xiaomi", "redmi", "poco"] },
  { brand: "Huawei", model: "Huawei", keywords: ["huawei"] },
  { brand: "Motorola", model: "Motorola", keywords: ["motorola", "moto g"] },
  { brand: "Canon", model: "Canon", keywords: ["canon"] },
  { brand: "Mabe", model: "Mabe", keywords: ["mabe"] },
  { brand: "Whirlpool", model: "Whirlpool", keywords: ["whirlpool"] },
] as const;

const FALLBACK_BRANDS = [
  "Apple",
  "Samsung",
  "Toyota",
  "Honda",
  "Hyundai",
  "Kia",
  "Nissan",
  "BMW",
  "Mercedes",
  "Ford",
  "Chevrolet",
  "Jeep",
  "Nike",
  "Adidas",
  "Sony",
  "LG",
  "Dell",
  "HP",
  "Lenovo",
  "Xiaomi",
  "Huawei",
  "Motorola",
  "Canon",
  "Mabe",
  "Whirlpool",
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function resolveLocation(location: string) {
  const normalized = normalize(location);
  const exact = LOCATION_POINTS.find(
    (point) => normalize(point.name) === normalized || point.aliases.some((alias) => normalize(alias) === normalized)
  );

  if (exact) return exact;

  const partial = LOCATION_POINTS.find((point) => {
    const name = normalize(point.name);
    return normalized.includes(name) || name.includes(normalized);
  });

  return partial || LOCATION_POINTS[0];
}

function includesKeyword(source: string, keyword: string) {
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) return false;
  if (source.includes(` ${normalizedKeyword} `)) return true;
  return source.startsWith(`${normalizedKeyword} `) || source.endsWith(` ${normalizedKeyword}`) || source === normalizedKeyword;
}

function inferProductIdentity(title: string, tags: string[] = []) {
  const source = normalize(`${title} ${tags.join(" ")}`);
  const paddedSource = ` ${source} `;
  const rule = PRODUCT_RULES.find((entry) => entry.keywords.some((keyword) => includesKeyword(paddedSource, keyword)));

  if (rule) {
    return { brand: rule.brand, model: rule.model };
  }

  const brand = FALLBACK_BRANDS.find((entry) => includesKeyword(paddedSource, entry));
  return { brand: brand || "Sin marca", model: "Sin modelo" };
}

function getDaysToSell(createdAt: number, soldAt: number) {
  if (!createdAt || !soldAt || soldAt < createdAt) return null;
  return Math.max(1, Math.ceil((soldAt - createdAt) / DAY_MS));
}

function getListingViews(listing: RawListing) {
  const value = Number(listing.views ?? listing.viewCount ?? listing.impressions ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildGroup(name: string, items: AdminSoldItem[]): AdminStatsGroup {
  const prices = items.map((item) => item.price);
  const days = items.map((item) => item.daysToSell).filter((value): value is number => value !== null);

  return {
    name,
    soldCount: items.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    avgPrice: prices.length ? roundMoney(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0,
    avgDaysToSell: days.length ? Math.round(average(days) || 0) : null,
  };
}

function groupBy(items: AdminSoldItem[], keyFor: (item: AdminSoldItem) => string) {
  const map = new Map<string, AdminSoldItem[]>();
  items.forEach((item) => {
    const key = keyFor(item) || "Sin clasificar";
    map.set(key, [...(map.get(key) || []), item]);
  });

  return Array.from(map.entries())
    .map(([name, rows]) => buildGroup(name, rows))
    .sort((a, b) => b.soldCount - a.soldCount || b.avgPrice - a.avgPrice);
}

function getTopName(items: AdminSoldItem[], keyFor: (item: AdminSoldItem) => string) {
  return groupBy(items, keyFor)[0]?.name || "Sin datos";
}

async function getInteractionMap() {
  const [chatSnap, messageSnap] = await Promise.all([
    getAdminDb().collection("chats").get(),
    getAdminDb().collection("messages").limit(3000).get(),
  ]);
  const map = new Map<string, { interactions: number; interactionUsers: string[] }>();
  const chats = new Map<
    string,
    { listingId: string; buyerId: string; buyerName: string; sellerId: string }
  >();

  chatSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { listingId?: string; buyerId?: string; buyerName?: string; sellerId?: string };
    const listingId = data.listingId?.trim();
    if (!listingId) return;

    const current = map.get(listingId) || { interactions: 0, interactionUsers: [] };
    const buyerKey = data.buyerId || data.buyerName || docSnap.id;
    const alreadyCounted = current.interactionUsers.includes(buyerKey);

    if (!alreadyCounted) {
      current.interactions += 1;
      current.interactionUsers.push(data.buyerName || data.buyerId || "Comprador");
    }

    map.set(listingId, current);
    chats.set(docSnap.id, {
      listingId,
      buyerId: data.buyerId || "",
      buyerName: data.buyerName || "Comprador",
      sellerId: data.sellerId || "",
    });
  });

  const messageCounts = new Map<string, number>();
  messageSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { chatId?: string; senderId?: string; senderRole?: string };
    const chat = data.chatId ? chats.get(data.chatId) : null;
    if (!chat) return;

    const isBuyerMessage = data.senderRole === "buyer" || data.senderId === chat.buyerId;
    if (!isBuyerMessage) return;

    messageCounts.set(chat.listingId, (messageCounts.get(chat.listingId) || 0) + 1);
  });

  messageCounts.forEach((count, listingId) => {
    const current = map.get(listingId);
    if (!current) return;
    current.interactions = Math.max(current.interactions, count);
    map.set(listingId, current);
  });

  return map;
}

function applyInteractions(items: AdminSoldItem[], interactionMap: Map<string, { interactions: number; interactionUsers: string[] }>) {
  return items.map((item) => {
    const interaction = interactionMap.get(item.listingId);
    return {
      ...item,
      interactions: interaction?.interactions || 0,
      interactionUsers: interaction?.interactionUsers || [],
    };
  });
}

async function getSearchEvents() {
  const snap = await getAdminDb()
    .collection("searchEvents")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .get();

  return snap.docs.map((docSnap) => docSnap.data() as RawSearchEvent);
}

function searchEventMatchesItem(event: RawSearchEvent, item: AdminSoldItem) {
  const eventLocation = normalize(event.location || "");
  const itemLocation = normalize(item.location);
  const eventCategory = normalize(event.category || "");
  const itemCategory = normalize(item.category);
  const query = normalize(event.normalizedQuery || event.query || "");

  if (eventLocation && eventLocation !== itemLocation) return false;
  if (eventCategory && eventCategory !== itemCategory) return false;
  if (!query) return Boolean(eventCategory);

  const productText = normalize(`${item.title} ${item.category} ${item.brand} ${item.model}`);
  return productText.includes(query) || query.includes(normalize(item.title));
}

function applySearchInterest(items: AdminSoldItem[], searchEvents: RawSearchEvent[]) {
  return items.map((item) => {
    const matches = searchEvents.filter((event) => searchEventMatchesItem(event, item));
    const searchUsers = Array.from(
      new Set(matches.map((event) => event.userId || "anon").filter(Boolean))
    );

    return {
      ...item,
      searchCount: matches.length,
      searchUsers,
    };
  });
}

function flattenSoldListing(snapshotId: string, listing: RawListing) {
  const rows: AdminSoldItem[] = [];
  const createdAt = Number(listing.createdAt || 0);
  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  const listingLocation = listing.location?.trim() || "Santo Domingo";
  const coordinates = resolveLocation(listingLocation);
  const views = getListingViews(listing);

  if ((listing.type || "article") === "bazar") {
    (listing.bazarItems || []).forEach((item) => {
      const soldAt = Number(item.soldAt || 0);
      const price = Number(item.price || 0);
      if (item.status !== "sold" || !soldAt || !Number.isFinite(price) || price <= 0) return;
      const title = item.title?.trim() || listing.title?.trim() || "Producto vendido";
      const identity = inferProductIdentity(title, tags);

      rows.push({
        id: `${snapshotId}:${item.id || title}`,
        listingId: snapshotId,
        status: "sold",
        image: item.image || listing.image || "",
        href: `/item/${snapshotId}`,
        title,
        category: listing.bazarCategory || listing.category || "Sin categoría",
        brand: identity.brand,
        model: identity.model,
        price,
        location: coordinates.name,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        createdAt,
        soldAt,
        daysToSell: getDaysToSell(createdAt, soldAt),
        views,
        interactions: 0,
        interactionUsers: [],
        searchCount: 0,
        searchUsers: [],
      });
    });
    return rows;
  }

  const soldAt = Number(listing.soldAt || 0);
  const price = Number(listing.price || 0);
  if (listing.status !== "sold" || !soldAt || !Number.isFinite(price) || price <= 0) return rows;

  const title = listing.title?.trim() || "Producto vendido";
  const identity = inferProductIdentity(title, tags);
  rows.push({
    id: snapshotId,
    listingId: snapshotId,
    status: "sold",
    image: listing.image || "",
    href: `/item/${snapshotId}`,
    title,
    category: listing.category || "Sin categoría",
    brand: identity.brand,
    model: identity.model,
    price,
    location: coordinates.name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    createdAt,
    soldAt,
    daysToSell: getDaysToSell(createdAt, soldAt),
    views: getListingViews(listing),
    interactions: 0,
    interactionUsers: [],
    searchCount: 0,
    searchUsers: [],
  });

  return rows;
}

function flattenActiveListing(snapshotId: string, listing: RawListing) {
  const rows: AdminSoldItem[] = [];
  const createdAt = Number(listing.createdAt || 0);
  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  const listingLocation = listing.location?.trim() || "Santo Domingo";
  const coordinates = resolveLocation(listingLocation);
  const views = getListingViews(listing);

  if ((listing.type || "article") === "bazar") {
    (listing.bazarItems || []).forEach((item) => {
      const price = Number(item.price || 0);
      if (item.status === "sold" || !Number.isFinite(price) || price <= 0) return;
      const title = item.title?.trim() || listing.title?.trim() || "Producto en venta";
      const identity = inferProductIdentity(title, tags);

      rows.push({
        id: `${snapshotId}:${item.id || title}`,
        listingId: snapshotId,
        status: "active",
        image: item.image || listing.image || "",
        href: `/item/${snapshotId}`,
        title,
        category: listing.bazarCategory || listing.category || "Sin categoría",
        brand: identity.brand,
        model: identity.model,
        price,
        location: coordinates.name,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        createdAt,
        soldAt: 0,
        daysToSell: null,
        views,
        interactions: 0,
        interactionUsers: [],
        searchCount: 0,
        searchUsers: [],
      });
    });
    return rows;
  }

  const price = Number(listing.price || 0);
  if (listing.status === "sold" || !Number.isFinite(price) || price <= 0) return rows;

  const title = listing.title?.trim() || "Producto en venta";
  const identity = inferProductIdentity(title, tags);
  rows.push({
    id: snapshotId,
    listingId: snapshotId,
    status: "active",
    image: listing.image || "",
    href: `/item/${snapshotId}`,
    title,
    category: listing.category || "Sin categoría",
    brand: identity.brand,
    model: identity.model,
    price,
    location: coordinates.name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    createdAt,
    soldAt: 0,
    daysToSell: null,
    views: getListingViews(listing),
    interactions: 0,
    interactionUsers: [],
    searchCount: 0,
    searchUsers: [],
  });

  return rows;
}

export async function getAdminMarketplaceStats(): Promise<AdminMarketplaceStats> {
  const [snapshot, interactionMap, searchEvents] = await Promise.all([
    getAdminDb().collection("listings").get(),
    getInteractionMap(),
    getSearchEvents(),
  ]);
  const items = applySearchInterest(applyInteractions(
    snapshot.docs
    .flatMap((docSnap) => flattenSoldListing(docSnap.id, docSnap.data() as RawListing))
      .sort((a, b) => b.soldAt - a.soldAt),
    interactionMap
  ), searchEvents);
  const activeItems = applySearchInterest(applyInteractions(
    snapshot.docs
    .flatMap((docSnap) => flattenActiveListing(docSnap.id, docSnap.data() as RawListing))
      .sort((a, b) => b.createdAt - a.createdAt),
    interactionMap
  ), searchEvents);

  const locations = Array.from(
    items.reduce((map, item) => {
      map.set(item.location, [...(map.get(item.location) || []), item]);
      return map;
    }, new Map<string, AdminSoldItem[]>())
  )
    .map(([name, rows]) => {
      const summary = buildGroup(name, rows);
      const first = rows[0];

      return {
        name,
        latitude: first.latitude,
        longitude: first.longitude,
        soldCount: rows.length,
        topCategory: getTopName(rows, (item) => item.category),
        topBrand: getTopName(rows, (item) => item.brand),
        minPrice: summary.minPrice,
        maxPrice: summary.maxPrice,
        avgDaysToSell: summary.avgDaysToSell,
        items: rows.slice(0, 25),
      };
    })
    .sort((a, b) => b.soldCount - a.soldCount);

  const totalRevenue = items.reduce((sum, item) => sum + item.price, 0);
  const days = items.map((item) => item.daysToSell).filter((value): value is number => value !== null);

  return {
    generatedAt: Date.now(),
    totalSold: items.length,
    totalRevenue,
    avgPrice: items.length ? roundMoney(totalRevenue / items.length) : 0,
    avgDaysToSell: days.length ? Math.round(average(days) || 0) : null,
    categoryStats: groupBy(items, (item) => item.category).slice(0, 12),
    brandStats: groupBy(items, (item) => item.brand).slice(0, 12),
    modelStats: groupBy(items, (item) => item.model).filter((entry) => entry.name !== "Sin modelo").slice(0, 12),
    bestSellers: groupBy(items, (item) => `${item.category} · ${item.brand} · ${item.model}`).slice(0, 8),
    locations,
    items: items.slice(0, 200),
    activeItems: activeItems.slice(0, 200),
  };
}
