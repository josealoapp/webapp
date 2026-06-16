const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const MAX_SEARCH_TOKENS = 80;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeListingSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildListingSearchTokens(input) {
  const bazarText = (input.bazarItems || [])
    .map((item) => `${item?.title || ""} ${item?.description || ""}`)
    .join(" ");
  const source = [
    input.title,
    input.description,
    input.category,
    input.bazarCategory,
    input.location,
    ...(Array.isArray(input.tags) ? input.tags : []),
    bazarText,
  ].join(" ");

  return Array.from(
    new Set(normalizeListingSearchText(source).split(" ").filter((token) => token.length >= 2))
  ).slice(0, MAX_SEARCH_TOKENS);
}

function buildSearchDocument(data) {
  const tags = Array.isArray(data.tags) ? data.tags.join(" ") : "";
  const bazarItems = Array.isArray(data.bazarItems)
    ? data.bazarItems
        .map((item) => `${item?.title || ""} ${item?.description || ""}`)
        .join(" ")
    : "";

  return normalizeListingSearchText(
    `${data.title || ""} ${data.description || ""} ${data.category || ""} ${data.bazarCategory || ""} ${tags} ${bazarItems}`
  );
}

function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function toJsonArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function listingRow(doc) {
  const data = doc.data() || {};
  const createdAt = toMillis(data.createdAt) || toMillis(data.createdAtServer) || Date.now();
  const updatedAt = toMillis(data.updatedAt) || toMillis(data.updatedAtServer) || null;
  const type = data.type === "bazar" ? "bazar" : "article";
  const bazarItems = Array.isArray(data.bazarItems) ? data.bazarItems : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const images = Array.isArray(data.images) ? data.images : data.image ? [data.image] : [];
  const searchTokens = Array.isArray(data.searchTokens)
    ? data.searchTokens
    : buildListingSearchTokens({
        title: data.title,
        description: data.description,
        category: data.category,
        bazarCategory: data.bazarCategory,
        location: data.location,
        tags,
        bazarItems,
      });

  return {
    id: doc.id,
    owner_id: data.ownerId || "",
    owner_name: data.ownerName || "Vendedor",
    owner_avatar: data.ownerAvatar || null,
    seller_whatsapp_number: data.sellerWhatsappNumber || null,
    seller_uses_whatsapp: data.sellerUsesWhatsapp === true,
    type,
    title: data.title || "",
    price: toNumber(data.price, 0),
    currency: data.currency || "DOP",
    category: data.category || "General",
    bazar_category: data.bazarCategory || null,
    description: data.description || "",
    tags: toJsonArray(tags),
    payment_method: data.paymentMethod || "efectivo",
    location: data.location || "",
    image: data.image || images[0] || "",
    images: toJsonArray(images),
    vehicle_year: toNumber(data.vehicleYear),
    clothing_size: data.clothingSize || null,
    shoe_size: data.shoeSize || null,
    bazar_items: toJsonArray(bazarItems),
    bazar_duration_hours: toNumber(data.bazarDurationHours),
    bazar_ends_at_ms: toMillis(data.bazarEndsAt) || toNumber(data.bazarEndsAt),
    status: data.status || "active",
    reserved_for_user_id: data.reservedForUserId || null,
    reserved_for_user_name: data.reservedForUserName || null,
    reserved_at_ms: toMillis(data.reservedAt) || toNumber(data.reservedAt),
    sold_at_ms: toMillis(data.soldAt) || toNumber(data.soldAt),
    sold_with_josealo: typeof data.soldWithJosealo === "boolean" ? data.soldWithJosealo : null,
    sale_speed_rating: toNumber(data.saleSpeedRating),
    sold_to_user_id: data.soldToUserId || null,
    sold_to_user_name: data.soldToUserName || null,
    views: toNumber(data.views, 0),
    view_count: toNumber(data.viewCount, toNumber(data.views, 0)),
    impressions: toNumber(data.impressions, 0),
    last_viewed_at_ms: toMillis(data.lastViewedAt) || toNumber(data.lastViewedAt),
    search_tokens: searchTokens,
    search_document: buildSearchDocument({ ...data, tags, bazarItems }),
    created_at_ms: createdAt,
    updated_at_ms: updatedAt,
  };
}

async function upsertListing(pool, row) {
  const columns = Object.keys(row);
  const jsonColumns = new Set(["tags", "images", "bazar_items"]);
  const arrayColumns = new Set(["search_tokens"]);
  const placeholders = columns.map((column, index) => {
    if (jsonColumns.has(column)) return `$${index + 1}::jsonb`;
    if (arrayColumns.has(column)) return `$${index + 1}::text[]`;
    return `$${index + 1}`;
  });
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  await pool.query(
    `
      insert into listings (${columns.join(", ")})
      values (${placeholders.join(", ")})
      on conflict (id) do update
      set ${updates}, updated_at = now()
    `,
    columns.map((column) => row[column])
  );
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: requireEnv("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }

  const firestore = getFirestore();
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const snapshot = await firestore.collection("listings").get();
    const docs = limit > 0 ? snapshot.docs.slice(0, limit) : snapshot.docs;

    console.log(`Found ${snapshot.size} Firestore listings. Migrating ${docs.length}.`);

    let migrated = 0;
    for (const doc of docs) {
      const row = listingRow(doc);
      if (!row.owner_id || !row.title || !row.image) {
        console.warn(`Skipping ${doc.id}: missing owner, title, or image.`);
        continue;
      }

      if (!dryRun) {
        await upsertListing(pool, row);
      }

      migrated += 1;
      if (migrated % 25 === 0) console.log(`Migrated ${migrated}/${docs.length} listings...`);
    }

    console.log(dryRun ? `Dry run complete: ${migrated} valid listings.` : `Migration complete: ${migrated} listings upserted.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
