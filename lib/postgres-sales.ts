import { randomUUID } from "crypto";
import { pgQuery, pgTransaction } from "@/lib/postgres";

type ReviewRequestRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
  updated_at_ms: number | string | null;
};

type RatingRow = {
  id: string;
  seller_id: string;
  buyer_id: string;
  listing_id: string | null;
  rating: number;
  comment: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

type SaleEventRow = {
  id: string;
  listing_id: string;
  type: string;
  data: Record<string, unknown>;
  sold_at_ms: number | string;
  listing_type: string | null;
  listing_title: string | null;
  listing_price: number | string | null;
  listing_currency: string | null;
  listing_image: string | null;
  listing_images: unknown;
  listing_status: string | null;
  listing_sold_to_user_name: string | null;
  bazar_items: unknown;
};

export type ProfileSaleRow = {
  id: string;
  listingId: string;
  bazarItemId: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  soldAt: number;
  soldToUserName: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function saleFromEventRow(row: SaleEventRow): ProfileSaleRow | null {
  const data = row.data || {};
  const bazarItemId = getString(data.bazarItemId);
  const bazarItems = asArray<Record<string, unknown>>(row.bazar_items);
  const bazarItem = bazarItemId ? bazarItems.find((item) => item.id === bazarItemId) : null;
  const isBazarSale = row.type === "bazarItem" || Boolean(bazarItemId);

  if (isBazarSale) {
    if (!bazarItem || bazarItem.status !== "sold") return null;
  } else if (row.listing_status !== "sold") {
    return null;
  }

  const listingImages = asArray<string>(row.listing_images);
  const image =
    getString(data.saleImage) ||
    getString(bazarItem?.image) ||
    row.listing_image ||
    listingImages[0] ||
    "";
  const title =
    getString(data.saleTitle) ||
    getString(bazarItem?.title) ||
    row.listing_title ||
    "Artículo vendido";
  const price =
    toNumber(data.salePrice as number | string | null | undefined) ||
    toNumber(bazarItem?.price as number | string | null | undefined) ||
    toNumber(row.listing_price);

  if (price <= 0) return null;

  return {
    id: row.id,
    listingId: row.listing_id,
    bazarItemId,
    title,
    price,
    currency: getString(data.saleCurrency) || getString(bazarItem?.currency) || row.listing_currency || "DOP",
    image,
    soldAt: toNumber(row.sold_at_ms),
    soldToUserName: getString(data.soldToUserName) || row.listing_sold_to_user_name || "No especificado",
  };
}

function requestFromRow(row: ReviewRequestRow) {
  return {
    id: row.id,
    ...(row.data || {}),
    listingId: row.listing_id,
    sellerId: row.seller_id,
    buyerId: row.buyer_id,
    status: row.status,
    createdAt: toNumber(row.created_at_ms),
    updatedAt: toNumber(row.updated_at_ms),
  };
}

function ratingFromRow(row: RatingRow) {
  return {
    id: row.id,
    ...(row.data || {}),
    sellerId: row.seller_id,
    buyerId: row.buyer_id,
    listingId: row.listing_id || "",
    rating: row.rating,
    comment: row.comment,
    createdAt: toNumber(row.created_at_ms),
  };
}

export async function upsertSoldEventInPostgres(event: Record<string, unknown>) {
  const id = typeof event.id === "string" && event.id ? event.id : randomUUID();
  const soldAt = Number(event.soldAt || Date.now());
  await pgQuery(
    `
      insert into listing_sold_events (id, listing_id, owner_id, type, data, sold_at_ms)
      values ($1, $2, $3, $4, $5::jsonb, $6)
      on conflict (id) do update
      set listing_id = excluded.listing_id,
          owner_id = excluded.owner_id,
          type = excluded.type,
          data = excluded.data,
          sold_at_ms = excluded.sold_at_ms
    `,
    [
      id,
      String(event.listingId || ""),
      String(event.ownerId || ""),
      String(event.type || "listing"),
      JSON.stringify({ id, ...event, soldAt }),
      soldAt,
    ]
  );
  return id;
}

export async function upsertReviewRequestInPostgres(request: Record<string, unknown>) {
  const id = String(request.id || "");
  const createdAt = Number(request.createdAt || Date.now());
  const updatedAt = Number(request.updatedAt || 0) || null;
  await pgQuery(
    `
      insert into purchase_review_requests (id, listing_id, seller_id, buyer_id, status, data, created_at_ms, updated_at_ms)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      on conflict (id) do update
      set listing_id = excluded.listing_id,
          seller_id = excluded.seller_id,
          buyer_id = excluded.buyer_id,
          status = excluded.status,
          data = purchase_review_requests.data || excluded.data,
          updated_at_ms = excluded.updated_at_ms
    `,
    [
      id,
      String(request.listingId || ""),
      String(request.sellerId || ""),
      String(request.buyerId || ""),
      String(request.status || "pending"),
      JSON.stringify({ ...request, id, createdAt }),
      createdAt,
      updatedAt,
    ]
  );
}

export async function listPendingReviewRequestsFromPostgres(buyerId: string) {
  const result = await pgQuery<ReviewRequestRow>(
    `
      select *
      from purchase_review_requests
      where buyer_id = $1 and status = 'pending'
      order by created_at_ms desc
      limit 5
    `,
    [buyerId]
  );
  return result.rows.map(requestFromRow);
}

export async function listReviewsForSellerFromPostgres(sellerId: string) {
  const result = await pgQuery<RatingRow>(
    `
      select *
      from user_ratings
      where seller_id = $1
      order by created_at_ms desc
      limit 30
    `,
    [sellerId]
  );
  return result.rows.map(ratingFromRow);
}

async function updateSellerRating(query: typeof pgQuery, sellerId: string, rating: number, now: number) {
  const current = await query<{ profile: Record<string, unknown> }>("select profile from user_profiles where id = $1", [
    sellerId,
  ]);
  const profile = current.rows[0]?.profile || {};
  const nextSum = Number(profile.sellerRatingSum || 0) + rating;
  const nextCount = Number(profile.sellerRatingCount || 0) + 1;
  const nextProfile = {
    ...profile,
    sellerRatingSum: nextSum,
    sellerRatingCount: nextCount,
    sellerRatingAvg: Math.round((nextSum / nextCount) * 10) / 10,
    updatedAt: now,
  };
  await query(
    `
      insert into user_profiles (id, profile, updated_at_ms)
      values ($1, $2::jsonb, $3)
      on conflict (id) do update
      set profile = user_profiles.profile || excluded.profile,
          updated_at_ms = excluded.updated_at_ms,
          updated_at = now()
    `,
    [sellerId, JSON.stringify(nextProfile), now]
  );
}

export async function createDirectReviewInPostgres(input: {
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
}) {
  const now = Date.now();
  const reviewId = `direct_${input.sellerId}_${input.buyerId}`;
  const existing = await pgQuery("select id from user_ratings where id = $1", [reviewId]);
  if (existing.rows.length) throw new Error("reviews/already-reviewed");

  await pgTransaction(async (query) => {
    const data = {
      requestId: "",
      sellerId: input.sellerId,
      sellerName: input.sellerName || "Vendedor",
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      listingId: "",
      bazarItemId: "",
      itemTitle: "Reseña directa",
      source: "direct",
      rating: input.rating,
      comment: input.comment,
      createdAt: now,
    };
    await query(
      `
        insert into user_ratings (id, seller_id, buyer_id, listing_id, rating, comment, data, created_at_ms)
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [reviewId, input.sellerId, input.buyerId, "", input.rating, input.comment, JSON.stringify(data), now]
    );
    await updateSellerRating(query, input.sellerId, input.rating, now);
  });
}

export async function completeReviewRequestInPostgres(input: {
  requestId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
}) {
  const request = await pgQuery<ReviewRequestRow>("select * from purchase_review_requests where id = $1", [
    input.requestId,
  ]);
  const row = request.rows[0];
  if (!row) throw new Error("reviews/not-found");
  if (row.buyer_id !== input.buyerId) throw new Error("reviews/forbidden");
  if (row.status !== "pending") return;
  const data = requestFromRow(row) as Record<string, unknown>;
  const now = Date.now();

  await pgTransaction(async (query) => {
    const ratingData = {
      requestId: input.requestId,
      ...data,
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      rating: input.rating,
      comment: input.comment,
      createdAt: now,
    };
    await query(
      `
        insert into user_ratings (id, seller_id, buyer_id, listing_id, rating, comment, data, created_at_ms)
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        on conflict (id) do nothing
      `,
      [
        input.requestId,
        row.seller_id,
        input.buyerId,
        row.listing_id,
        input.rating,
        input.comment,
        JSON.stringify(ratingData),
        now,
      ]
    );
    await query(
      `
        update purchase_review_requests
        set status = 'completed',
            data = data || $2::jsonb,
            updated_at_ms = $3
        where id = $1
      `,
      [input.requestId, JSON.stringify({ status: "completed", rating: input.rating, comment: input.comment, updatedAt: now }), now]
    );
    await updateSellerRating(query, row.seller_id, input.rating, now);
  });
}

export async function skipReviewRequestInPostgres(requestId: string, buyerId: string) {
  const result = await pgQuery<ReviewRequestRow>(
    "select buyer_id, status from purchase_review_requests where id = $1",
    [requestId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("reviews/not-found");
  if (row.buyer_id !== buyerId) throw new Error("reviews/forbidden");
  if (row.status !== "pending") return;
  const now = Date.now();
  await pgQuery(
    `
      update purchase_review_requests
      set status = 'skipped',
          data = data || $2::jsonb,
          updated_at_ms = $3
      where id = $1
    `,
    [requestId, JSON.stringify({ status: "skipped", updatedAt: now }), now]
  );
}

export async function getSalesCountFromPostgres(userId: string) {
  const sales = await listProfileSalesFromPostgres(userId);
  return sales.length;
}

export async function listProfileSalesFromPostgres(userId: string) {
  const result = await pgQuery<SaleEventRow>(
    `
      select
        e.id,
        e.listing_id,
        e.type,
        e.data,
        e.sold_at_ms,
        l.type as listing_type,
        l.title as listing_title,
        l.price as listing_price,
        l.currency as listing_currency,
        l.image as listing_image,
        l.images as listing_images,
        l.status as listing_status,
        l.sold_to_user_name as listing_sold_to_user_name,
        l.bazar_items
      from listing_sold_events e
      left join listings l on l.id = e.listing_id
      where e.owner_id = $1
      order by e.sold_at_ms desc
      limit 500
    `,
    [userId]
  );

  return result.rows.map(saleFromEventRow).filter((sale): sale is ProfileSaleRow => Boolean(sale));
}

export async function markListingSoldInPostgres(input: {
  listingId: string;
  bazarItemId?: string;
  ownerId: string;
  soldWithJosealo?: boolean;
  saleSpeedRating?: 1 | 2 | 3 | 4 | 5;
  soldToUserId?: string;
  soldToUserName?: string;
}) {
  const soldAt = Date.now();
  const listingResult = await pgQuery<{
    id: string;
    owner_id: string;
    owner_name: string;
    type: string;
    title: string;
    price: number | string;
    currency: string;
    image: string | null;
    images: unknown;
    bazar_items: unknown;
  }>("select id, owner_id, owner_name, type, title, price, currency, image, images, bazar_items from listings where id = $1", [input.listingId]);
  const listing = listingResult.rows[0];
  if (!listing) throw new Error("listing/not-found");
  if (listing.owner_id !== input.ownerId) throw new Error("listing/owner-mismatch");

  let soldToBuyer: { buyerId: string; buyerName: string } | null = null;
  if (input.soldToUserId) {
    const chat = await pgQuery<{ buyer_id: string; data: Record<string, unknown> }>(
      "select buyer_id, data from chats where listing_id = $1 and seller_id = $2 and buyer_id = $3 limit 1",
      [input.listingId, input.ownerId, input.soldToUserId]
    );
    const row = chat.rows[0];
    if (!row) throw new Error("listing/invalid-sold-buyer");
    soldToBuyer = {
      buyerId: row.buyer_id,
      buyerName: String(row.data?.buyerName || input.soldToUserName || "Comprador"),
    };
  }

  const feedback = {
    ...(typeof input.soldWithJosealo === "boolean" ? { soldWithJosealo: input.soldWithJosealo } : {}),
    ...(input.saleSpeedRating ? { saleSpeedRating: input.saleSpeedRating } : {}),
  };

  if (input.bazarItemId) {
    if ((listing.type || "article") !== "bazar") throw new Error("listing/not-bazar");
    const items = Array.isArray(listing.bazar_items) ? (listing.bazar_items as Array<Record<string, unknown>>) : [];
    const itemIndex = items.findIndex((item) => item.id === input.bazarItemId);
    if (itemIndex < 0) throw new Error("listing/bazar-item-not-found");
    const nextItems = items.map((item, index) =>
      index === itemIndex
        ? {
            ...item,
            status: "sold",
            soldAt: Number(item.soldAt || 0) > 0 ? Number(item.soldAt) : soldAt,
            ...feedback,
            ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
          }
        : item
    );
    const allItemsSold = nextItems.length > 0 && nextItems.every((item) => item.status === "sold");

    await pgTransaction(async (query) => {
      await query(
        `
          update listings
          set bazar_items = $2::jsonb,
              status = $3,
              sold_at_ms = $4,
              updated_at_ms = $5,
              updated_at = now()
          where id = $1
        `,
        [input.listingId, JSON.stringify(nextItems), allItemsSold ? "sold" : "active", allItemsSold ? soldAt : null, soldAt]
      );
      const event = {
        listingId: input.listingId,
        bazarItemId: input.bazarItemId,
        ownerId: input.ownerId,
        type: "bazarItem",
        saleTitle: String(items[itemIndex]?.title || listing.title || "Artículo"),
        salePrice: toNumber(items[itemIndex]?.price as number | string | null | undefined),
        saleCurrency: getString(items[itemIndex]?.currency) || listing.currency || "DOP",
        saleImage: getString(items[itemIndex]?.image),
        soldAt,
        allItemsSold,
        ...feedback,
        ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
      };
      await query(
        `
          insert into listing_sold_events (id, listing_id, owner_id, type, data, sold_at_ms)
          values ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [randomUUID(), input.listingId, input.ownerId, "bazarItem", JSON.stringify(event), soldAt]
      );
      if (soldToBuyer) {
        const request = {
          id: `${input.listingId}_${input.bazarItemId}_${soldToBuyer.buyerId}`,
          listingId: input.listingId,
          bazarItemId: input.bazarItemId,
          itemTitle: String(items[itemIndex]?.title || listing.title || "Artículo"),
          sellerId: input.ownerId,
          sellerName: listing.owner_name || "Vendedor",
          buyerId: soldToBuyer.buyerId,
          buyerName: soldToBuyer.buyerName,
          status: "pending",
          createdAt: soldAt,
        };
        await query(
          `
            insert into purchase_review_requests (id, listing_id, seller_id, buyer_id, status, data, created_at_ms)
            values ($1, $2, $3, $4, 'pending', $5::jsonb, $6)
            on conflict (id) do update set data = purchase_review_requests.data || excluded.data
          `,
          [request.id, input.listingId, input.ownerId, soldToBuyer.buyerId, JSON.stringify(request), soldAt]
        );
      }
    });

    return { status: allItemsSold ? "sold" : "active", soldAt, bazarItems: nextItems };
  }

  await pgTransaction(async (query) => {
    await query(
      `
        update listings
        set status = 'sold',
            image = '',
            sold_at_ms = $2,
            sold_with_josealo = $3,
            sale_speed_rating = $4,
            sold_to_user_id = $5,
            sold_to_user_name = $6,
            updated_at_ms = $2,
            updated_at = now()
        where id = $1
      `,
      [
        input.listingId,
        soldAt,
        typeof input.soldWithJosealo === "boolean" ? input.soldWithJosealo : null,
        input.saleSpeedRating || null,
        soldToBuyer?.buyerId || null,
        soldToBuyer?.buyerName || null,
      ]
    );
    const event = {
      listingId: input.listingId,
      ownerId: input.ownerId,
      type: "listing",
      saleTitle: listing.title || "Artículo",
      salePrice: toNumber(listing.price),
      saleCurrency: listing.currency || "DOP",
      saleImage: listing.image || asArray<string>(listing.images)[0] || "",
      soldAt,
      ...feedback,
      ...(soldToBuyer ? { soldToUserId: soldToBuyer.buyerId, soldToUserName: soldToBuyer.buyerName } : {}),
    };
    await query(
      `
        insert into listing_sold_events (id, listing_id, owner_id, type, data, sold_at_ms)
        values ($1, $2, $3, 'listing', $4::jsonb, $5)
      `,
      [randomUUID(), input.listingId, input.ownerId, JSON.stringify(event), soldAt]
    );
    if (soldToBuyer) {
      const request = {
        id: `${input.listingId}_${soldToBuyer.buyerId}`,
        listingId: input.listingId,
        itemTitle: listing.title || "Artículo",
        sellerId: input.ownerId,
        sellerName: listing.owner_name || "Vendedor",
        buyerId: soldToBuyer.buyerId,
        buyerName: soldToBuyer.buyerName,
        status: "pending",
        createdAt: soldAt,
      };
      await query(
        `
          insert into purchase_review_requests (id, listing_id, seller_id, buyer_id, status, data, created_at_ms)
          values ($1, $2, $3, $4, 'pending', $5::jsonb, $6)
          on conflict (id) do update set data = purchase_review_requests.data || excluded.data
        `,
        [request.id, input.listingId, input.ownerId, soldToBuyer.buyerId, JSON.stringify(request), soldAt]
      );
    }
  });

  return { status: "sold" as const, soldAt };
}

export async function updateListingChatActionInPostgres(input: {
  listingId: string;
  chatId?: string;
  ownerId: string;
  action: "reserve" | "sell" | "unreserve";
}) {
  const now = Date.now();
  const listingResult = await pgQuery<{
    id: string;
    owner_id: string;
    owner_name: string;
    title: string;
    status: string;
  }>("select id, owner_id, owner_name, title, status from listings where id = $1", [input.listingId]);
  const listing = listingResult.rows[0];
  if (!listing) throw new Error("listing/not-found");
  if (listing.owner_id !== input.ownerId) throw new Error("listing/owner-mismatch");
  if ((listing.status || "active") === "sold") throw new Error("listing/already-sold");

  if (input.action === "unreserve") {
    await pgQuery(
      `
        update listings
        set reserved_for_user_id = null,
            reserved_for_user_name = null,
            reserved_at_ms = null,
            updated_at_ms = $2,
            updated_at = now()
        where id = $1
      `,
      [input.listingId, now]
    );
    return { buyerId: "", buyerName: "", title: listing.title || "Artículo", status: listing.status || "active" };
  }

  if (!input.chatId) throw new Error("chat/not-found");
  const chatResult = await pgQuery<{ listing_id: string; seller_id: string; buyer_id: string; data: Record<string, unknown> }>(
    "select listing_id, seller_id, buyer_id, data from chats where id = $1",
    [input.chatId]
  );
  const chat = chatResult.rows[0];
  if (!chat) throw new Error("chat/not-found");
  if (chat.listing_id !== input.listingId && chat.data?.tradeListingId !== input.listingId) {
    throw new Error("listing/chat-mismatch");
  }

  const buyerId = chat.listing_id === input.listingId ? chat.buyer_id : chat.seller_id;
  const buyerName =
    chat.listing_id === input.listingId
      ? String(chat.data?.buyerName || "Comprador")
      : String(chat.data?.sellerName || "Comprador");
  if (!buyerId) throw new Error("listing/missing-buyer");

  if (input.action === "reserve") {
    await pgQuery(
      `
        update listings
        set reserved_for_user_id = $2,
            reserved_for_user_name = $3,
            reserved_at_ms = $4,
            updated_at_ms = $4,
            updated_at = now()
        where id = $1
      `,
      [input.listingId, buyerId, buyerName, now]
    );
    return {
      buyerId,
      buyerName,
      title: listing.title || String(chat.data?.listingTitle || "Artículo"),
      status: listing.status || "active",
      reservedAt: now,
    };
  }

  await markListingSoldInPostgres({
    listingId: input.listingId,
    ownerId: input.ownerId,
    soldWithJosealo: true,
    saleSpeedRating: 5,
    soldToUserId: buyerId,
    soldToUserName: buyerName,
  });

  return {
    buyerId,
    buyerName,
    title: listing.title || String(chat.data?.listingTitle || "Artículo"),
    status: "sold",
    soldAt: now,
  };
}
