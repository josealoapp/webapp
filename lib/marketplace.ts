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

export type Listing = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  price: number;
  category: string;
  description: string;
  tags: string[];
  paymentMethod: PaymentMethod;
  location: string;
  image: string;
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

export async function uploadListingImages(files: File[]) {
  const optimizedFiles = await Promise.all(files.map((file, index) => optimizeListingImage(file, index)));
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("auth/missing-token");
  }

  const formData = new FormData();
  optimizedFiles.forEach((file) => {
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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "upload/presign-failed");
  }

  const payload = (await response.json()) as {
    uploads: Array<{ fileUrl: string }>;
  };

  return payload.uploads.map((upload) => upload.fileUrl);
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
