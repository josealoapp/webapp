import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const { chatId } = await context.params;

    if (!chatId?.trim()) {
      return NextResponse.json({ error: "chat/invalid-id" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const chatRef = adminDb.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return NextResponse.json({ ok: true });
    }

    const chat = chatSnap.data() as {
      buyerId?: string;
      sellerId?: string;
    };

    if (chat.buyerId !== decoded.uid && chat.sellerId !== decoded.uid) {
      return NextResponse.json({ error: "chat/forbidden" }, { status: 403 });
    }

    const messagesSnap = await adminDb.collection("messages").where("chatId", "==", chatId).get();
    const batch = adminDb.batch();

    batch.delete(chatRef);
    messagesSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chat/delete-failed";
    const status =
      message.startsWith("auth/") || message.includes("ID token")
        ? 401
        : message === "chat/forbidden"
          ? 403
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
