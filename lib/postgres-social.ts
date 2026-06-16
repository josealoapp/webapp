import { pgQuery } from "@/lib/postgres";

export type SocialLikeRecord = {
  id: string;
  actorId: string;
  actorName: string;
  ownerId: string;
  ownerName: string;
  listingId: string;
  bazarItemId?: string;
  itemTitle: string;
  image: string;
  price: number;
  location: string;
  href: string;
  createdAt: number;
};

export type SocialFollowRecord = {
  id: string;
  followerId: string;
  followerName: string;
  followeeId: string;
  followeeName: string;
  createdAt: number;
};

type LikeRow = {
  id: string;
  actor_id: string;
  owner_id: string;
  listing_id: string;
  bazar_item_id: string | null;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

type FollowRow = {
  id: string;
  follower_id: string;
  followee_id: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function likeFromRow(row: LikeRow): SocialLikeRecord {
  const data = row.data || {};
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: String(data.actorName || ""),
    ownerId: row.owner_id,
    ownerName: String(data.ownerName || ""),
    listingId: row.listing_id,
    bazarItemId: row.bazar_item_id || undefined,
    itemTitle: String(data.itemTitle || ""),
    image: String(data.image || ""),
    price: Number(data.price || 0),
    location: String(data.location || ""),
    href: String(data.href || ""),
    createdAt: toNumber(row.created_at_ms),
  };
}

function followFromRow(row: FollowRow): SocialFollowRecord {
  const data = row.data || {};
  return {
    id: row.id,
    followerId: row.follower_id,
    followerName: String(data.followerName || ""),
    followeeId: row.followee_id,
    followeeName: String(data.followeeName || ""),
    createdAt: toNumber(row.created_at_ms),
  };
}

export async function upsertLikeInPostgres(record: SocialLikeRecord) {
  await pgQuery(
    `
      insert into likes (id, actor_id, owner_id, listing_id, bazar_item_id, data, created_at_ms)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7)
      on conflict (id) do update
      set
        actor_id = excluded.actor_id,
        owner_id = excluded.owner_id,
        listing_id = excluded.listing_id,
        bazar_item_id = excluded.bazar_item_id,
        data = excluded.data,
        created_at_ms = excluded.created_at_ms
    `,
    [
      record.id,
      record.actorId,
      record.ownerId,
      record.listingId,
      record.bazarItemId || null,
      JSON.stringify(record),
      record.createdAt,
    ]
  );
}

export async function deleteLikeFromPostgres(id: string) {
  await pgQuery("delete from likes where id = $1", [id]);
}

export async function listLikesFromPostgres(input: { actorId?: string; ownerId?: string }) {
  const values: unknown[] = [];
  const where: string[] = [];

  if (input.actorId) {
    values.push(input.actorId);
    where.push(`actor_id = $${values.length}`);
  }

  if (input.ownerId) {
    values.push(input.ownerId);
    where.push(`owner_id = $${values.length}`);
  }

  const result = await pgQuery<LikeRow>(
    `
      select *
      from likes
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by created_at_ms desc
      limit 500
    `,
    values
  );

  return result.rows.map(likeFromRow);
}

export async function upsertFollowInPostgres(record: SocialFollowRecord) {
  await pgQuery(
    `
      insert into follows (id, follower_id, followee_id, data, created_at_ms)
      values ($1, $2, $3, $4::jsonb, $5)
      on conflict (id) do update
      set
        follower_id = excluded.follower_id,
        followee_id = excluded.followee_id,
        data = excluded.data,
        created_at_ms = excluded.created_at_ms
    `,
    [record.id, record.followerId, record.followeeId, JSON.stringify(record), record.createdAt]
  );
}

export async function deleteFollowFromPostgres(id: string) {
  await pgQuery("delete from follows where id = $1", [id]);
}

export async function listFollowsFromPostgres(input: { followerId?: string; followeeId?: string }) {
  const values: unknown[] = [];
  const where: string[] = [];

  if (input.followerId) {
    values.push(input.followerId);
    where.push(`follower_id = $${values.length}`);
  }

  if (input.followeeId) {
    values.push(input.followeeId);
    where.push(`followee_id = $${values.length}`);
  }

  const result = await pgQuery<FollowRow>(
    `
      select *
      from follows
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by created_at_ms desc
      limit 500
    `,
    values
  );

  return result.rows.map(followFromRow);
}
