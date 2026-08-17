import type { Listing } from "@/lib/marketplace";
import { normalizeListingSearchText } from "@/lib/listing-search-tokens";
import { pgQuery } from "@/lib/postgres";

type ListingRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  seller_whatsapp_number: string | null;
  seller_uses_whatsapp: boolean;
  type: string;
  title: string;
  price: string | number;
  currency: string;
  category: string;
  bazar_category: string | null;
  description: string;
  tags: unknown;
  payment_method: string;
  location: string;
  image: string;
  images: unknown;
  vehicle_year: number | null;
  clothing_size: string | null;
  shoe_size: string | null;
  bazar_items: unknown;
  bazar_duration_hours: number | null;
  bazar_ends_at_ms: number | string | null;
  status: string;
  reserved_for_user_id: string | null;
  reserved_for_user_name: string | null;
  reserved_at_ms: number | string | null;
  sold_at_ms: number | string | null;
  sold_with_josealo: boolean | null;
  sale_speed_rating: number | null;
  sold_to_user_id: string | null;
  sold_to_user_name: string | null;
  created_at_ms: number | string;
};

export type PostgresListingSearchInput = {
  searchQuery: string;
  searchTokens: string[];
  categoryValues: string[];
  locationValues: string[];
  status: string;
  type: string;
  ownerId: string;
  limit: number;
  cursor: { createdAt: number; id: string } | null;
};

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buildSearchDocument(payload: Record<string, unknown>) {
  const tags = Array.isArray(payload.tags) ? payload.tags.join(" ") : "";
  const bazarItems = Array.isArray(payload.bazarItems)
    ? payload.bazarItems
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const row = item as Record<string, unknown>;
          return `${row.title || ""} ${row.description || ""}`;
        })
        .join(" ")
    : "";

  return normalizeListingSearchText(
    `${payload.title || ""} ${payload.description || ""} ${payload.category || ""} ${
      payload.bazarCategory || ""
    } ${tags} ${bazarItems}`
  );
}

function serializeListing(row: ListingRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerAvatar: row.owner_avatar || "",
    sellerWhatsappNumber: row.seller_whatsapp_number || "",
    sellerUsesWhatsapp: row.seller_uses_whatsapp === true,
    type: row.type as Listing["type"],
    title: row.title,
    price: Number(row.price || 0),
    currency: row.currency as Listing["currency"],
    category: row.category,
    bazarCategory: row.bazar_category || "",
    description: row.description,
    tags: asArray<string>(row.tags),
    paymentMethod: row.payment_method as Listing["paymentMethod"],
    location: row.location,
    image: row.image,
    images: asArray<string>(row.images),
    vehicleYear: row.vehicle_year || undefined,
    clothingSize: row.clothing_size || undefined,
    shoeSize: row.shoe_size || undefined,
    bazarItems: asArray(row.bazar_items),
    bazarDurationHours: row.bazar_duration_hours || undefined,
    bazarEndsAt: asNumber(row.bazar_ends_at_ms),
    createdAt: asNumber(row.created_at_ms) || 0,
    status: row.status as Listing["status"],
    reservedForUserId: row.reserved_for_user_id || "",
    reservedForUserName: row.reserved_for_user_name || "",
    reservedAt: asNumber(row.reserved_at_ms),
    soldAt: asNumber(row.sold_at_ms),
    soldWithJosealo: row.sold_with_josealo ?? undefined,
    saleSpeedRating: row.sale_speed_rating as Listing["saleSpeedRating"],
    soldToUserId: row.sold_to_user_id || "",
    soldToUserName: row.sold_to_user_name || "",
  };
}

function rowValues(payload: Record<string, unknown>) {
  return {
    owner_id: payload.ownerId,
    owner_name: payload.ownerName,
    owner_avatar: payload.ownerAvatar || null,
    seller_whatsapp_number: payload.sellerWhatsappNumber || null,
    seller_uses_whatsapp: payload.sellerUsesWhatsapp === true,
    type: payload.type || "article",
    title: payload.title,
    price: payload.price,
    currency: payload.currency || "DOP",
    category: payload.category,
    bazar_category: payload.bazarCategory || null,
    description: payload.description,
    tags: JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []),
    payment_method: payload.paymentMethod || "efectivo",
    location: payload.location,
    image: payload.image,
    images: JSON.stringify(Array.isArray(payload.images) ? payload.images : []),
    vehicle_year: payload.vehicleYear || null,
    clothing_size: payload.clothingSize || null,
    shoe_size: payload.shoeSize || null,
    bazar_items: JSON.stringify(Array.isArray(payload.bazarItems) ? payload.bazarItems : []),
    bazar_duration_hours: payload.bazarDurationHours || null,
    bazar_ends_at_ms: payload.bazarEndsAt || null,
    status: payload.status || "active",
    reserved_for_user_id: payload.reservedForUserId || null,
    reserved_for_user_name: payload.reservedForUserName || null,
    reserved_at_ms: payload.reservedAt || null,
    sold_at_ms: payload.soldAt || null,
    sold_with_josealo: typeof payload.soldWithJosealo === "boolean" ? payload.soldWithJosealo : null,
    sale_speed_rating: payload.saleSpeedRating || null,
    sold_to_user_id: payload.soldToUserId || null,
    sold_to_user_name: payload.soldToUserName || null,
    search_tokens: Array.isArray(payload.searchTokens) ? payload.searchTokens : [],
    search_document: buildSearchDocument(payload),
    created_at_ms: payload.createdAt,
    updated_at_ms: payload.updatedAt || null,
  };
}

