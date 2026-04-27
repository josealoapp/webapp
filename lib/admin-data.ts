import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  isVerified: boolean;
};

export type AdminReportRow = {
  id: string;
  listingId: string;
  bazarItemId: string;
  sellerId: string;
  itemTitle: string;
  reason: string;
  details: string;
  reporterId: string;
  reporterName: string;
  createdAt: number;
  status: string;
  listingImage: string;
};

async function listAllAuthUsers() {
  const auth = getAdminAuth();
  const users: Awaited<ReturnType<typeof auth.listUsers>>["users"] = [];
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
  const normalizedQuery = query.trim().toLowerCase();

  return users
    .map((user) => ({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "Usuario",
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0,
      isVerified: verifiedMap.get(user.uid) || false,
    }))
    .filter((user) => {
      if (!normalizedQuery) return true;
      return (
        user.displayName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
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

export async function setUserVerified(userId: string, verified: boolean) {
  await getAdminDb().collection("userProfiles").doc(userId).set(
    {
      isVerified: verified,
      verifiedAt: verified ? Date.now() : null,
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const listingsSnap = await getAdminDb().collection("listings").where("ownerId", "==", userId).get();
  if (!listingsSnap.empty) {
    const batch = getAdminDb().batch();
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

export async function deleteListingById(listingId: string) {
  await getAdminDb().collection("listings").doc(listingId).delete();
}

export async function deleteUserAccount(userId: string) {
  const db = getAdminDb();

  const collectionsToDelete = [
    db.collection("listings").where("ownerId", "==", userId),
    db.collection("reports").where("sellerId", "==", userId),
    db.collection("reports").where("reporterId", "==", userId),
    db.collection("chats").where("sellerId", "==", userId),
    db.collection("chats").where("buyerId", "==", userId),
  ];

  for (const query of collectionsToDelete) {
    const snap = await query.get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }

  await db.collection("userProfiles").doc(userId).delete().catch(() => undefined);
  await getAdminAuth().deleteUser(userId);
}

export async function listAdminReports() {
  const reportsSnap = await getAdminDb().collection("reports").orderBy("createdAt", "desc").get();
  const reports = reportsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<AdminReportRow, "id" | "listingImage">),
  }));

  const listingIds = Array.from(new Set(reports.map((report) => report.listingId).filter(Boolean)));
  const listingRefs = listingIds.map((listingId) => getAdminDb().collection("listings").doc(listingId));
  const listingSnaps = listingRefs.length ? await getAdminDb().getAll(...listingRefs) : [];
  const listingMap = new Map<string, { image?: string }>();

  listingSnaps.forEach((snapshot) => {
    listingMap.set(snapshot.id, snapshot.data() as { image?: string } | undefined || {});
  });

  return reports.map((report) => ({
    ...report,
    listingImage: listingMap.get(report.listingId)?.image || "",
  })) as AdminReportRow[];
}
