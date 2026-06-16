import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { pgQuery } from "@/lib/postgres";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ACTION_TTL_MS = 1000 * 60 * 60;

export type AppAuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime?: string;
  };
};

type AuthUserRow = {
  id: string;
  email: string | null;
  display_name: string;
  photo_url: string;
  email_verified: boolean;
  disabled: boolean;
  provider: string;
  provider_id: string | null;
  password_hash: string | null;
  created_at_ms: number | string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function userFromRow(row: AuthUserRow): AppAuthUser {
  return {
    uid: row.id,
    email: row.email || null,
    displayName: row.display_name || null,
    photoURL: row.photo_url || null,
    emailVerified: row.email_verified === true,
    disabled: row.disabled === true,
    metadata: {
      creationTime: new Date(toNumber(row.created_at_ms)).toISOString(),
    },
  };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [scheme, salt, hash] = storedHash.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getAuthUserById(userId: string) {
  const result = await pgQuery<AuthUserRow>("select * from auth_users where id = $1", [userId]);
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

export async function getAuthUserByEmail(email: string) {
  const result = await pgQuery<AuthUserRow>("select * from auth_users where lower(email) = lower($1)", [email]);
  return result.rows[0] || null;
}

export async function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await pgQuery(
    `
      insert into auth_sessions (token_hash, user_id, created_at_ms, expires_at_ms)
      values ($1, $2, $3, $4)
    `,
    [hashToken(token), userId, now, now + SESSION_TTL_MS]
  );
  return token;
}

export async function verifyPostgresAuthToken(token: string) {
  const result = await pgQuery<AuthUserRow>(
    `
      select u.*
      from auth_sessions s
      join auth_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at_ms > $2 and u.disabled = false
    `,
    [hashToken(token), Date.now()]
  );
  const row = result.rows[0];
  if (!row) throw new Error("auth/invalid-token");
  return userFromRow(row);
}

export async function revokePostgresAuthToken(token: string) {
  await pgQuery("delete from auth_sessions where token_hash = $1", [hashToken(token)]);
}

export async function signInWithPostgresPassword(email: string, password: string) {
  const row = await getAuthUserByEmail(email);
  if (!row || row.disabled) throw new Error("auth/invalid-credential");
  if (!row.password_hash) throw new Error("auth/password-reset-required");
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) throw new Error("auth/invalid-credential");
  const token = await createAuthSession(row.id);
  return { token, user: userFromRow(row) };
}

export async function createPostgresAuthUser(input: { email: string; password: string; displayName: string }) {
  const existing = await getAuthUserByEmail(input.email);
  if (existing) throw new Error("auth/email-already-in-use");
  const now = Date.now();
  const passwordHash = await hashPassword(input.password);
  const result = await pgQuery<AuthUserRow>(
    `
      insert into auth_users (email, display_name, email_verified, provider, password_hash, created_at_ms, updated_at_ms)
      values (lower($1), $2, false, 'password', $3, $4, $4)
      returning *
    `,
    [input.email, input.displayName, passwordHash, now]
  );
  const user = userFromRow(result.rows[0]);
  const token = await createAuthSession(user.uid);
  await pgQuery(
    `
      insert into user_profiles (id, display_name, email, profile, created_at_ms, updated_at_ms)
      values ($1, $2, $3, $4::jsonb, $5, $5)
      on conflict (id) do update
      set display_name = excluded.display_name,
          email = excluded.email,
          profile = user_profiles.profile || excluded.profile,
          updated_at_ms = excluded.updated_at_ms,
          updated_at = now()
    `,
    [
      user.uid,
      input.displayName,
      input.email.toLowerCase(),
      JSON.stringify({
        uid: user.uid,
        name: input.displayName,
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        onboardingRequired: true,
        onboardingCompleted: false,
        updatedAt: now,
      }),
      now,
    ]
  );
  return { token, user };
}

export async function signInWithPostgresGoogle(input: {
  providerId: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
}) {
  const now = Date.now();
  const existing = await getAuthUserByEmail(input.email);
  const result = existing
    ? await pgQuery<AuthUserRow>(
        `
          update auth_users
          set display_name = coalesce(nullif($2, ''), display_name),
              photo_url = coalesce(nullif($3, ''), photo_url),
              email_verified = auth_users.email_verified or $4,
              provider = 'google',
              provider_id = $5,
              updated_at_ms = $6
          where id = $1
          returning *
        `,
        [existing.id, input.displayName, input.photoURL, input.emailVerified, input.providerId, now]
      )
    : await pgQuery<AuthUserRow>(
        `
          insert into auth_users (
            email, display_name, photo_url, email_verified, disabled, provider, provider_id, created_at_ms, updated_at_ms
          ) values (
            lower($1), $2, $3, $4, false, 'google', $5, $6, $6
          )
          returning *
        `,
        [input.email, input.displayName, input.photoURL, input.emailVerified, input.providerId, now]
      );

  const row = result.rows[0];
  const user = userFromRow(row);
  await pgQuery(
    `
      insert into user_profiles (id, display_name, email, avatar_url, profile, created_at_ms, updated_at_ms)
      values ($1, $2, $3, $4, $5::jsonb, $6, $6)
      on conflict (id) do update
      set display_name = coalesce(excluded.display_name, user_profiles.display_name),
          email = coalesce(excluded.email, user_profiles.email),
          avatar_url = coalesce(excluded.avatar_url, user_profiles.avatar_url),
          profile = user_profiles.profile || excluded.profile,
          updated_at_ms = excluded.updated_at_ms,
          updated_at = now()
    `,
    [
      user.uid,
      input.displayName || null,
      input.email.toLowerCase(),
      input.photoURL || null,
      JSON.stringify({
        uid: user.uid,
        name: input.displayName,
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        avatarUrl: input.photoURL,
        onboardingRequired: !existing,
        onboardingCompleted: false,
        updatedAt: now,
      }),
      now,
    ]
  );
  const token = await createAuthSession(user.uid);
  return { token, user, isNewUser: !existing };
}

export async function updatePostgresAuthUserProfile(userId: string, input: { displayName?: string; photoURL?: string }) {
  const current = await getAuthUserById(userId);
  if (!current) throw new Error("auth/user-not-found");
  const now = Date.now();
  await pgQuery(
    `
      update auth_users
      set display_name = coalesce($2, display_name),
          photo_url = coalesce($3, photo_url),
          updated_at_ms = $4
      where id = $1
    `,
    [userId, input.displayName || null, input.photoURL || null, now]
  );
  if (input.displayName || input.photoURL) {
    await pgQuery(
      `
        update user_profiles
        set display_name = coalesce($2, display_name),
            avatar_url = coalesce($3, avatar_url),
            profile = profile || $4::jsonb,
            updated_at_ms = $5,
            updated_at = now()
        where id = $1
      `,
      [
        userId,
        input.displayName || null,
        input.photoURL || null,
        JSON.stringify({
          ...(input.displayName ? { name: input.displayName, displayName: input.displayName } : {}),
          ...(input.photoURL ? { avatarUrl: input.photoURL } : {}),
          updatedAt: now,
        }),
        now,
      ]
    );
  }
  return getAuthUserById(userId);
}

export async function createAuthActionToken(userId: string, type: "password_reset" | "email_verification") {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await pgQuery(
    `
      insert into auth_action_tokens (token_hash, user_id, type, created_at_ms, expires_at_ms)
      values ($1, $2, $3, $4, $5)
    `,
    [hashToken(token), userId, type, now, now + ACTION_TTL_MS]
  );
  return token;
}

export async function getAuthActionToken(token: string, type: "password_reset" | "email_verification") {
  const result = await pgQuery<{ user_id: string; email: string | null }>(
    `
      select t.user_id, u.email
      from auth_action_tokens t
      join auth_users u on u.id = t.user_id
      where t.token_hash = $1 and t.type = $2 and t.expires_at_ms > $3 and t.used_at_ms is null
    `,
    [hashToken(token), type, Date.now()]
  );
  return result.rows[0] || null;
}

export async function resetPasswordWithPostgresToken(token: string, password: string) {
  const row = await getAuthActionToken(token, "password_reset");
  if (!row) throw new Error("auth/invalid-action-code");
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  await pgQuery("update auth_users set password_hash = $2, updated_at_ms = $3 where id = $1", [row.user_id, passwordHash, now]);
  await pgQuery("update auth_action_tokens set used_at_ms = $2 where token_hash = $1", [hashToken(token), now]);
}

export async function verifyEmailWithPostgresToken(token: string) {
  const row = await getAuthActionToken(token, "email_verification");
  if (!row) throw new Error("auth/invalid-action-code");
  const now = Date.now();
  await pgQuery("update auth_users set email_verified = true, updated_at_ms = $2 where id = $1", [row.user_id, now]);
  await pgQuery("update auth_action_tokens set used_at_ms = $2 where token_hash = $1", [hashToken(token), now]);
}

export async function listPostgresAuthUsers(maxResults = 1000) {
  const result = await pgQuery<AuthUserRow>("select * from auth_users order by created_at_ms desc limit $1", [maxResults]);
  return {
    users: result.rows.map(userFromRow),
    pageToken: undefined,
  };
}

export async function deletePostgresAuthUser(userId: string) {
  await pgQuery("delete from auth_users where id = $1", [userId]);
}
