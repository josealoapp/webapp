"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { ChatRecord, subscribeInboxChatsForUser } from "@/lib/marketplace";

type AppBottomNavTab = "home" | "discover" | "create" | "messages" | "profile";

export default function AppBottomNav({ active }: { active: AppBottomNavTab }) {
  const [currentUserId, setCurrentUserId] = useState("");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const createHref = currentUserId ? "/item/new" : `/sign-in?next=${encodeURIComponent("/item/new")}`;

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || "");
      if (!user?.uid) setChats([]);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeInboxChatsForUser(currentUserId, setChats, () => setChats([]));
  }, [currentUserId]);

  const unreadMessages = useMemo(() => {
    if (!currentUserId) return 0;
    return chats.reduce((total, chat) => total + getUnreadCount(chat, currentUserId), 0);
  }, [chats, currentUserId]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3 text-xs text-neutral-400">
        <NavIcon icon={Home} label="Inicio" href="/" active={active === "home"} />
        <NavIcon icon={Navigation} label="Descubre" href="/descubre" active={active === "discover"} />
        <NavIcon icon={PlusSquare} label="Crear" href={createHref} active={active === "create"} />
        <NavIcon
          icon={MessageCircle}
          label="Negociacion"
          href="/messages"
          active={active === "messages"}
          badgeCount={unreadMessages}
        />
        <NavIcon icon={User} label="Perfil" href="/profile/me" active={active === "profile"} />
      </div>
    </nav>
  );
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

function NavIcon({
  icon: Icon,
  label,
  href,
  active = false,
  badgeCount = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  badgeCount?: number;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1 hover:text-white",
    active ? "text-orange-400" : "text-neutral-400",
  ].join(" ");

  return (
    <Link href={href} className={className} aria-label={label}>
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badgeCount > 0 ? (
          <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-black ring-2 ring-neutral-950">
            {badgeCount > 99 ? "+99" : badgeCount}
          </span>
        ) : null}
      </span>
      <span className="hidden text-[11px] sm:inline">{label}</span>
    </Link>
  );
}
