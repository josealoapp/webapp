"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "@/lib/auth-client";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { auth } from "@/lib/firebase";
import { ChatRecord, subscribeInboxChatsForUser } from "@/lib/marketplace";

export default function UnreadMessageToast() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUserId, setCurrentUserId] = useState("");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const previousUnreadRef = useRef<number | null>(null);
  const lastNotifiedUnreadRef = useRef(0);
  const lastToastUserRef = useRef("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const userId = user?.uid || "";
      setCurrentUserId(userId);
      setChats([]);
      previousUnreadRef.current = null;
      lastNotifiedUnreadRef.current = 0;
      lastToastUserRef.current = "";
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeInboxChatsForUser(currentUserId, setChats);
  }, [currentUserId]);

  const unreadMessages = useMemo(() => {
    if (!currentUserId) return 0;
    return chats.reduce((total, chat) => total + getUnreadCount(chat, currentUserId), 0);
  }, [chats, currentUserId]);

  useEffect(() => {
    if (!currentUserId || pathname === "/messages") {
      previousUnreadRef.current = unreadMessages;
      return;
    }

    const previousUnread = previousUnreadRef.current;
    previousUnreadRef.current = unreadMessages;
    if (unreadMessages < lastNotifiedUnreadRef.current) {
      lastNotifiedUnreadRef.current = unreadMessages;
    }

    const hasUnreadAfterSignIn = previousUnread === null && unreadMessages > 0;
    const hasNewUnread =
      previousUnread !== null &&
      unreadMessages > previousUnread &&
      unreadMessages > lastNotifiedUnreadRef.current;
    const alreadyNotifiedOnSignIn = lastToastUserRef.current === currentUserId;

    if ((!hasUnreadAfterSignIn || alreadyNotifiedOnSignIn) && !hasNewUnread) return;

    lastToastUserRef.current = currentUserId;
    lastNotifiedUnreadRef.current = unreadMessages;
    toast("Tienes un mensaje", {
      id: "unread-message-toast",
      icon: <MessageCircle className="h-4 w-4" />,
      action: {
        label: "Inbox",
        onClick: () => router.push("/messages"),
      },
    });
  }, [currentUserId, pathname, router, unreadMessages]);

  return null;
}

function getUnreadCount(chat: ChatRecord, userId: string) {
  if (!userId) return 0;
  const unreadBy = chat.unreadBy || {};
  const hasStoredUnread = Object.prototype.hasOwnProperty.call(unreadBy, userId);
  const storedUnread = Math.max(0, Number(unreadBy[userId] || 0));
  if (hasStoredUnread) return storedUnread;

  const readAt = Number(chat.readBy?.[userId] || 0);
  const lastMessageAt = Number(chat.updatedAt || 0);
  if (chat.lastMessageSenderId && chat.lastMessageSenderId !== userId && lastMessageAt > readAt) {
    return 1;
  }

  return 0;
}
