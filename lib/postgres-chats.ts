import { randomUUID } from "crypto";
import type { ChatRecord, MessageRecord } from "@/lib/marketplace";
import { pgQuery, pgTransaction } from "@/lib/postgres";

type ChatRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
  updated_at_ms: number | string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chatFromRow(row: ChatRow): ChatRecord {
  return {
    id: row.id,
    ...(row.data || {}),
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    createdAt: toNumber(row.created_at_ms),
    updatedAt: toNumber(row.updated_at_ms),
  } as ChatRecord;
}

function messageFromRow(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    ...(row.data || {}),
    chatId: row.chat_id,
    senderId: row.sender_id,
    createdAt: toNumber(row.created_at_ms),
  } as MessageRecord;
}

export function chatIdFor(listingId: string, buyerId: string) {
  return `chat_${listingId}_${buyerId}`;
}

export async function upsertChatInPostgres(chat: ChatRecord) {
  await pgQuery(
    `
      insert into chats (id, listing_id, buyer_id, seller_id, data, created_at_ms, updated_at_ms)
      values ($1, $2, $3, $4, $5::jsonb, $6, $7)
      on conflict (id) do update
      set
        listing_id = excluded.listing_id,
        buyer_id = excluded.buyer_id,
        seller_id = excluded.seller_id,
        data = chats.data || excluded.data,
        updated_at_ms = excluded.updated_at_ms
    `,
    [
      chat.id,
      chat.listingId,
      chat.buyerId,
      chat.sellerId,
      JSON.stringify(chat),
      chat.createdAt || Date.now(),
      chat.updatedAt || Date.now(),
    ]
  );
}

export async function getChatFromPostgres(chatId: string) {
  const result = await pgQuery<ChatRow>("select * from chats where id = $1", [chatId]);
  const row = result.rows[0];
  return row ? chatFromRow(row) : null;
}

export async function listChatsFromPostgres(input: {
  userId: string;
  role: "buyer" | "seller";
  cursor?: number | null;
  pageSize: number;
}) {
  const field = input.role === "buyer" ? "buyer_id" : "seller_id";
  const values: unknown[] = [input.userId];
  const where = [`${field} = $1`];

  if (input.cursor) {
    values.push(input.cursor);
    where.push(`updated_at_ms < $${values.length}`);
  }

  values.push(input.pageSize);
  const result = await pgQuery<ChatRow>(
    `
      select *
      from chats
      where ${where.join(" and ")}
      order by updated_at_ms desc
      limit $${values.length}
    `,
    values
  );

  const last = result.rows[result.rows.length - 1];
  return {
    chats: result.rows.map(chatFromRow),
    nextCursor: result.rows.length === input.pageSize ? toNumber(last?.updated_at_ms) : null,
  };
}

export async function addMessageInPostgres(input: {
  chatId: string;
  senderId: string;
  senderRole: "buyer" | "seller";
  text: string;
  imageUrl?: string;
}) {
  const chat = await getChatFromPostgres(input.chatId);
  if (!chat) throw new Error("chat/not-found");

  const createdAt = Date.now();
  const id = randomUUID();
  const recipientId = input.senderId === chat.sellerId ? chat.buyerId : chat.sellerId;
  const lastMessage = input.text.trim() || (input.imageUrl ? "Imagen" : "");
  const unreadBy = {
    ...(chat.unreadBy || {}),
    ...(recipientId ? { [recipientId]: Number(chat.unreadBy?.[recipientId] || 0) + 1 } : {}),
  };
  const nextChat = {
    ...chat,
    updatedAt: createdAt,
    lastMessage,
    lastMessageSenderId: input.senderId,
    unreadBy,
  };
  const message: MessageRecord = {
    id,
    ...input,
    createdAt,
  };

  await pgTransaction(async (query) => {
    await query(
      `
        insert into messages (id, chat_id, sender_id, data, created_at_ms)
        values ($1, $2, $3, $4::jsonb, $5)
      `,
      [message.id, message.chatId, message.senderId, JSON.stringify(message), message.createdAt]
    );
    await query(
      `
        insert into chats (id, listing_id, buyer_id, seller_id, data, created_at_ms, updated_at_ms)
        values ($1, $2, $3, $4, $5::jsonb, $6, $7)
        on conflict (id) do update
        set
          listing_id = excluded.listing_id,
          buyer_id = excluded.buyer_id,
          seller_id = excluded.seller_id,
          data = chats.data || excluded.data,
          updated_at_ms = excluded.updated_at_ms
      `,
      [
        nextChat.id,
        nextChat.listingId,
        nextChat.buyerId,
        nextChat.sellerId,
        JSON.stringify(nextChat),
        nextChat.createdAt || createdAt,
        nextChat.updatedAt || createdAt,
      ]
    );
  });

  return message;
}

