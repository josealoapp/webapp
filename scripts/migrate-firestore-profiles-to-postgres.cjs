const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function cleanFirestoreData(data) {
  const result = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.endsWith("Server")) continue;
    if (value && typeof value.toMillis === "function") {
      result[key] = value.toMillis();
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function upsertPublicProfile(pool, user, firestoreProfile) {
  const profile = {
    ...firestoreProfile,
    userId: user.uid,
    displayName: firestoreProfile.displayName || user.displayName || user.email || "",
    email: firestoreProfile.email || user.email || "",
    avatarUrl: firestoreProfile.avatarUrl || user.photoURL || "",
    createdAt:
      Number(firestoreProfile.createdAt || 0) ||
      (user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now()),
    updatedAt: Number(firestoreProfile.updatedAt || Date.now()),
  };

  await pool.query(
    `
      insert into user_profiles (
        id, display_name, email, avatar_url, support_status, is_verified, profile, created_at_ms, updated_at_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9
      )
      on conflict (id) do update
      set
        display_name = excluded.display_name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        support_status = excluded.support_status,
        is_verified = excluded.is_verified,
        profile = user_profiles.profile || excluded.profile,
        updated_at_ms = excluded.updated_at_ms,
        updated_at = now()
    `,
    [
      user.uid,
      profile.displayName,
      profile.email,
      profile.avatarUrl,
      profile.supportStatus || "active",
      profile.isVerified === true,
      JSON.stringify(profile),
      profile.createdAt,
      profile.updatedAt,
    ]
  );
}

async function upsertPrivateProfile(pool, userId, firestoreProfile) {
  const profile = {
    ...firestoreProfile,
    userId,
    createdAt: Number(firestoreProfile.createdAt || Date.now()),
    updatedAt: Number(firestoreProfile.updatedAt || Date.now()),
  };

  await pool.query(
    `
      insert into user_private_profiles (user_id, profile, created_at_ms, updated_at_ms)
      values ($1, $2::jsonb, $3, $4)
      on conflict (user_id) do update
      set
        profile = user_private_profiles.profile || excluded.profile,
        updated_at_ms = excluded.updated_at_ms,
        updated_at = now()
    `,
    [userId, JSON.stringify(profile), profile.createdAt, profile.updatedAt]
  );
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const dryRun = process.argv.includes("--dry-run");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: requireEnv("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey: requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }

  const auth = getAuth();
  const firestore = getFirestore();
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const users = await listAllAuthUsers(auth);
    const publicSnap = await firestore.collection("userProfiles").get();
    const privateSnap = await firestore.collection("userPrivateProfiles").get();

    const publicProfiles = new Map(publicSnap.docs.map((doc) => [doc.id, cleanFirestoreData(doc.data())]));
    const privateProfiles = new Map(privateSnap.docs.map((doc) => [doc.id, cleanFirestoreData(doc.data())]));

    console.log(`Found ${users.length} auth users.`);
    console.log(`Found ${publicProfiles.size} public Firestore profiles.`);
    console.log(`Found ${privateProfiles.size} private Firestore profiles.`);

    if (!dryRun) {
      for (const user of users) {
        await upsertPublicProfile(pool, user, publicProfiles.get(user.uid) || {});
        const privateProfile = privateProfiles.get(user.uid);
        if (privateProfile) await upsertPrivateProfile(pool, user.uid, privateProfile);
      }

      for (const [userId, privateProfile] of privateProfiles.entries()) {
        if (!users.some((user) => user.uid === userId)) {
          await pool.query(
            `
              insert into user_profiles (id, profile, created_at_ms, updated_at_ms)
              values ($1, '{}'::jsonb, $2, $2)
              on conflict (id) do nothing
            `,
            [userId, Date.now()]
          );
          await upsertPrivateProfile(pool, userId, privateProfile);
        }
      }
    }

    console.log(
      dryRun
        ? "Dry run complete. No profile rows written."
        : `Migration complete. Upserted ${users.length} public user profiles and ${privateProfiles.size} private profiles.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
