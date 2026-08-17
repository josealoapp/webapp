import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { optimizeListingImage } from "@/lib/image-upload";

export type PaymentMethod = "efectivo" | "intercambio" | "ambos";
export type ListingType = "article" | "bazar";
export type ListingCurrency = "DOP" | "USD";

export type BazarItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency?: ListingCurrency;
  image: string;
  vehicleYear?: number;
  clothingSize?: string;
  shoeSize?: string;
  status?: "active" | "sold" | "removed_by_support" | "account_deactivated";
  soldAt?: number;
  soldWithJosealo?: boolean;
  saleSpeedRating?: 1 | 2 | 3 | 4 | 5;
  soldToUserId?: string;
  soldToUserName?: string;
};

export type Listing = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  sellerWhatsappNumber?: string;
  sellerUsesWhatsapp?: boolean;
  type?: ListingType;
  title: string;
  price: number;
  currency?: ListingCurrency;
  category: string;
  bazarCategory?: string;
  description: string;
  tags: string[];
  paymentMethod: PaymentMethod;
  location: string;
  image: string;
  images?: string[];
  vehicleYear?: number;
  clothingSize?: string;
  shoeSize?: string;
  bazarItems?: BazarItem[];
  bazarDurationHours?: number;
  bazarEndsAt?: number;
  createdAt: number;
  status?: "active" | "sold" | "removed_by_support" | "account_deactivated";
  reservedForUserId?: string;
  reservedForUserName?: string;
  reservedAt?: number;
  soldAt?: number;
  soldWithJosealo?: boolean;
  saleSpeedRating?: 1 | 2 | 3 | 4 | 5;
  soldToUserId?: string;
  soldToUserName?: string;
};

export type ListingSoldFeedback = {
  soldWithJosealo: boolean;
  saleSpeedRating: 1 | 2 | 3 | 4 | 5;
  soldToUserId?: string;
  soldToUserName?: string;
};

type SoldListingResponse = {
  ok?: boolean;
  error?: string;
  status?: "active" | "sold" | "removed_by_support" | "account_deactivated";
  soldAt?: number;
  bazarItems?: BazarItem[];
};

export type ListingSearchInput = {
  q?: string;
  category?: string;
  location?: string;
  status?: "active" | "sold";
  type?: ListingType;
  ownerId?: string;
  limit?: number;
  cursor?: string | null;
};

export type ListingSearchResult = {
  items: Listing[];
  nextCursor: string | null;
};

export type ChatPageResult = {
  chats: ChatRecord[];
  nextCursor: number | null;
};

export type MessagePageResult = {
  messages: MessageRecord[];
  nextCursor: number | null;
};

export function getActiveBazarItems(listing: Listing) {
  return (listing.bazarItems || []).filter((item) => item.status !== "sold");
}

export function isBazarExpired(listing: Listing, now = Date.now()) {
  return (listing.type || "article") === "bazar" && Boolean(listing.bazarEndsAt && listing.bazarEndsAt <= now);
}

export function getBazarSaleSummary(listing: Listing) {
  const items = listing.bazarItems || [];
  return {
    sold: items.filter((item) => item.status === "sold").length,
    total: items.length,
  };
}

export function isListingVisibleInMarketplace(listing: Listing) {
  if (listing.status === "sold" || listing.status === "removed_by_support" || listing.status === "account_deactivated") return false;
  if ((listing.type || "article") !== "bazar") return true;
  if (isBazarExpired(listing)) return false;
  return getActiveBazarItems(listing).length > 0;
}

export function isListingVisibleInOwnerProfile(listing: Listing) {
  if (listing.status === "sold" || listing.status === "removed_by_support" || listing.status === "account_deactivated") return false;
  if ((listing.type || "article") !== "bazar") return true;
  return getActiveBazarItems(listing).length > 0;
}

export function isListingInHistory(listing: Listing) {
  if (listing.status === "sold") return true;
  if ((listing.type || "article") !== "bazar") return false;
  if (isBazarExpired(listing)) return true;
  const bazarItems = listing.bazarItems || [];
  return bazarItems.length > 0 && bazarItems.every((item) => item.status === "sold");
}

