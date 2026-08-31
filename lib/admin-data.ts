import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { AdminReportDetails, AdminReportRow, AdminReportedListing } from "@/lib/admin-types";
import { isPostgresAdminEnabled, pgQuery, pgTransaction } from "@/lib/postgres";
import {
  createSupportNotificationInPostgres,
  getReportFromPostgres,
  listReportsForUserFromPostgres,
  listReportsFromPostgres,
  markReportHandledInPostgres,
  setUserSupportStatusInPostgres,
} from "@/lib/postgres-admin";
import { getListingByIdInPostgres } from "@/lib/postgres-listings";

const CRITICAL_ACCOUNT_REASONS = new Set(["Estafa", "Artículo robado"]);
const APP_SALES_TIMEFRAMES = new Set([
  "last_week",
  "last_month",
  "last_3_months",
  "last_6_months",
  "last_year",
  "all_time",
]);
const USER_GRAPH_TIMEFRAMES = new Set([
  "last_week",
  "last_month",
  "last_3_months",
  "last_6_months",
  "last_year",
  "all_time",
]);

function itemRemovalMessage(reason: string) {
  if (reason === "Artículo no disponible") {
    return "Te recordamos mantener tus publicaciones actualizadas y marcar tus artículos como vendidos cuando ya no estén disponibles.";
  }
  if (reason === "Derechos de autor") {
    return "Esta acción cuenta como 1 strike. La publicación va en contra de nuestras políticas de derechos de autor.";
  }
  if (reason === "Artículo ilegal") {
    return "La publicación fue removida porque vender artículos ilegales va en contra de nuestras políticas y puede afectar permanentemente tu cuenta.";
  }
  if (reason === "Desnudez") {
    return "La publicación fue removida porque el contenido con desnudez va en contra de nuestras políticas de seguridad.";
  }
  return `La publicación fue removida por soporte debido a: ${reason}.`;
}

function accountDeactivationMessage(reason: string) {
  if (CRITICAL_ACCOUNT_REASONS.has(reason)) {
    return "Lo sentimos, tu cuenta fue involucrada en una acción fraudulenta crítica y ha sido suspendida permanentemente. Contáctanos si no estás de acuerdo con esta decisión.";
  }
  return `Tu cuenta fue desactivada por soporte debido a: ${reason}. Contáctanos si necesitas revisar esta decisión.`;
}

async function createSupportNotification(input: {
  userId: string;
  title: string;
  message: string;
  reason: string;
  type: "item_removed" | "account_deactivated" | "account_reactivated";
  listingId?: string;
}) {
  if (isPostgresAdminEnabled()) {
    await createSupportNotificationInPostgres(input);
    return;
  }

  await getAdminDb().collection("supportNotifications").add({
    ...input,
    read: false,
    createdAt: Date.now(),
    createdAtServer: FieldValue.serverTimestamp(),
  });
}

export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  isVerified: boolean;
  accountType?: "personal" | "business";
  businessName?: string;
  businessVerificationStatus?: "pending" | "verified" | "";
};

type AdminAuthUser = {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
  metadata: {
    creationTime?: string;
  };
};

async function listAllAuthUsers(): Promise<AdminAuthUser[]> {
  const auth = getAdminAuth();
  const users: AdminAuthUser[] = [];
  let nextPageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

async function getVerifiedMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, boolean>();
  }

  const refs = userIds.map((userId) => getAdminDb().collection("userProfiles").doc(userId));
  const snapshots = await getAdminDb().getAll(...refs);
  const map = new Map<string, boolean>();

  snapshots.forEach((snapshot) => {
    const data = snapshot.data() as { isVerified?: boolean } | undefined;
    map.set(snapshot.id, Boolean(data?.isVerified));
  });

  return map;
}

