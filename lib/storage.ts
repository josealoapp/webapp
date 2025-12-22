// lib/storage.ts
export type Chat = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerName: string;
  buyerName: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  chatId: string;
  sender: "buyer" | "seller";
  text: string;
  createdAt: number;
};

const CHATS_KEY = "josealo_chats";
const MESSAGES_KEY = "josealo_messages";

function safeParse<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getChats(): Chat[] {
  if (typeof window === "undefined") return [];
  return safeParse<Chat[]>(localStorage.getItem(CHATS_KEY), []);
}

export function saveChats(chats: Chat[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

export function getMessages(): Message[] {
  if (typeof window === "undefined") return [];
  return safeParse<Message[]>(localStorage.getItem(MESSAGES_KEY), []);
}

export function saveMessages(messages: Message[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export function upsertChat(chat: Chat) {
  const chats = getChats();
  const existingIndex = chats.findIndex((c) => c.id === chat.id);
  if (existingIndex >= 0) {
    chats[existingIndex] = chat;
  } else {
    chats.unshift(chat);
  }
  saveChats(chats);
}

export function addMessage(message: Message) {
  const messages = getMessages();
  messages.push(message);
  saveMessages(messages);

  // update chat updatedAt
  const chats = getChats();
  const chat = chats.find((c) => c.id === message.chatId);
  if (chat) {
    chat.updatedAt = Date.now();
    saveChats(chats.sort((a, b) => b.updatedAt - a.updatedAt));
  }
}

export function getChatMessages(chatId: string): Message[] {
  return getMessages()
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}