export async function markChatReadInPostgres(chatId: string, userId: string) {
  const chat = await getChatFromPostgres(chatId);
  if (!chat) return;

  const now = Date.now();
  await upsertChatInPostgres({
    ...chat,
    updatedAt: chat.updatedAt || now,
    unreadBy: {
      ...(chat.unreadBy || {}),
      [userId]: 0,
    },
    readBy: {
      ...(chat.readBy || {}),
      [userId]: now,
    },
  });
}

export async function listMessagesFromPostgres(input: {
  chatId: string;
  cursor?: number | null;
  pageSize: number;
}) {
  const values: unknown[] = [input.chatId];
  const where = ["chat_id = $1"];

  if (input.cursor) {
    values.push(input.cursor);
    where.push(`created_at_ms < $${values.length}`);
  }

  values.push(input.pageSize);
  const result = await pgQuery<MessageRow>(
    `
      select *
      from messages
      where ${where.join(" and ")}
      order by created_at_ms desc
      limit $${values.length}
    `,
    values
  );
  const rows = result.rows.map(messageFromRow).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const last = result.rows[result.rows.length - 1];

  return {
    messages: rows,
    nextCursor: result.rows.length === input.pageSize ? toNumber(last?.created_at_ms) : null,
  };
}

export async function deleteChatFromPostgres(chatId: string) {
  await pgQuery("delete from chats where id = $1", [chatId]);
}

export async function createOfferChatInPostgres(input: {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  tradeListingId?: string;
  tradeListingTitle?: string;
  tradeListingPrice?: number;
  tradeListingImage?: string;
  tradeListingCurrency?: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  message: string;
}) {
  const now = Date.now();
  const chatId = chatIdFor(input.listingId, input.buyerId);
  const chat: ChatRecord = {
    id: chatId,
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    listingPrice: input.listingPrice,
    ...(input.tradeListingId && input.tradeListingTitle && input.tradeListingPrice
      ? {
          tradeListingId: input.tradeListingId,
          tradeListingTitle: input.tradeListingTitle,
          tradeListingPrice: input.tradeListingPrice,
          tradeListingImage: input.tradeListingImage || "",
          tradeListingCurrency: input.tradeListingCurrency === "USD" ? "USD" : "DOP",
        }
      : {}),
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    createdAt: now,
    updatedAt: now,
    lastMessage: input.message,
    lastMessageSenderId: input.buyerId,
    unreadBy: {
      [input.buyerId]: 0,
      [input.sellerId]: 1,
    },
  };
  const message: MessageRecord = {
    id: randomUUID(),
    chatId,
    senderId: input.buyerId,
    senderRole: "buyer",
    text: input.message,
    createdAt: now,
  };

  await pgTransaction(async (query) => {
    await query(
      `
        insert into chats (id, listing_id, buyer_id, seller_id, data, created_at_ms, updated_at_ms)
        values ($1, $2, $3, $4, $5::jsonb, $6, $7)
        on conflict (id) do update
        set
          listing_id = excluded.listing_id,
          buyer_id = excluded.buyer_id,
          seller_id = excluded.seller_id,
          data = chats.data || excluded.data,
          updated_at_ms = excluded.updated_at_ms
      `,
      [chat.id, chat.listingId, chat.buyerId, chat.sellerId, JSON.stringify(chat), chat.createdAt, chat.updatedAt]
    );
    await query(
      `
        insert into messages (id, chat_id, sender_id, data, created_at_ms)
        values ($1, $2, $3, $4::jsonb, $5)
      `,
      [message.id, message.chatId, message.senderId, JSON.stringify(message), message.createdAt]
    );
  });

  return chatId;
}
