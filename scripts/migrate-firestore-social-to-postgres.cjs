const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
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
  return Date.now();
}

function cleanData(data) {
  const output = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.endsWith("Server")) continue;
    output[key] = value && typeof value.toMillis === "function" ? value.toMillis() : value;
  }
  return output;
}

async function migrateLikes(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.actorId || !data.ownerId || !data.listingId) {
      console.warn(`Skipping like ${doc.id}: missing actor, owner, or listing.`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `
          insert into likes (id, actor_id, owner_id, listing_id, bazar_item_id, data, created_at_ms)
          values ($1, $2, $3, $4, $5, $6::jsonb, $7)
          on conflict (id) do update
          set actor_id = excluded.actor_id,
              owner_id = excluded.owner_id,
              listing_id = excluded.listing_id,
              bazar_item_id = excluded.bazar_item_id,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms
        `,
        [
          doc.id,
          data.actorId,
          data.ownerId,
          data.listingId,
          data.bazarItemId || null,
          JSON.stringify({ id: doc.id, ...data }),
          toMillis(data.createdAt),
        ]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateFollows(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.followerId || !data.followeeId) {
      console.warn(`Skipping follow ${doc.id}: missing follower or followee.`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `
          insert into follows (id, follower_id, followee_id, data, created_at_ms)
          values ($1, $2, $3, $4::jsonb, $5)
          on conflict (id) do update
          set follower_id = excluded.follower_id,
              followee_id = excluded.followee_id,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms
        `,
        [doc.id, data.followerId, data.followeeId, JSON.stringify({ id: doc.id, ...data }), toMillis(data.createdAt)]
      );
    }
    count += 1;
  }
  return count;
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

  const firestore = getFirestore();
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const [likesSnap, followsSnap] = await Promise.all([
      firestore.collection("likes").get(),
      firestore.collection("follows").get(),
    ]);

    console.log(`Found ${likesSnap.size} Firestore likes.`);
    console.log(`Found ${followsSnap.size} Firestore follows.`);

    const likes = await migrateLikes(pool, likesSnap.docs, dryRun);
    const follows = await migrateFollows(pool, followsSnap.docs, dryRun);

    console.log(
      dryRun
        ? `Dry run complete: ${likes} valid likes, ${follows} valid follows.`
        : `Migration complete: ${likes} likes and ${follows} follows upserted.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