export function getListingHistoryDate(listing: Listing) {
  if (listing.soldAt) return listing.soldAt;
  if (isBazarExpired(listing) && listing.bazarEndsAt) return listing.bazarEndsAt;
  if ((listing.type || "article") !== "bazar") return 0;
  return Math.max(0, ...((listing.bazarItems || []).map((item) => item.soldAt ?? 0)));
}

export type ChatRecord = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  tradeListingId?: string;
  tradeListingTitle?: string;
  tradeListingPrice?: number;
  tradeListingImage?: string;
  tradeListingCurrency?: ListingCurrency;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageSenderId?: string;
  unreadBy?: Record<string, number>;
  readBy?: Record<string, number>;
};

export type MessageRecord = {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: "buyer" | "seller";
  text: string;
  imageUrl?: string;
  createdAt: number;
};

export async function createListing(input: Omit<Listing, "id" | "createdAt">) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error || "listing/create-failed");
  }

  return payload.id;
}

export async function updateListing(
  listingId: string,
  input: Partial<Omit<Listing, "id" | "createdAt">>
) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: listingId,
      ...input,
    }),
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || "listing/update-failed");
  }
}

export async function deleteListing(listingId: string) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: listingId }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || "listing/delete-failed");
  }
}

export async function searchListings(input: ListingSearchInput = {}): Promise<ListingSearchResult> {
  const params = new URLSearchParams();

  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.category?.trim()) params.set("category", input.category.trim());
  if (input.location?.trim()) params.set("location", input.location.trim());
  if (input.status) params.set("status", input.status);
  if (input.type) params.set("type", input.type);
  if (input.ownerId?.trim()) params.set("ownerId", input.ownerId.trim());
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(`/api/listings/search?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { items?: Listing[]; nextCursor?: string | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "listings/search-failed");
  }

  return {
    items: payload?.items || [],
    nextCursor: payload?.nextCursor || null,
  };
}

export async function syncOwnerAvatarAcrossListings(ownerId: string, ownerAvatar: string) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ownerId, ownerAvatar }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "profile/avatar-sync-failed");
  }
}

export async function syncSellerWhatsappAcrossListings(
  ownerId: string,
  input: { sellerWhatsappNumber: string; sellerUsesWhatsapp: boolean }
) {
  const snap = await getDocs(query(collection(db, "listings"), where("ownerId", "==", ownerId)));

  await Promise.all(
    snap.docs.map((docSnap) =>
      updateDoc(doc(db, "listings", docSnap.id), {
        sellerWhatsappNumber: input.sellerWhatsappNumber,
        sellerUsesWhatsapp: input.sellerUsesWhatsapp,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      })
    )
  );
}

export async function uploadListingImages(files: File[]) {
  const optimizedFiles: File[] = [];
  for (const [index, file] of files.entries()) {
    try {
      optimizedFiles.push(await optimizeListingImage(file, index));
    } catch {
      optimizedFiles.push(file);
    }
  }
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const uploads: string[] = [];
  const batchSize = 1;

  for (let start = 0; start < optimizedFiles.length; start += batchSize) {
    const batch = optimizedFiles.slice(start, start + batchSize);
    const formData = new FormData();

    batch.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch("/api/uploads/listings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; details?: { message?: string; code?: string; statusCode?: number; name?: string } }
        | null;
      const detailMessage = payload?.details?.message || payload?.details?.code || payload?.details?.name;
      throw new Error(detailMessage ? `${payload?.error || "upload/presign-failed"}|${detailMessage}` : payload?.error || "upload/presign-failed");
    }

    const payload = (await response.json()) as {
      uploads: Array<{ fileUrl: string }>;
    };

    uploads.push(...payload.uploads.map((upload) => upload.fileUrl));
  }

  return uploads;
}

export async function createOffer(input: {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  tradeListingId?: string;
  tradeListingTitle?: string;
  tradeListingPrice?: number;
  tradeListingImage?: string;
  tradeListingCurrency?: ListingCurrency;
  sellerId: string;
  sellerName: string;
  message: string;
}) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/offers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { chatId?: string; error?: string }
    | null;

  if (!response.ok || !payload?.chatId) {
    throw new Error(payload?.error || "offer/create-failed");
  }

  return payload.chatId;
}

export async function deleteChat(chatId: string) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || "chat/delete-failed");
  }
}

export async function listListings() {
  const result = await searchListings({ limit: 120 });
  return result.items;
}

function subscribeWithPolling(load: () => Promise<void>, intervalMs = 15000) {
  let cancelled = false;

  const run = async () => {
    if (cancelled) return;
    await load();
  };

  void run();
  const intervalId = window.setInterval(run, intervalMs);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export function subscribeListings(onData: (listings: Listing[]) => void) {
  return subscribeWithPolling(async () => {
    const result = await searchListings({ limit: 120 });
    onData(result.items);
  });
}

export async function getListingById(id: string) {
  const response = await fetch(`/api/listings?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (response.status === 404) return null;

  const payload = (await response.json().catch(() => null)) as { listing?: Listing; error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || "listing/read-failed");
  }

  return payload?.listing || null;
}

