"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "@/lib/auth-client";
import { Home, MessageCircle, Navigation, PlusSquare, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useThemeSetting } from "@/components/ThemeProvider";
import { ChatRecord, subscribeInboxChatsForUser } from "@/lib/marketplace";

type AppBottomNavTab = "home" | "discover" | "create" | "messages" | "profile";

export default function AppBottomNav({
  active,
  reserveSpace = true,
}: {
  active: AppBottomNavTab;
  reserveSpace?: boolean;
}) {
  const { theme } = useThemeSetting();
  const [mounted, setMounted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const createHref = currentUserId ? "/item/new" : `/sign-in?next=${encodeURIComponent("/item/new")}`;

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const nav = (
    <nav
      className={[
        "app-bottom-nav fixed inset-x-0 bottom-0 z-[2000] border-t backdrop-blur",
        theme === "light"
          ? "border-slate-200 bg-white shadow-[0_-12px_30px_rgba(249,115,22,0.08)]"
          : "border-neutral-800 bg-neutral-950/90",
      ].join(" ")}
    >
      <div className="mx-auto flex min-h-[var(--app-bottom-nav-height)] max-w-6xl items-center justify-around px-4 py-3 text-xs">
        <NavIcon icon={Home} label="Inicio" href="/" active={active === "home"} isLight={theme === "light"} />
        <NavIcon icon={Navigation} label="Descubre" href="/descubre" active={active === "discover"} isLight={theme === "light"} />
        <NavIcon icon={PlusSquare} label="Crear" href={createHref} active={active === "create"} isLight={theme === "light"} />
        <NavIcon
          icon={MessageCircle}
          label="Negociacion"
          href="/messages"
          active={active === "messages"}
          badgeCount={unreadMessages}
          isLight={theme === "light"}
        />
        <NavIcon icon={User} label="Perfil" href="/profile/me" active={active === "profile"} isLight={theme === "light"} />
      </div>
    </nav>
  );

  return (
    <>
      {reserveSpace ? <div className="app-bottom-nav-spacer" aria-hidden="true" /> : null}
      {!mounted || typeof document === "undefined" ? nav : createPortal(nav, document.body)}
    </>
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
  isLight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  badgeCount?: number;
  isLight?: boolean;
}) {
  const className = [
    "flex flex-col items-center gap-1 rounded-xl px-3 py-1",
    active ? "text-orange-400" : isLight ? "text-slate-500 hover:text-slate-900" : "text-neutral-400 hover:text-white",
  ].join(" ");

  return (
    <Link href={href} className={className} aria-label={label}>
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badgeCount > 0 ? (
          <span
            className={[
              "absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none ring-2",
              isLight ? "text-white ring-white" : "text-white ring-neutral-950",
            ].join(" ")}
          >
            {badgeCount > 99 ? "+99" : badgeCount}
          </span>
        ) : null}
      </span>
      <span className="hidden text-[11px] sm:inline">{label}</span>
    </Link>
  );
}