export async function listAdminUsers(query = "") {
  const users = await listAllAuthUsers();
  const verifiedMap = await getVerifiedMap(users.map((user) => user.uid));
  const profileRefs = users.map((user) => getAdminDb().collection("userProfiles").doc(user.uid));
  const profileSnaps = profileRefs.length ? await getAdminDb().getAll(...profileRefs) : [];
  const profileMap = new Map(profileSnaps.map((snap) => [snap.id, snap.data() as { supportStatus?: "active" | "deactivated"; supportDeactivationReason?: string } | undefined]));
  const privateProfileRefs = users.map((user) => getAdminDb().collection("userPrivateProfiles").doc(user.uid));
  const privateProfileSnaps = privateProfileRefs.length ? await getAdminDb().getAll(...privateProfileRefs) : [];
  const privateProfileMap = new Map(
    privateProfileSnaps.map((snap) => [
      snap.id,
      snap.data() as
        | {
            accountType?: "personal" | "business";
            businessProfile?: { businessName?: string };
            businessVerificationPending?: boolean;
          }
        | undefined,
    ])
  );
  const normalizedQuery = query.trim().toLowerCase();

  return users
    .map((user) => {
      const privateProfile = privateProfileMap.get(user.uid);
      const isVerified = verifiedMap.get(user.uid) || false;
      const accountType = privateProfile?.accountType === "business" ? "business" : "personal";
      const businessName = privateProfile?.businessProfile?.businessName?.trim() || "";
      const businessVerificationStatus =
        accountType === "business" ? (isVerified ? "verified" : privateProfile?.businessVerificationPending ? "pending" : "pending") : "";

      return {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email || "Usuario",
        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0,
        isVerified,
        accountType,
        businessName,
        businessVerificationStatus,
        supportStatus: profileMap.get(user.uid)?.supportStatus || "active",
        supportDeactivationReason: profileMap.get(user.uid)?.supportDeactivationReason || "",
      };
    })
    .filter((user) => {
      if (!normalizedQuery) return true;
      return (
        user.displayName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.businessName?.toLowerCase().includes(normalizedQuery) ||
        user.uid.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt) as AdminUserRow[];
}

export async function getAdminUserCountsByDay() {
  const users = await listAllAuthUsers();
  const map = new Map<string, number>();

  users.forEach((user) => {
    const date = user.metadata.creationTime
      ? new Date(user.metadata.creationTime).toISOString().slice(0, 10)
      : "";
    if (!date) return;
    map.set(date, (map.get(date) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultSevenDayWindow() {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (6 - index));
    return formatDateKey(date);
  });
}

function getDateRangeWindow(startDateKey = "", endDateKey = "") {
  if (!startDateKey || !endDateKey) return getDefaultSevenDayWindow();
  const start = new Date(`${startDateKey}T00:00:00.000Z`);
  const end = endDateKey ? new Date(`${endDateKey}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return getDefaultSevenDayWindow();

  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dayCount = Math.max(1, Math.floor((last.getTime() - first.getTime()) / 86400000) + 1);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return formatDateKey(date);
  });
}

export async function getAdminUserCountsForTimeframe(timeframe = "last_week") {
  const safeTimeframe = USER_GRAPH_TIMEFRAMES.has(timeframe) ? timeframe : "last_week";
  const users = await listAllAuthUsers();
  const createdDates = users
    .map((user) => user.metadata.creationTime ? new Date(user.metadata.creationTime) : null)
    .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (safeTimeframe === "last_week") {
    const days = getDefaultSevenDayWindow();
    return days.map((date) => ({
      date,
      label: date.slice(5),
      count: createdDates.filter((createdAt) => formatDateKey(createdAt) === date).length,
    }));
  }

  if (safeTimeframe === "last_month") {
    return Array.from({ length: 4 }, (_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - (3 - index) * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return {
        date: formatDateKey(start),
        label: `Sem ${index + 1}`,
        count: createdDates.filter((createdAt) => createdAt >= start && createdAt <= end).length,
      };
    });
  }

  if (safeTimeframe === "last_3_months" || safeTimeframe === "last_6_months" || safeTimeframe === "last_year") {
    const monthCount = safeTimeframe === "last_3_months" ? 3 : safeTimeframe === "last_6_months" ? 6 : 12;
    return Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      return {
        date: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("es-DO", { month: "short" }),
        count: createdDates.filter((createdAt) => createdAt.getFullYear() === year && createdAt.getMonth() === month).length,
      };
    });
  }

  const years = createdDates.map((date) => date.getFullYear());
  const firstYear = years.length ? Math.min(...years) : now.getFullYear();
  const lastYear = years.length ? Math.max(...years, now.getFullYear()) : now.getFullYear();
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index;
    return {
      date: String(year),
      label: String(year),
      count: createdDates.filter((createdAt) => createdAt.getFullYear() === year).length,
    };
  });
}

export async function getAdminUserCountsForRange(startDate = "", endDate = "") {
  const [countsByDay, days] = await Promise.all([
    getAdminUserCountsByDay(),
    Promise.resolve(getDateRangeWindow(startDate, endDate)),
  ]);
  const countMap = new Map(countsByDay.map((entry) => [entry.date, entry.count]));

  return days.map((date) => ({
    date,
    count: countMap.get(date) || 0,
  }));
}

export async function getAdminSoldSourceStats() {
  const eventsSnap = await getAdminDb().collection("listingSoldEvents").get();
  let soldWithJosealo = 0;
  let soldOutside = 0;

  eventsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { soldWithJosealo?: boolean };
    if (data.soldWithJosealo === true) {
      soldWithJosealo += 1;
    } else if (data.soldWithJosealo === false) {
      soldOutside += 1;
    }
  });

  return {
    soldWithJosealo,
    soldOutside,
    total: soldWithJosealo + soldOutside,
  };
}

function getSalesTimeframeStart(timeframe: string) {
  if (timeframe === "all_time") return 0;

  const start = new Date();
  if (timeframe === "last_week") start.setDate(start.getDate() - 7);
  else if (timeframe === "last_month") start.setMonth(start.getMonth() - 1);
  else if (timeframe === "last_3_months") start.setMonth(start.getMonth() - 3);
  else if (timeframe === "last_6_months") start.setMonth(start.getMonth() - 6);
  else if (timeframe === "last_year") start.setFullYear(start.getFullYear() - 1);
  else return 0;

  return start.getTime();
}

export async function getAdminAppSalesSummary(timeframe = "all_time") {
  const safeTimeframe = APP_SALES_TIMEFRAMES.has(timeframe) ? timeframe : "all_time";
  const startAt = getSalesTimeframeStart(safeTimeframe);
  const eventsSnap = await getAdminDb()
    .collection("listingSoldEvents")
    .where("soldWithJosealo", "==", true)
    .get();

  const events = eventsSnap.docs
    .map((docSnap) => {
      const data = docSnap.data() as { listingId?: string; bazarItemId?: string; soldAt?: number };
      return {
        id: docSnap.id,
        listingId: data.listingId || "",
        bazarItemId: data.bazarItemId || "",
        soldAt: Number(data.soldAt || 0),
      };
    })
    .filter((event) => event.listingId && (!startAt || event.soldAt >= startAt));

  const listingIds = Array.from(new Set(events.map((event) => event.listingId)));
  const listingRefs = listingIds.map((listingId) => getAdminDb().collection("listings").doc(listingId));
  const listingSnaps = listingRefs.length ? await getAdminDb().getAll(...listingRefs) : [];
  const listingMap = new Map(listingSnaps.map((snap) => [snap.id, snap.data() as Record<string, unknown> | undefined]));

  const totalAmount = events.reduce((sum, event) => {
    const listing = listingMap.get(event.listingId);
    if (!listing) return sum;

    if (event.bazarItemId && Array.isArray(listing.bazarItems)) {
      const item = (listing.bazarItems as Array<{ id?: string; price?: number }>).find(
        (row) => row.id === event.bazarItemId
      );
      return sum + Math.max(0, Number(item?.price || 0));
    }

    return sum + Math.max(0, Number(listing.price || 0));
  }, 0);

  return {
    timeframe: safeTimeframe,
    totalAmount,
    itemCount: events.length,
  };
}

export async function setUserVerified(userId: string, verified: boolean) {
  if (isPostgresAdminEnabled()) {
    const now = Date.now();
    await setUserSupportStatusInPostgres(userId, { status: "active" });
    await pgQuery(
      `
        insert into user_profiles (id, is_verified, profile, updated_at_ms)
        values ($1, $2, $3::jsonb, $4)
        on conflict (id) do update
        set is_verified = excluded.is_verified,
            profile = user_profiles.profile || excluded.profile,
            updated_at_ms = excluded.updated_at_ms,
            updated_at = now()
      `,
      [userId, verified, JSON.stringify({ isVerified: verified, verifiedAt: verified ? now : null, updatedAt: now }), now]
    );
    return;
  }

  const db = getAdminDb();
  const privateProfileSnap = await db.collection("userPrivateProfiles").doc(userId).get();
  const privateProfile = privateProfileSnap.data() as { accountType?: string } | undefined;
  await db.collection("userProfiles").doc(userId).set(
    {
      isVerified: verified,
      verifiedAt: verified ? Date.now() : null,
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (privateProfile?.accountType === "business") {
    await db.collection("userPrivateProfiles").doc(userId).set(
      {
        businessVerificationPending: !verified,
        businessVerificationMessage: verified ? null : "Verificación removida por soporte.",
        updatedAt: Date.now(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const listingsSnap = await db.collection("listings").where("ownerId", "==", userId).get();
  if (!listingsSnap.empty) {
    const batch = db.batch();
    listingsSnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        ownerVerified: verified,
        updatedAt: Date.now(),
        updatedAtServer: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export async function deleteListingById(listingId: string, reason = "Moderación de soporte") {
  if (isPostgresAdminEnabled()) {
    const listing = await getListingByIdInPostgres(listingId);
    if (!listing) return;
    const now = Date.now();
    await pgQuery(
      `
        update listings
        set status = 'removed_by_support',
            updated_at_ms = $2,
            updated_at = now()
        where id = $1
      `,
      [listingId, now]
    );
    if (listing.ownerId) {
      await createSupportNotification({
        userId: listing.ownerId,
        type: "item_removed",
        title: "Un artículo fue removido de tu cuenta",
        message: itemRemovalMessage(reason),
        reason,
        listingId,
      });
      if (CRITICAL_ACCOUNT_REASONS.has(reason)) {
        await deactivateUserAccount(listing.ownerId, reason);
      }
    }
    return;
  }

  const ref = getAdminDb().collection("listings").doc(listingId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const listing = snap.data() as { ownerId?: string; title?: string } | undefined;

  await ref.set(
    {
      status: "removed_by_support",
      supportRemovalReason: reason,
      removedBySupportAt: Date.now(),
      removedBySupportAtServer: FieldValue.serverTimestamp(),
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (listing?.ownerId) {
    await createSupportNotification({
      userId: listing.ownerId,
      type: "item_removed",
      title: "Un artículo fue removido de tu cuenta",
      message: itemRemovalMessage(reason),
      reason,
      listingId,
    });
    if (CRITICAL_ACCOUNT_REASONS.has(reason)) {
      await deactivateUserAccount(listing.ownerId, reason);
    }
  }
}

export async function deleteUserAccount(userId: string, reason = "Moderación de soporte") {
  await deactivateUserAccount(userId, reason);
}

export async function markReportHandled(
  reportId: string,
  input: { action: "delete_item" | "delete_user" | "omit"; reason: string }
) {
  if (!reportId) return;

  if (isPostgresAdminEnabled()) {
    await markReportHandledInPostgres(reportId, input);
    return;
  }

  await getAdminDb().collection("reports").doc(reportId).set(
    {
      status: "handled",
      handledAction: input.action,
      handledReason: input.reason,
      handledAt: Date.now(),
      handledAtServer: FieldValue.serverTimestamp(),
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deactivateUserAccount(userId: string, reason = "Moderación de soporte") {
  if (isPostgresAdminEnabled()) {
    const now = Date.now();
    await pgQuery(
      `
        update listings
        set status = 'account_deactivated',
            updated_at_ms = $2,
            updated_at = now()
        where owner_id = $1
      `,
      [userId, now]
    );
    await setUserSupportStatusInPostgres(userId, { status: "deactivated", reason });
    await createSupportNotification({
      userId,
      type: "account_deactivated",
      title: "Cuenta desactivada por soporte",
      message: accountDeactivationMessage(reason),
      reason,
    });
    return;
  }

  const db = getAdminDb();
  const now = Date.now();
  const listingsSnap = await db.collection("listings").where("ownerId", "==", userId).get();
  if (!listingsSnap.empty) {
    const batch = db.batch();
    listingsSnap.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "account_deactivated",
        accountDeactivatedAt: now,
        accountDeactivatedAtServer: FieldValue.serverTimestamp(),
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }

  await db.collection("userProfiles").doc(userId).set({
    supportStatus: "deactivated",
    supportDeactivationReason: reason,
    supportDeactivatedAt: now,
    supportDeactivatedAtServer: FieldValue.serverTimestamp(),
    updatedAt: now,
    updatedAtServer: FieldValue.serverTimestamp(),
  }, { merge: true });

  await createSupportNotification({
    userId,
    type: "account_deactivated",
    title: "Cuenta desactivada por soporte",
    message: accountDeactivationMessage(reason),
    reason,
  });
}

export async function reactivateUserAccount(userId: string) {
  if (isPostgresAdminEnabled()) {
    const now = Date.now();
    await setUserSupportStatusInPostgres(userId, { status: "active" });
    await pgQuery(
      `
        update listings
        set status = 'active',
            updated_at_ms = $2,
            updated_at = now()
        where owner_id = $1 and status = 'account_deactivated'
      `,
      [userId, now]
    );
    await createSupportNotification({
      userId,
      type: "account_reactivated",
      title: "Cuenta reactivada",
      message: "Soporte reactivó tu cuenta. Ya puedes volver a usar Josealo.",
      reason: "Reactivación de soporte",
    });
    return;
  }

  const db = getAdminDb();
  const now = Date.now();
  await db.collection("userProfiles").doc(userId).set({
    supportStatus: "active",
    supportReactivatedAt: now,
    supportReactivatedAtServer: FieldValue.serverTimestamp(),
    updatedAt: now,
    updatedAtServer: FieldValue.serverTimestamp(),
  }, { merge: true });

  const listingsSnap = await db.collection("listings").where("ownerId", "==", userId).get();
  if (!listingsSnap.empty) {
    const batch = db.batch();
    listingsSnap.docs.forEach((docSnap) => {
      if (docSnap.data().status !== "account_deactivated") return;
      batch.set(
        docSnap.ref,
        {
          status: "active",
          accountReactivatedAt: now,
          accountReactivatedAtServer: FieldValue.serverTimestamp(),
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  await createSupportNotification({
    userId,
    type: "account_reactivated",
    title: "Cuenta reactivada",
    message: "Soporte reactivó tu cuenta. Ya puedes volver a usar Josealo.",
    reason: "Reactivación de soporte",
  });
}

export async function hardDeleteUserAccount(userId: string) {
  if (isPostgresAdminEnabled()) {
    await pgTransaction(async (query) => {
      await query(
        `
          delete from messages
          where sender_id = $1
             or chat_id in (select id from chats where buyer_id = $1 or seller_id = $1)
        `,
        [userId]
      );
      await query("delete from chats where buyer_id = $1 or seller_id = $1", [userId]);
      await query("delete from likes where actor_id = $1 or owner_id = $1", [userId]);
      await query("delete from follows where follower_id = $1 or followee_id = $1", [userId]);
      await query(
        "delete from reports where reporter_id = $1 or seller_id = $1 or target_user_id = $1",
        [userId]
      );
      await query("delete from support_notifications where user_id = $1", [userId]);
      await query("delete from listing_sold_events where owner_id = $1", [userId]);
      await query(
        "delete from purchase_review_requests where seller_id = $1 or buyer_id = $1",
        [userId]
      );
      await query("delete from user_ratings where seller_id = $1 or buyer_id = $1", [userId]);
      await query("delete from listing_view_events where owner_id = $1 or viewer_id = $1", [userId]);
      await query("delete from search_events where user_id = $1", [userId]);
      await query("delete from user_presence where user_id = $1", [userId]);
      await query("delete from listings where owner_id = $1", [userId]);
      await query("delete from user_private_profiles where user_id = $1", [userId]);
      await query("delete from user_profiles where id = $1", [userId]);
      await query("delete from auth_users where id = $1", [userId]);
    });
    return;
  }

  const db = getAdminDb();

  const deleteQuerySnapshot = async (query: FirebaseFirestore.Query) => {
    const snap = await query.get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  };

  const chatIds = new Set<string>();
  const sellerChatsSnap = await db.collection("chats").where("sellerId", "==", userId).get();
  const buyerChatsSnap = await db.collection("chats").where("buyerId", "==", userId).get();
  sellerChatsSnap.docs.forEach((docSnap) => chatIds.add(docSnap.id));
  buyerChatsSnap.docs.forEach((docSnap) => chatIds.add(docSnap.id));

  for (const chatId of chatIds) {
    await deleteQuerySnapshot(db.collection("messages").where("chatId", "==", chatId));
  }

  const collectionsToDelete = [
    db.collection("listings").where("ownerId", "==", userId),
    db.collection("reports").where("sellerId", "==", userId),
    db.collection("reports").where("reporterId", "==", userId),
    db.collection("chats").where("sellerId", "==", userId),
    db.collection("chats").where("buyerId", "==", userId),
    db.collection("likes").where("actorId", "==", userId),
    db.collection("likes").where("ownerId", "==", userId),
    db.collection("follows").where("followerId", "==", userId),
    db.collection("follows").where("followeeId", "==", userId),
    db.collection("supportNotifications").where("userId", "==", userId),
    db.collection("messages").where("senderId", "==", userId),
    db.collection("soldEvents").where("sellerId", "==", userId),
    db.collection("soldEvents").where("buyerId", "==", userId),
    db.collection("purchaseReviewRequests").where("sellerId", "==", userId),
    db.collection("purchaseReviewRequests").where("buyerId", "==", userId),
    db.collection("userRatings").where("reviewerId", "==", userId),
    db.collection("userRatings").where("revieweeId", "==", userId),
  ];

  for (const query of collectionsToDelete) {
    await deleteQuerySnapshot(query);
  }

  await db.collection("userProfiles").doc(userId).delete().catch(() => undefined);
  await db.collection("userPrivateProfiles").doc(userId).delete().catch(() => undefined);
  await getAdminAuth().deleteUser(userId).catch((error: { code?: string }) => {
    if (error?.code === "auth/user-not-found") return;
    throw error;
  });
}

export async function listAdminReports() {
  if (isPostgresAdminEnabled()) {
    const reports = await listReportsFromPostgres();
    const listingIds = Array.from(new Set(reports.map((report) => report.listingId).filter(Boolean)));
    const reportedUserIds = Array.from(new Set(reports.map((report) => getReportedUserId(report)).filter(Boolean)));
    const [listingRows, authUsers] = await Promise.all([
      listingIds.length
        ? pgQuery<{ id: string; image: string }>("select id, image from listings where id = any($1::text[])", [listingIds])
        : Promise.resolve({ rows: [] as { id: string; image: string }[] }),
      Promise.all(reportedUserIds.map((userId) => getAdminAuth().getUser(userId).catch(() => null))),
    ]);
    const listingMap = new Map(listingRows.rows.map((row) => [row.id, row.image || ""]));
    const reportedUserEmailMap = new Map<string, string>();
    authUsers.forEach((user) => {
      if (user?.uid) reportedUserEmailMap.set(user.uid, user.email || "");
    });
    return reports.map((report) => ({
      ...report,
      listingImage: listingMap.get(report.listingId) || "",
      reportedUserEmail: reportedUserEmailMap.get(getReportedUserId(report)) || "",
    }));
  }

  const reportsSnap = await getAdminDb().collection("reports").orderBy("createdAt", "desc").get();
  const reports = reportsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<AdminReportRow, "id" | "listingImage">),
  }));

  const listingIds = Array.from(new Set(reports.map((report) => report.listingId).filter(Boolean)));
  const reportedUserIds = Array.from(new Set(reports.map((report) => getReportedUserId(report)).filter(Boolean)));
  const listingRefs = listingIds.map((listingId) => getAdminDb().collection("listings").doc(listingId));
  const [listingSnaps, authUsers] = await Promise.all([
    listingRefs.length ? getAdminDb().getAll(...listingRefs) : Promise.resolve([]),
    Promise.all(reportedUserIds.map((userId) => getAdminAuth().getUser(userId).catch(() => null))),
  ]);
  const listingMap = new Map<string, { image?: string }>();
  const reportedUserEmailMap = new Map<string, string>();

  listingSnaps.forEach((snapshot) => {
    listingMap.set(snapshot.id, snapshot.data() as { image?: string } | undefined || {});
  });
  authUsers.forEach((user) => {
    if (user?.uid) {
      reportedUserEmailMap.set(user.uid, user.email || "");
    }
  });

  return reports.map((report) => ({
    ...report,
    listingImage: listingMap.get(report.listingId)?.image || "",
    reportedUserEmail: reportedUserEmailMap.get(getReportedUserId(report)) || "",
  })) as AdminReportRow[];
}

function getReportedUserId(report: Partial<AdminReportRow>) {
  return report.targetUserId || report.sellerId || "";
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function calculateAccountAgeDays(createdAt: number) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
}

export async function getAdminReportDetails(reportId: string): Promise<AdminReportDetails | null> {
  if (isPostgresAdminEnabled()) {
    const report = await getReportFromPostgres(reportId);
    if (!report) return null;
    const reportedUserId = getReportedUserId(report);
    if (!reportedUserId) return null;

    const [authUserResult, profileResult, privateProfileResult, listingsResult, relatedReports, chatCount, likesCount] =
      await Promise.all([
        getAdminAuth().getUser(reportedUserId).catch(() => null),
        pgQuery<{ profile: Record<string, unknown>; display_name: string | null }>(
          "select profile, display_name from user_profiles where id = $1",
          [reportedUserId]
        ),
        pgQuery<{ profile: Record<string, unknown> }>("select profile from user_private_profiles where user_id = $1", [
          reportedUserId,
        ]),
        pgQuery<{
          id: string;
          title: string;
          price: string;
          currency: string;
          category: string;
          location: string;
          image: string;
          status: string;
          created_at_ms: string | number;
        }>(
          `
            select id, title, price, currency, category, location, image, status, created_at_ms
            from listings
            where owner_id = $1
            order by created_at_ms desc
          `,
          [reportedUserId]
        ),
        listReportsForUserFromPostgres(reportedUserId),
        pgQuery<{ count: number }>(
          "select count(*)::int as count from chats where seller_id = $1 or buyer_id = $1",
          [reportedUserId]
        ),
        pgQuery<{ count: number }>("select count(*)::int as count from likes where owner_id = $1", [reportedUserId]),
      ]);

    const listings = listingsResult.rows.map((row) => ({
      id: row.id,
      title: row.title || "Publicación sin título",
      price: Number(row.price || 0),
      currency: row.currency || "DOP",
      category: row.category || "Sin categoría",
      location: row.location || "",
      image: row.image || "",
      status: row.status || "active",
      createdAt: Number(row.created_at_ms || 0),
    })) as AdminReportedListing[];
    const profile = profileResult.rows[0]?.profile || {};
    const privateProfile = privateProfileResult.rows[0]?.profile || {};
    const createdAt = authUserResult?.metadata.creationTime
      ? new Date(authUserResult.metadata.creationTime).getTime()
      : 0;
    const location =
      (privateProfile.location as { name?: string } | undefined)?.name ||
      (privateProfile.businessProfile as { province?: string } | undefined)?.province ||
      mostCommon(listings.map((listing) => listing.location)) ||
      "No disponible";
    const salesCategory =
      mostCommon(listings.map((listing) => listing.category)) ||
      (privateProfile.businessProfile as { categories?: string[] } | undefined)?.categories?.[0] ||
      "No disponible";
    report.listingImage = report.listingId
      ? listings.find((listing) => listing.id === report.listingId)?.image || ""
      : "";

    return {
      report,
      user: {
        uid: reportedUserId,
        email: authUserResult?.email || "",
        displayName:
          report.targetUserName ||
          String(profile.displayName || profileResult.rows[0]?.display_name || "") ||
          authUserResult?.displayName ||
          authUserResult?.email ||
          "Usuario reportado",
        createdAt,
        location,
        salesCategory,
      },
      metrics: {
        reportCount: relatedReports.length,
        interactionCount: Number(chatCount.rows[0]?.count || 0) + Number(likesCount.rows[0]?.count || 0),
        accountAgeDays: calculateAccountAgeDays(createdAt),
        location,
        salesCategory,
      },
      listings,
      relatedReports,
    };
  }

  const db = getAdminDb();
  const reportSnap = await db.collection("reports").doc(reportId).get();
  if (!reportSnap.exists) return null;

  const report = {
    id: reportSnap.id,
    ...(reportSnap.data() as Omit<AdminReportRow, "id" | "listingImage">),
    listingImage: "",
  } as AdminReportRow;
  const reportedUserId = getReportedUserId(report);
  if (!reportedUserId) return null;

  const [
    authUserResult,
    profileSnap,
    privateProfileSnap,
    listingsSnap,
    reportsBySellerSnap,
    reportsByTargetSnap,
    sellerChatsSnap,
    buyerChatsSnap,
    likesSnap,
  ] = await Promise.all([
    getAdminAuth().getUser(reportedUserId).catch(() => null),
    db.collection("userProfiles").doc(reportedUserId).get(),
    db.collection("userPrivateProfiles").doc(reportedUserId).get(),
    db.collection("listings").where("ownerId", "==", reportedUserId).get(),
    db.collection("reports").where("sellerId", "==", reportedUserId).get(),
    db.collection("reports").where("targetUserId", "==", reportedUserId).get(),
    db.collection("chats").where("sellerId", "==", reportedUserId).get(),
    db.collection("chats").where("buyerId", "==", reportedUserId).get(),
    db.collection("likes").where("ownerId", "==", reportedUserId).get(),
  ]);

  const listings = listingsSnap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        title: String(data.title || "Publicación sin título"),
        price: Number(data.price || 0),
        currency: data.currency === "USD" ? "USD" : "DOP",
        category: String(data.category || "Sin categoría"),
        location: String(data.location || ""),
        image: String(data.image || ""),
        status: String(data.status || "active"),
        createdAt: Number(data.createdAt || 0),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt) as AdminReportedListing[];

  const profile = profileSnap.data() as { displayName?: string } | undefined;
  const privateProfile = privateProfileSnap.data() as {
    location?: { name?: string };
    businessProfile?: { province?: string; country?: string; categories?: string[] };
  } | undefined;
  const createdAt = authUserResult?.metadata.creationTime
    ? new Date(authUserResult.metadata.creationTime).getTime()
    : 0;
  const location =
    privateProfile?.location?.name ||
    privateProfile?.businessProfile?.province ||
    mostCommon(listings.map((listing) => listing.location)) ||
    "No disponible";
  const salesCategory =
    mostCommon(listings.map((listing) => listing.category)) ||
    privateProfile?.businessProfile?.categories?.[0] ||
    "No disponible";
  const reportIds = new Set([...reportsBySellerSnap.docs, ...reportsByTargetSnap.docs].map((row) => row.id));
  const relatedReportMap = new Map<string, AdminReportRow>();
  [...reportsBySellerSnap.docs, ...reportsByTargetSnap.docs].forEach((docSnap) => {
    relatedReportMap.set(docSnap.id, {
      id: docSnap.id,
      ...(docSnap.data() as Omit<AdminReportRow, "id" | "listingImage">),
      listingImage: "",
    } as AdminReportRow);
  });
  const viewCount = listings.reduce((sum, listing) => {
    const source = listingsSnap.docs.find((docSnap) => docSnap.id === listing.id)?.data() as { viewCount?: number; views?: number } | undefined;
    return sum + Number(source?.viewCount || source?.views || 0);
  }, 0);

  report.listingImage = report.listingId
    ? listings.find((listing) => listing.id === report.listingId)?.image || ""
    : "";

  return {
    report,
    user: {
      uid: reportedUserId,
      email: authUserResult?.email || "",
      displayName:
        report.targetUserName ||
        profile?.displayName ||
        authUserResult?.displayName ||
        authUserResult?.email ||
        "Usuario reportado",
      createdAt,
      location,
      salesCategory,
    },
    metrics: {
      reportCount: reportIds.size,
      interactionCount: sellerChatsSnap.size + buyerChatsSnap.size + likesSnap.size + viewCount,
      accountAgeDays: calculateAccountAgeDays(createdAt),
      location,
      salesCategory,
    },
    listings,
    relatedReports: Array.from(relatedReportMap.values()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)),
  };
}