export async function listOwnerListings(ownerId: string, cursor?: string | null, pageSize = 30): Promise<ListingSearchResult> {
  return searchListings({
    ownerId,
    status: "active",
    limit: pageSize,
    cursor,
  });
}

export async function markListingSold(listingId: string, feedback: ListingSoldFeedback) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings/sold", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listingId,
      ...feedback,
    }),
  });

  const payload = (await response.json().catch(() => null)) as SoldListingResponse | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "listing/sold-failed");
  }

  return payload;
}

export async function markBazarItemSold(listingId: string, bazarItemId: string) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings/sold", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listingId,
      bazarItemId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as SoldListingResponse | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "listing/sold-failed");
  }

  return payload;
}

export async function updateListingChatAction(input: {
  listingId: string;
  chatId?: string;
  action: "reserve" | "sell" | "unreserve";
}) {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const response = await fetch("/api/listings/chat-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        status?: Listing["status"];
        reservedForUserId?: string;
        reservedForUserName?: string;
        reservedAt?: number;
        soldAt?: number;
      }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "listing/chat-action-failed");
  }

  return payload;
}

export async function recordListingView(listingId: string, bazarItemId?: string) {
  const storageKey = `josealo_listing_view:${listingId}:${bazarItemId || "root"}`;
  const now = Date.now();

  if (typeof window !== "undefined") {
    const lastTracked = Number(window.localStorage.getItem(storageKey) || 0);
    if (lastTracked && now - lastTracked < 12 * 60 * 60 * 1000) {
      return;
    }
    window.localStorage.setItem(storageKey, String(now));
  }

  const token = await auth.currentUser?.getIdToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch("/api/listings/view", {
    method: "POST",
    headers,
    body: JSON.stringify({
      listingId,
      bazarItemId,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "listing/view-failed");
  }
}

export function getOfferChatId(listingId: string, buyerId: string) {
  return `chat_${listingId}_${buyerId}`;
}

export async function upsertChatFromOffer(input: {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
}) {
  return getOfferChatId(input.listingId, input.buyerId);
}

export async function addChatMessage(input: {
  chatId: string;
  senderId: string;
  senderRole: "buyer" | "seller";
  text: string;
  imageUrl?: string;
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "message/write-failed");
  }
}

export async function markChatRead(chatId: string, userId: string) {
  if (!chatId || !userId) return;

  const token = await auth.currentUser?.getIdToken();
  if (!token) return;

  await fetch("/api/messages", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId }),
  });
}

