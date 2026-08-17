import { pgQuery } from "@/lib/postgres";

export function isPostgresProfilesEnabled() {
  return process.env.USE_POSTGRES_PROFILES === "true";
}

type UserProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  support_status: string;
  is_verified: boolean;
  profile: Record<string, unknown>;
  created_at_ms: number | string;
  updated_at_ms: number | string;
};

type UserPrivateProfileRow = {
  user_id: string;
  profile: Record<string, unknown>;
  created_at_ms: number | string;
  updated_at_ms: number | string;
};

function nowMs() {
  return Date.now();
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function publicProfileFromRow(row: UserProfileRow | undefined) {
  if (!row) return null;

  return {
    userId: row.id,
    displayName: row.display_name || "",
    email: row.email || "",
    avatarUrl: row.avatar_url || "",
    supportStatus: row.support_status || "active",
    isVerified: row.is_verified === true,
    ...(row.profile || {}),
    createdAt: toNumber(row.created_at_ms),
    updatedAt: toNumber(row.updated_at_ms),
  };
}

function privateProfileFromRow(row: UserPrivateProfileRow | undefined) {
  if (!row) return null;

  return {
    userId: row.user_id,
    ...(row.profile || {}),
    createdAt: toNumber(row.created_at_ms),
    updatedAt: toNumber(row.updated_at_ms),
  };
}

function extractPublicColumns(userId: string, profile: Record<string, unknown>) {
  const updatedAt = Number(profile.updatedAt || nowMs());

  return {
    id: userId,
    display_name:
      typeof profile.displayName === "string"
        ? profile.displayName
        : typeof profile.name === "string"
          ? profile.name
          : null,
    email: typeof profile.email === "string" ? profile.email : null,
    avatar_url: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    support_status: typeof profile.supportStatus === "string" ? profile.supportStatus : null,
    is_verified: typeof profile.isVerified === "boolean" ? profile.isVerified : null,
    profile: JSON.stringify(profile),
    created_at_ms: Number(profile.createdAt || updatedAt || nowMs()),
    updated_at_ms: updatedAt,
  };
}

export async function getPublicProfileFromPostgres(userId: string) {
  const result = await pgQuery<UserProfileRow>("select * from user_profiles where id = $1", [userId]);
  return publicProfileFromRow(result.rows[0]);
}

export async function getPrivateProfileFromPostgres(userId: string) {
  const result = await pgQuery<UserPrivateProfileRow>(
    "select * from user_private_profiles where user_id = $1",
    [userId]
  );
  return privateProfileFromRow(result.rows[0]);
}

export async function upsertPublicProfileInPostgres(userId: string, profile: Record<string, unknown>) {
  const row = extractPublicColumns(userId, profile);

  await pgQuery(
    `
      insert into user_profiles (
        id, display_name, email, avatar_url, support_status, is_verified, profile, created_at_ms, updated_at_ms
      ) values (
        $1, $2, $3, $4, coalesce($5, 'active'), coalesce($6, false), $7::jsonb, $8, $9
      )
      on conflict (id) do update
      set
        display_name = coalesce(excluded.display_name, user_profiles.display_name),
        email = coalesce(excluded.email, user_profiles.email),
        avatar_url = coalesce(excluded.avatar_url, user_profiles.avatar_url),
        support_status = coalesce(excluded.support_status, user_profiles.support_status),
        is_verified = coalesce(excluded.is_verified, user_profiles.is_verified),
        profile = user_profiles.profile || excluded.profile,
        updated_at_ms = excluded.updated_at_ms,
        updated_at = now()
    `,
    [
      row.id,
      row.display_name,
      row.email,
      row.avatar_url,
      row.support_status,
      row.is_verified,
      row.profile,
      row.created_at_ms,
      row.updated_at_ms,
    ]
  );
}

export async function upsertPrivateProfileInPostgres(userId: string, profile: Record<string, unknown>) {
  const updatedAt = Number(profile.updatedAt || nowMs());

  await pgQuery(
    `
      insert into user_private_profiles (user_id, profile, created_at_ms, updated_at_ms)
      values ($1, $2::jsonb, $3, $4)
      on conflict (user_id) do update
      set
        profile = user_private_profiles.profile || excluded.profile,
        updated_at_ms = excluded.updated_at_ms,
        updated_at = now()
    `,
    [userId, JSON.stringify(profile), Number(profile.createdAt || updatedAt), updatedAt]
  );
}

export async function updateProfileAvatarInPostgres(userId: string, avatarUrl: string) {
  await upsertPublicProfileInPostgres(userId, {
    avatarUrl,
    updatedAt: nowMs(),
  });

  await pgQuery(
    `
      update listings
      set owner_avatar = $2, updated_at_ms = $3, updated_at = now()
      where owner_id = $1
    `,
    [userId, avatarUrl, nowMs()]
  );
}
