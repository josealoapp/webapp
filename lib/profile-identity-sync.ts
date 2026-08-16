import { getAdminDb } from "@/lib/firebase-admin";
import {
  isPostgresChatsEnabled,
  isPostgresListingsEnabled,
  isPostgresSalesEnabled,
  isPostgresSocialEnabled,
  pgQuery,
} from "@/lib/postgres";

type PublicIdentity = {
  userId: string;
  displayName: string;
  handle: string;
};

function cleanPatch<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

async function updateFirestoreMatches(collectionName: string, field: string, value: string, patch: Record<string, unknown>) {
  const db = getAdminDb();
  const snapshot = await db.collection(collectionName).where(field, "==", value).get();
  const updates = cleanPatch(patch);

  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach((doc) => {
      batch.set(doc.ref, updates, { merge: true });
    });
    await batch.commit();
  }
}

async function syncFirestoreIdentityReferences({ userId, displayName, handle }: PublicIdentity) {
  const tasks: Array<Promise<unknown>> = [];

  if (!isPostgresListingsEnabled()) {
    tasks.push(
      updateFirestoreMatches("listings", "ownerId", userId, {
        ownerName: displayName,
        ownerHandle: handle,
      }),
      updateFirestoreMatches("listings", "reservedForUserId", userId, {
        reservedForUserName: displayName,
        reservedForUserHandle: handle,
      }),
      updateFirestoreMatches("listings", "soldToUserId", userId, {
        soldToUserName: displayName,
        soldToUserHandle: handle,
      })
    );
  }

  if (!isPostgresSocialEnabled()) {
    tasks.push(
      updateFirestoreMatches("likes", "actorId", userId, {
        actorName: displayName,
        actorHandle: handle,
      }),
      updateFirestoreMatches("likes", "ownerId", userId, {
        ownerName: displayName,
        ownerHandle: handle,
      }),
      updateFirestoreMatches("follows", "followerId", userId, {
        followerName: displayName,
        followerHandle: handle,
      }),
      updateFirestoreMatches("follows", "followeeId", userId, {
        followeeName: displayName,
        followeeHandle: handle,
      })
    );
  }

  if (!isPostgresChatsEnabled()) {
    tasks.push(
      updateFirestoreMatches("chats", "sellerId", userId, {
        sellerName: displayName,
        sellerHandle: handle,
      }),
      updateFirestoreMatches("chats", "buyerId", userId, {
        buyerName: displayName,
        buyerHandle: handle,
      })
    );
  }

  if (!isPostgresSalesEnabled()) {
    tasks.push(
      updateFirestoreMatches("purchaseReviewRequests", "sellerId", userId, {
        sellerName: displayName,
        sellerHandle: handle,
      }),
      updateFirestoreMatches("purchaseReviewRequests", "buyerId", userId, {
        buyerName: displayName,
        buyerHandle: handle,
      }),
      updateFirestoreMatches("userRatings", "sellerId", userId, {
        sellerName: displayName,
        sellerHandle: handle,
      }),
      updateFirestoreMatches("userRatings", "buyerId", userId, {
        buyerName: displayName,
        buyerHandle: handle,
      })
    );
  }

  await Promise.all(tasks);
}

async function syncPostgresListings({ userId, displayName }: PublicIdentity) {
  if (!isPostgresListingsEnabled()) return;

  await Promise.all([
    pgQuery("update listings set owner_name = $2 where owner_id = $1", [userId, displayName]),
    pgQuery("update listings set reserved_for_user_name = $2 where reserved_for_user_id = $1", [userId, displayName]),
    pgQuery("update listings set sold_to_user_name = $2 where sold_to_user_id = $1", [userId, displayName]),
  ]);
}

async function syncPostgresSocial({ userId, displayName, handle }: PublicIdentity) {
  if (!isPostgresSocialEnabled()) return;

  await Promise.all([
    pgQuery(
      `
        update likes
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where actor_id = $1
      `,
      [userId, JSON.stringify({ actorName: displayName, actorHandle: handle })]
    ),
    pgQuery(
      `
        update likes
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where owner_id = $1
      `,
      [userId, JSON.stringify({ ownerName: displayName, ownerHandle: handle })]
    ),
    pgQuery(
      `
        update follows
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where follower_id = $1
      `,
      [userId, JSON.stringify({ followerName: displayName, followerHandle: handle })]
    ),
    pgQuery(
      `
        update follows
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where followee_id = $1
      `,
      [userId, JSON.stringify({ followeeName: displayName, followeeHandle: handle })]
    ),
  ]);
}

async function syncPostgresChats({ userId, displayName, handle }: PublicIdentity) {
  if (!isPostgresChatsEnabled()) return;

  await Promise.all([
    pgQuery(
      `
        update chats
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where seller_id = $1
      `,
      [userId, JSON.stringify({ sellerName: displayName, sellerHandle: handle })]
    ),
    pgQuery(
      `
        update chats
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where buyer_id = $1
      `,
      [userId, JSON.stringify({ buyerName: displayName, buyerHandle: handle })]
    ),
  ]);
}

async function syncPostgresSales({ userId, displayName, handle }: PublicIdentity) {
  if (!isPostgresSalesEnabled()) return;

  await Promise.all([
    pgQuery(
      `
        update purchase_review_requests
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where seller_id = $1
      `,
      [userId, JSON.stringify({ sellerName: displayName, sellerHandle: handle })]
    ),
    pgQuery(
      `
        update purchase_review_requests
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where buyer_id = $1
      `,
      [userId, JSON.stringify({ buyerName: displayName, buyerHandle: handle })]
    ),
    pgQuery(
      `
        update user_ratings
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where seller_id = $1
      `,
      [userId, JSON.stringify({ sellerName: displayName, sellerHandle: handle })]
    ),
    pgQuery(
      `
        update user_ratings
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where buyer_id = $1
      `,
      [userId, JSON.stringify({ buyerName: displayName, buyerHandle: handle })]
    ),
    pgQuery(
      `
        update listing_sold_events
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where owner_id = $1
      `,
      [userId, JSON.stringify({ ownerName: displayName, ownerHandle: handle })]
    ),
    pgQuery(
      `
        update listing_sold_events
        set data = coalesce(data, '{}'::jsonb) || $2::jsonb
        where data ->> 'soldToUserId' = $1
      `,
      [userId, JSON.stringify({ soldToUserName: displayName, soldToUserHandle: handle })]
    ),
  ]);
}

export async function syncPublicIdentityReferences(identity: PublicIdentity) {
  await Promise.all([
    syncPostgresListings(identity),
    syncPostgresSocial(identity),
    syncPostgresChats(identity),
    syncPostgresSales(identity),
    syncFirestoreIdentityReferences(identity),
  ]);
}