export async function getChatById(chatId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return null;

  const response = await fetch(`/api/chats?userId=${encodeURIComponent(auth.currentUser?.uid || "")}&role=buyer&limit=100`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const buyerPayload = (await response.json().catch(() => null)) as { chats?: ChatRecord[] } | null;
  const buyerChat = buyerPayload?.chats?.find((chat) => chat.id === chatId);
  if (buyerChat) return buyerChat;

  const sellerResponse = await fetch(`/api/chats?userId=${encodeURIComponent(auth.currentUser?.uid || "")}&role=seller&limit=100`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const sellerPayload = (await sellerResponse.json().catch(() => null)) as { chats?: ChatRecord[] } | null;
  return sellerPayload?.chats?.find((chat) => chat.id === chatId) || null;
}

export async function getExistingOfferChat(listingId: string, buyerId: string) {
  if (!listingId || !buyerId) return null;
  return getChatById(getOfferChatId(listingId, buyerId));
}

export function subscribeChatById(
  chatId: string,
  onData: (chat: ChatRecord | null) => void,
  onError?: (code?: string) => void
) {
  let cancelled = false;
  const load = async () => {
    try {
      const chat = await getChatById(chatId);
      if (!cancelled) onData(chat);
    } catch {
      onError?.("chat/load-failed");
      if (!cancelled) onData(null);
    }
  };
  void load();
  const intervalId = window.setInterval(load, 5000);
  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export function subscribeMessagesForChat(
  chatId: string,
  onData: (messages: MessageRecord[]) => void,
  onError?: (code?: string) => void
) {
  let cancelled = false;
  const load = async () => {
    try {
      const result = await listMessagesForChat(chatId, null, 50);
      if (!cancelled) onData(result.messages);
    } catch {
      onError?.("messages/load-failed");
    }
  };
  void load();
  const intervalId = window.setInterval(load, 5000);
  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export function subscribeChatsForUser(
  userId: string,
  role: "buyer" | "seller",
  onData: (chats: ChatRecord[]) => void,
  onError?: (code?: string) => void
) {
  let cancelled = false;
  const load = async () => {
    try {
      const result = await listChatsForUser(userId, role, null, 100);
      if (!cancelled) onData(result.chats);
    } catch {
      onError?.("chats/load-failed");
      if (!cancelled) onData([]);
    }
  };
  void load();
  const intervalId = window.setInterval(load, 5000);
  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

export function subscribeInboxChatsForUser(
  userId: string,
  onData: (chats: ChatRecord[]) => void,
  onError?: (code?: string) => void
) {
  let buyerChats: ChatRecord[] = [];
  let sellerChats: ChatRecord[] = [];

  const publish = () => {
    const rows = new Map<string, ChatRecord>();
    [...buyerChats, ...sellerChats].forEach((chat) => rows.set(chat.id, chat));
    onData(Array.from(rows.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
  };

  const unsubBuyer = subscribeChatsForUser(
    userId,
    "buyer",
    (rows) => {
      buyerChats = rows;
      publish();
    },
    onError
  );
  const unsubSeller = subscribeChatsForUser(
    userId,
    "seller",
    (rows) => {
      sellerChats = rows;
      publish();
    },
    onError
  );

  return () => {
    unsubBuyer();
    unsubSeller();
  };
}

export async function listMessagesForChat(
  chatId: string,
  cursor?: number | null,
  pageSize = 50
): Promise<MessagePageResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const params = new URLSearchParams({
    chatId,
    limit: String(pageSize),
  });
  if (cursor) params.set("cursor", String(cursor));
  const response = await fetch(`/api/messages?${params.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => null)) as MessagePageResult & { error?: string };
  if (!response.ok) throw new Error(payload?.error || "messages/list-failed");
  return {
    messages: payload.messages || [],
    nextCursor: payload.nextCursor || null,
  };
}

export async function listChatsForUser(
  userId: string,
  role: "buyer" | "seller",
  cursor?: number | null,
  pageSize = 25
): Promise<ChatPageResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("auth/missing-token");

  const params = new URLSearchParams({
    userId,
    role,
    limit: String(pageSize),
  });
  if (cursor) params.set("cursor", String(cursor));
  const response = await fetch(`/api/chats?${params.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => null)) as ChatPageResult & { error?: string };
  if (!response.ok) throw new Error(payload?.error || "chats/list-failed");
  return {
    chats: payload.chats || [],
    nextCursor: payload.nextCursor || null,
  };
}

function isMissingFirestoreIndexError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  const message = error instanceof Error ? error.message : "";

  return code === "failed-precondition" || message.toLowerCase().includes("index");
}
