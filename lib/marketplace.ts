import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { optimizeListingImage } from "@/lib/image-upload";

export type PaymentMethod = "efectivo" | "intercambio" | "transferencia";
export type ListingType = "article" | "bazar";

export type BazarItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  status?: "active" | "sold";
  soldAt?: number;
};

export type Listing = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  type?: ListingType;
  title: string;
  price: number;
  category: string;
  bazarCategory?: string;
  description: string;
  tags: string[];
  paymentMethod: PaymentMethod;
  location: string;
  image: string;
  bazarItems?: BazarItem[];
  createdAt: number;
  status?: "active" | "sold";
  soldAt?: number;
  soldWithJosealo?: boolean;
  saleSpeedRating?: 1 | 2 | 3 | 4 | 5;
};

export type ListingSoldFeedback = {
  soldWithJosealo: boolean;
  saleSpeedRating: 1 | 2 | 3 | 4 | 5;
};

export function getActiveBazarItems(listing: Listing) {
  return (listing.bazarItems || []).filter((item) => item.status !== "sold");
}

export function isListingVisibleInMarketplace(listing: Listing) {
  if (listing.status === "sold") return false;
  if ((listing.type || "article") !== "bazar") return true;
  return getActiveBazarItems(listing).length > 0;
}

export function isListingVisibleInOwnerProfile(listing: Listing) {
  if (listing.status === "sold") return false;
  if ((listing.type || "article") !== "bazar") return true;
  return getActiveBazarItems(listing).length > 0;
}

export function isListingInHistory(listing: Listing) {
  if (listing.status === "sold") return true;
  if ((listing.type || "article") !== "bazar") return false;
  const bazarItems = listing.bazarItems || [];
  return bazarItems.length > 0 && bazarItems.every((item) => item.status === "sold");
}

export function getListingHistoryDate(listing: Listing) {
  if (listing.soldAt) return listing.soldAt;
  if ((listing.type || "article") !== "bazar") return 0;
  return Math.max(0, ...((listing.bazarItems || []).map((item) => item.soldAt ?? 0)));
}

export type ChatRecord = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
};

export type MessageRecord = {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: "buyer" | "seller";
  text: string;
  createdAt: number;
};

export async function createListing(input: Omit<Listing, "id" | "createdAt">) {
  const createdAt = Date.now();
  const payload = {
    ...input,
    createdAt,
    createdAtServer: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "listings"), payload);
  return ref.id;
}

export async function updateListing(
  listingId: string,
  input: Partial<Omit<Listing, "id" | "createdAt">>
) {
  await updateDoc(doc(db, "listings", listingId), {
    ...input,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  });
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
  const snap = await getDocs(collection(db, "listings"));
  const rows = snap.docs
    .map((d) => {
      const data = d.data() as Omit<Listing, "id">;
      return { id: d.id, ...data } as Listing;
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return rows;
}

export function subscribeListings(onData: (listings: Listing[]) => void) {
  return onSnapshot(collection(db, "listings"), (snap) => {
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

export async function markListingSold(listingId: string, feedback: ListingSoldFeedback) {
  const soldAt = Date.now();

  await updateDoc(doc(db, "listings", listingId), {
    status: "sold",
    image: "",
    soldAt,
    soldWithJosealo: feedback.soldWithJosealo,
    saleSpeedRating: feedback.saleSpeedRating,
    soldAtServer: serverTimestamp(),
  });
}

export async function markBazarItemSold(listingId: string, bazarItemId: string) {
  const listing = await getListingById(listingId);
  if (!listing) {
    throw new Error("listing/not-found");
  }

  const soldAt = Date.now();

  const nextItems = (listing.bazarItems || []).map((item) =>
    item.id === bazarItemId
      ? {
          ...item,
          status: "sold" as const,
          soldAt,
        }
      : item
  );

  const allItemsSold = nextItems.length > 0 && nextItems.every((item) => item.status === "sold");

  await updateDoc(doc(db, "listings", listingId), {
    bazarItems: nextItems,
    status: allItemsSold ? "sold" : "active",
    soldAt: allItemsSold ? soldAt : null,
    soldAtServer: allItemsSold ? serverTimestamp() : null,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  });
}

function chatIdFor(listingId: string, buyerId: string) {
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
  const id = chatIdFor(input.listingId, input.buyerId);
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
}) {
  const createdAt = Date.now();
  await addDoc(collection(db, "messages"), {
    ...input,
    createdAt,
    createdAtServer: serverTimestamp(),
  });

  await setDoc(
    doc(db, "chats", input.chatId),
    {
      updatedAt: createdAt,
      updatedAtServer: serverTimestamp(),
      lastMessage: input.text,
    },
    { merge: true }
  );
}

export async function getChatById(chatId: string) {
  const snap = await getDoc(doc(db, "chats", chatId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ChatRecord, "id">) } as ChatRecord;
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
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

      onData(rows as MessageRecord[]);
    },
    (error) => {
      onError?.(error.code);
    }
  );
}

export function subscribeChatsForUser(
  userId: string,
  role: "buyer" | "seller",
  onData: (chats: ChatRecord[]) => void
) {
  const field = role === "buyer" ? "buyerId" : "sellerId";
  const q = query(collection(db, "chats"), where(field, "==", userId));

  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatRecord, "id">),
      }))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    onData(rows as ChatRecord[]);
  });
}

export function subscribeInboxChatsForUser(
  userId: string,
  onData: (chats: ChatRecord[]) => void
) {
  const chatMap = new Map<string, ChatRecord>();

  const emit = () => {
    const rows = Array.from(chatMap.values()).sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );
    onData(rows);
  };

  const subscribeByRole = (role: "buyer" | "seller") => {
    const field = role === "buyer" ? "buyerId" : "sellerId";
    const q = query(collection(db, "chats"), where(field, "==", userId));

    return onSnapshot(q, (snap) => {
      const currentIds = new Set(snap.docs.map((docSnap) => docSnap.id));

      for (const [chatId, chat] of chatMap.entries()) {
        const belongsToRole =
          role === "buyer" ? chat.buyerId === userId : chat.sellerId === userId;

        if (belongsToRole && !currentIds.has(chatId)) {
          chatMap.delete(chatId);
        }
      }

      snap.docs.forEach((docSnap) => {
        chatMap.set(
          docSnap.id,
          {
            id: docSnap.id,
            ...(docSnap.data() as Omit<ChatRecord, "id">),
          } as ChatRecord
        );
      });

      emit();
    });
  };

  const unsubBuyer = subscribeByRole("buyer");
  const unsubSeller = subscribeByRole("seller");

  return () => {
    unsubBuyer();
    unsubSeller();
  };
}
