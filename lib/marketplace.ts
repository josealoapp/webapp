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
  const optimizedFiles = await Promise.all(files.map((file, index) => optimizeListingImage(file, index)));
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const uploads: string[] = [];
  const batchSize = 10;

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
  const snap = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), firestoreLimit(120)));
  const rows = snap.docs
    .map((d) => {
      const data = d.data() as Omit<Listing, "id">;
      return { id: d.id, ...data } as Listing;
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return rows;
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
    const snap = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), firestoreLimit(120)));
    const rows = snap.docs
      .map((d) => {
        const data = d.data() as Omit<Listing, "id">;
        return { id: d.id, ...data } as Listing;
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    onData(rows);
  });
}

export async function getListingById(id: string) {
  const snap = await getDoc(doc(db, "listings", id));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Listing, "id">;
  return { id: snap.id, ...data } as Listing;
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
  const id = getOfferChatId(input.listingId, input.buyerId);
  const now = Date.now();
  const chatRef = doc(db, "chats", id);

  await setDoc(
    chatRef,
    {
      ...input,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    },
    { merge: true }
  );

  return id;
}

export async function addChatMessage(input: {
  chatId: string;
  senderId: string;
  senderRole: "buyer" | "seller";
  text: string;
  imageUrl?: string;
}) {
  const createdAt = Date.now();
  const chat = await getChatById(input.chatId);
  const recipientId =
    chat && input.senderId === chat.sellerId ? chat.buyerId : chat?.sellerId;
  const lastMessage = input.text.trim() || (input.imageUrl ? "Imagen" : "");

  await addDoc(collection(db, "messages"), {
    ...input,
    createdAt,
    createdAtServer: serverTimestamp(),
  });

  await updateDoc(doc(db, "chats", input.chatId), {
    updatedAt: createdAt,
    updatedAtServer: serverTimestamp(),
    lastMessage,
    lastMessageSenderId: input.senderId,
    ...(recipientId ? { [`unreadBy.${recipientId}`]: increment(1) } : {}),
  });
}

export async function markChatRead(chatId: string, userId: string) {
  if (!chatId || !userId) return;

  await updateDoc(doc(db, "chats", chatId), {
    [`unreadBy.${userId}`]: 0,
    [`readBy.${userId}`]: Date.now(),
    updatedAtServer: serverTimestamp(),
  });
}

export async function getChatById(chatId: string) {
  const snap = await getDoc(doc(db, "chats", chatId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ChatRecord, "id">) } as ChatRecord;
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
  return onSnapshot(
    doc(db, "chats", chatId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }

      onData({ id: snap.id, ...(snap.data() as Omit<ChatRecord, "id">) } as ChatRecord);
    },
    (error) => {
      onError?.(error.code);
      onData(null);
    }
  );
}

export function subscribeMessagesForChat(
  chatId: string,
  onData: (messages: MessageRecord[]) => void,
  onError?: (code?: string) => void
) {
  const q = query(collection(db, "messages"), where("chatId", "==", chatId));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MessageRecord, "id">),
        }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        .slice(-50);

      onData(rows as MessageRecord[]);
    },
    (error) => onError?.(error.code)
  );
}

export function subscribeChatsForUser(
  userId: string,
  role: "buyer" | "seller",
  onData: (chats: ChatRecord[]) => void,
  onError?: (code?: string) => void
) {
  const field = role === "buyer" ? "buyerId" : "sellerId";
  const q = query(collection(db, "chats"), where(field, "==", userId));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatRecord, "id">),
      }))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

      onData(rows as ChatRecord[]);
    },
    (error) => {
      onError?.(error.code);
      onData([]);
    }
  );
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
  const parts = [
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    firestoreLimit(pageSize),
  ] as const;
  let snap;
  try {
    snap = await getDocs(query(...parts));
  } catch (error) {
    if (!isMissingFirestoreIndexError(error)) throw error;

    snap = await getDocs(
      query(collection(db, "messages"), where("chatId", "==", chatId), firestoreLimit(pageSize))
    );
  }
  const rows = snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MessageRecord, "id">),
    }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)) as MessageRecord[];
  const last = snap.docs[snap.docs.length - 1];

  return {
    messages: rows,
    nextCursor: snap.docs.length === pageSize ? Number(last?.get("createdAt") || 0) : null,
  };
}

export async function listChatsForUser(
  userId: string,
  role: "buyer" | "seller",
  cursor?: number | null,
  pageSize = 25
): Promise<ChatPageResult> {
  const field = role === "buyer" ? "buyerId" : "sellerId";
  const parts = [
    collection(db, "chats"),
    where(field, "==", userId),
    orderBy("updatedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    firestoreLimit(pageSize),
  ] as const;
  let snap;
  let usedFallback = false;
  try {
    snap = await getDocs(query(...parts));
  } catch (error) {
    if (!isMissingFirestoreIndexError(error)) throw error;

    usedFallback = true;
    snap = await getDocs(query(collection(db, "chats"), where(field, "==", userId), firestoreLimit(100)));
  }

  const rows = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ChatRecord, "id">),
  }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, pageSize) as ChatRecord[];
  const last = snap.docs[snap.docs.length - 1];

  return {
    chats: rows,
    nextCursor: !usedFallback && snap.docs.length === pageSize ? Number(last?.get("updatedAt") || 0) : null,
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
