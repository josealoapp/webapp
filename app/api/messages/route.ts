import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { isPostgresChatsEnabled } from "@/lib/postgres";
import {
  addMessageInPostgres,
  getChatFromPostgres,
  listMessagesFromPostgres,
  markChatReadInPostgres,
} from "@/lib/postgres-chats";

export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function cleanText(value: unknown, maxLength = 5000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanLimit(value: string | null) {
  const limit = Number(value || 50);
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

async function assertChatParticipant(chatId: string, userId: string) {
  if (isPostgresChatsEnabled()) {
    const chat = await getChatFromPostgres(chatId);
    if (!chat) throw new Error("chat/not-found");
    if (chat.buyerId !== userId && chat.sellerId !== userId) throw new Error("chat/forbidden");
    return chat;
  }

  const snap = await getAdminDb().collection("chats").doc(chatId).get();
  if (!snap.exists) throw new Error("chat/not-found");
  const chat = snap.data() as { buyerId?: string; sellerId?: string };
  if (chat.buyerId !== userId && chat.sellerId !== userId) throw new Error("chat/forbidden");
  return { id: snap.id, ...chat };
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);

    const chatId = cleanText(request.nextUrl.searchParams.get("chatId"), 200);
    const cursor = Number(request.nextUrl.searchParams.get("cursor") || 0) || null;
    const limit = cleanLimit(request.nextUrl.searchParams.get("limit"));

    if (!chatId) return NextResponse.json({ error: "message/missing-chat-id" }, { status: 400 });
    await assertChatParticipant(chatId, decoded.uid);

    if (isPostgresChatsEnabled()) {
      const result = await listMessagesFromPostgres({ chatId, cursor, pageSize: limit });
      return NextResponse.json(result);
    }

    const snap = await getAdminDb().collection("messages").where("chatId", "==", chatId).get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as { id: string; createdAt?: number }))
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
      .slice(-limit);
    return NextResponse.json({
      messages: rows,
      nextCursor: rows.length === limit ? Number(rows[0]?.createdAt || 0) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "message/list-failed";
    const status = message.startsWith("auth/") || message.includes("ID token") ? 401 : message === "chat/forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const chatId = cleanText(body.chatId, 200);
    const senderRole = body.senderRole === "seller" ? "seller" : "buyer";
    const text = cleanText(body.text, 5000);
    const imageUrl = cleanText(body.imageUrl, 1200);

    if (!chatId || (!text && !imageUrl)) {
      return NextResponse.json({ error: "message/invalid-payload" }, { status: 400 });
    }
    await assertChatParticipant(chatId, decoded.uid);

    if (isPostgresChatsEnabled()) {
      const message = await addMessageInPostgres({
        chatId,
        senderId: decoded.uid,
        senderRole,
        text,
        ...(imageUrl ? { imageUrl } : {}),
      });
      return NextResponse.json({ message });
    }

    const createdAt = Date.now();
    const adminDb = getAdminDb();
    const chatSnap = await adminDb.collection("chats").doc(chatId).get();
    const chat = chatSnap.data() as { sellerId?: string; buyerId?: string };
    const recipientId = decoded.uid === chat.sellerId ? chat.buyerId : chat.sellerId;
    const lastMessage = text || (imageUrl ? "Imagen" : "");
    const messageRef = await adminDb.collection("messages").add({
      chatId,
      senderId: decoded.uid,
      senderRole,
      text,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt,
      createdAtServer: FieldValue.serverTimestamp(),
    });
    await adminDb.collection("chats").doc(chatId).update({
      updatedAt: createdAt,
      updatedAtServer: FieldValue.serverTimestamp(),
      lastMessage,
      lastMessageSenderId: decoded.uid,
      ...(recipientId ? { [`unreadBy.${recipientId}`]: FieldValue.increment(1) } : {}),
    });

    return NextResponse.json({ message: { id: messageRef.id, chatId, senderId: decoded.uid, senderRole, text, imageUrl, createdAt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "message/write-failed";
    const status = message.startsWith("auth/") || message.includes("ID token") ? 401 : message === "chat/forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as Record<string, unknown>;
    const chatId = cleanText(body.chatId, 200);
    if (!chatId) return NextResponse.json({ error: "message/missing-chat-id" }, { status: 400 });
    await assertChatParticipant(chatId, decoded.uid);

    if (isPostgresChatsEnabled()) {
      await markChatReadInPostgres(chatId, decoded.uid);
      return NextResponse.json({ ok: true });
    }

    await getAdminDb().collection("chats").doc(chatId).update({
      [`unreadBy.${decoded.uid}`]: 0,
      [`readBy.${decoded.uid}`]: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "message/read-failed";
    return NextResponse.json({ error: message }, { status: message === "chat/forbidden" ? 403 : 500 });
  }
}