export async function createListingInPostgres(payload: Record<string, unknown>) {
  const row = rowValues(payload);
  const result = await pgQuery<{ id: string }>(
    `
      insert into listings (
        owner_id, owner_name, owner_avatar, seller_whatsapp_number, seller_uses_whatsapp,
        type, title, price, currency, category, bazar_category, description, tags,
        payment_method, location, image, images, vehicle_year, clothing_size, shoe_size,
        bazar_items, bazar_duration_hours, bazar_ends_at_ms, status,
        reserved_for_user_id, reserved_for_user_name, reserved_at_ms,
        sold_at_ms, sold_with_josealo, sale_speed_rating, sold_to_user_id, sold_to_user_name,
        search_tokens, search_document, created_at_ms, updated_at_ms
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
        $14, $15, $16, $17::jsonb, $18, $19, $20,
        $21::jsonb, $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30, $31, $32,
        $33::text[], $34, $35, $36
      )
      returning id
    `,
    Object.values(row)
  );

  return result.rows[0]?.id || "";
}

export async function updateListingInPostgres(listingId: string, payload: Record<string, unknown>) {
  const row = rowValues(payload);
  const entries = Object.entries(row).filter(([key, value]) => key !== "created_at_ms" && value !== undefined);
  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);

  await pgQuery(
    `
      update listings
      set ${assignments.join(", ")}, updated_at = now()
      where id = $1
    `,
    [listingId, ...entries.map(([, value]) => value)]
  );
}

export async function removeListingInPostgres(listingId: string) {
  const now = Date.now();
  await pgQuery(
    `
      update listings
      set status = 'removed_by_support', updated_at_ms = $2, updated_at = now()
      where id = $1
    `,
    [listingId, now]
  );
}

export async function updateSellerWhatsappForOwnerInPostgres(
  ownerId: string,
  input: { sellerWhatsappNumber: string; sellerUsesWhatsapp: boolean }
) {
  await pgQuery(
    `
      update listings
      set seller_whatsapp_number = $2,
          seller_uses_whatsapp = $3,
          updated_at_ms = $4,
          updated_at = now()
      where owner_id = $1
    `,
    [ownerId, input.sellerWhatsappNumber || null, input.sellerUsesWhatsapp === true, Date.now()]
  );
}

export async function getListingOwnerInPostgres(listingId: string) {
  const result = await pgQuery<{ owner_id: string }>("select owner_id from listings where id = $1", [listingId]);
  return result.rows[0]?.owner_id || null;
}

export async function isAccountDeactivatedInPostgres(userId: string) {
  const result = await pgQuery<{ support_status: string }>(
    "select support_status from user_profiles where id = $1",
    [userId]
  );

  return result.rows[0]?.support_status === "deactivated";
}

export async function getListingByIdInPostgres(id: string) {
  const result = await pgQuery<ListingRow>("select * from listings where id = $1", [id]);
  const row = result.rows[0];
  return row ? serializeListing(row) : null;
}

export async function searchListingsInPostgres(input: PostgresListingSearchInput) {
  const values: unknown[] = [];
  const where: string[] = [];

  values.push(input.status);
  where.push(`status = $${values.length}`);

  if (input.searchTokens.length) {
    values.push(input.searchTokens);
    where.push(`search_tokens && $${values.length}::text[]`);
  }

  if (input.searchQuery) {
    values.push(`%${input.searchQuery}%`);
    where.push(`search_document like $${values.length}`);
  }

  if (input.locationValues.length) {
    values.push(input.locationValues);
    where.push(`location = any($${values.length}::text[])`);
  }

  if (input.categoryValues.length) {
    values.push(input.categoryValues);
    where.push(`category = any($${values.length}::text[])`);
  }

  if (input.type) {
    values.push(input.type);
    where.push(`type = $${values.length}`);
  }

  if (input.ownerId) {
    values.push(input.ownerId);
    where.push(`owner_id = $${values.length}`);
  }

  if (input.cursor) {
    values.push(input.cursor.createdAt, input.cursor.id);
    where.push(`(created_at_ms < $${values.length - 1} or (created_at_ms = $${values.length - 1} and id < $${values.length}))`);
  }

  values.push(input.limit + 1);
  const result = await pgQuery<ListingRow>(
    `
      select *
      from listings
      where ${where.join(" and ")}
      order by created_at_ms desc, id desc
      limit $${values.length}
    `,
    values
  );

  const hasNextPage = result.rows.length > input.limit;
  const pageRows = result.rows.slice(0, input.limit);

  return {
    items: pageRows.map(serializeListing),
    nextCursorSource: hasNextPage ? pageRows[pageRows.length - 1] : null,
  };
}
