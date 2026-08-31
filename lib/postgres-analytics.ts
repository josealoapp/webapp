import { pgQuery, pgTransaction } from "@/lib/postgres";

export type PostgresSearchEvent = {
  query?: string;
  normalizedQuery?: string;
  category?: string;
  location?: string;
  userId?: string;
  source?: string;
  createdAt?: number;
};

type SearchEventRow = {
  id: string;
  query: string;
  normalized_query: string;
  category: string;
  location: string;
  user_id: string;
  source: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

type ListingStatsRow = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  category: string;
  bazar_category: string | null;
  tags: unknown;
  location: string;
  type: string;
  bazar_items: unknown;
  image: string;
  views: number;
  view_count: number;
  impressions: number;
  created_at_ms: number | string;
  status: string;
  sold_at_ms: number | string | null;
};

type ChatStatsRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  data: Record<string, unknown>;
};

type MessageStatsRow = {
  chat_id: string;
  sender_id: string;
  data: Record<string, unknown>;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function searchEventFromRow(row: SearchEventRow) {
  return {
    id: row.id,
    ...(row.data || {}),
    query: row.query,
    normalizedQuery: row.normalized_query,
    category: row.category,
    location: row.location,
    userId: row.user_id,
    source: row.source,
    createdAt: toNumber(row.created_at_ms),
  };
}

export async function createSearchEventInPostgres(input: PostgresSearchEvent) {
  const createdAt = input.createdAt || Date.now();
  await pgQuery(
    `
      insert into search_events (
        query, normalized_query, category, location, user_id, source, data, created_at_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8
      )
    `,
    [
      input.query || "",
      input.normalizedQuery || "",
      input.category || "",
      input.location || "",
      input.userId || "",
      input.source || "search",
      JSON.stringify({ ...input, createdAt }),
      createdAt,
    ]
  );
}

export async function getUserPresenceFromPostgres(userId: string) {
  const result = await pgQuery<{ last_active_at_ms: number | string }>(
    "select last_active_at_ms from user_presence where user_id = $1",
    [userId]
  );
  return toNumber(result.rows[0]?.last_active_at_ms);
}

export async function updateUserPresenceInPostgres(userId: string) {
  const now = Date.now();
  await pgQuery(
    `
      insert into user_presence (user_id, last_active_at_ms, data, updated_at)
      values ($1, $2, $3::jsonb, now())
      on conflict (user_id) do update
      set last_active_at_ms = excluded.last_active_at_ms,
          data = user_presence.data || excluded.data,
          updated_at = now()
    `,
    [userId, now, JSON.stringify({ userId, lastActiveAt: now })]
  );
}

export async function recordListingViewInPostgres(input: {
  listingId: string;
  bazarItemId?: string;
  viewerId?: string;
}) {
  const viewedAt = Date.now();
  return pgTransaction(async (query) => {
    const listingResult = await query<{ owner_id: string }>("select owner_id from listings where id = $1", [input.listingId]);
    const ownerId = listingResult.rows[0]?.owner_id;
    if (!ownerId) throw new Error("listing/not-found");

    const isOwnerView = Boolean(input.viewerId && input.viewerId === ownerId);
    await query(
      `
        insert into listing_view_events (
          listing_id, bazar_item_id, owner_id, viewer_id, is_owner_view, data, viewed_at_ms
        ) values (
          $1, $2, $3, $4, $5, $6::jsonb, $7
        )
      `,
      [
        input.listingId,
        input.bazarItemId || null,
        ownerId,
        input.viewerId || "",
        isOwnerView,
        JSON.stringify({ ...input, ownerId, isOwnerView, viewedAt }),
        viewedAt,
      ]
    );

    if (!isOwnerView) {
      await query(
        `
          update listings
          set views = views + 1,
              view_count = view_count + 1,
              last_viewed_at_ms = $2,
              updated_at_ms = $2,
              updated_at = now()
          where id = $1
        `,
        [input.listingId, viewedAt]
      );
    }

    return { counted: !isOwnerView };
  });
}

export async function listSearchEventsForStatsFromPostgres() {
  const result = await pgQuery<SearchEventRow>(
    "select * from search_events order by created_at_ms desc limit 1500"
  );
  return result.rows.map(searchEventFromRow);
}

export async function listListingsForStatsFromPostgres() {
  const result = await pgQuery<ListingStatsRow>("select * from listings");
  return result.rows.map((row) => ({
    id: row.id,
    data: {
      title: row.title,
      price: Number(row.price || 0),
      currency: row.currency,
      category: row.category,
      bazarCategory: row.bazar_category || "",
      tags: asArray<string>(row.tags),
      location: row.location,
      type: row.type,
      bazarItems: asArray(row.bazar_items),
      image: row.image,
      views: row.views,
      viewCount: row.view_count,
      impressions: row.impressions,
      createdAt: toNumber(row.created_at_ms),
      status: row.status,
      soldAt: toNumber(row.sold_at_ms),
    },
  }));
}

export async function getInteractionMapFromPostgres() {
  const [chatResult, messageResult] = await Promise.all([
    pgQuery<ChatStatsRow>("select id, listing_id, buyer_id, seller_id, data from chats"),
    pgQuery<MessageStatsRow>("select chat_id, sender_id, data from messages order by created_at_ms desc limit 3000"),
  ]);

  const map = new Map<string, { interactions: number; interactionUsers: string[] }>();
  const chats = new Map<string, { listingId: string; buyerId: string; buyerName: string; sellerId: string }>();

  chatResult.rows.forEach((row) => {
    const listingId = row.listing_id?.trim();
    if (!listingId) return;
    const buyerName = String(row.data?.buyerName || row.buyer_id || "Comprador");
    const current = map.get(listingId) || { interactions: 0, interactionUsers: [] };
    const buyerKey = row.buyer_id || buyerName || row.id;

    if (!current.interactionUsers.includes(buyerKey)) {
      current.interactions += 1;
      current.interactionUsers.push(buyerName);
    }

    map.set(listingId, current);
    chats.set(row.id, {
      listingId,
      buyerId: row.buyer_id || "",
      buyerName,
      sellerId: row.seller_id || "",
    });
  });

  const messageCounts = new Map<string, number>();
  messageResult.rows.forEach((row) => {
    const chat = row.chat_id ? chats.get(row.chat_id) : null;
    if (!chat) return;

    const senderRole = String(row.data?.senderRole || "");
    const isBuyerMessage = senderRole === "buyer" || row.sender_id === chat.buyerId;
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
