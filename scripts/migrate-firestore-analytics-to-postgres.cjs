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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  return null;
}

function cleanData(data) {
  const output = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.endsWith("Server")) continue;
    output[key] = value && typeof value.toMillis === "function" ? value.toMillis() : value;
  }
  return output;
}

async function migrateSearchEvents(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const createdAt = toMillis(data.createdAt) || Date.now();
    if (!data.normalizedQuery && !data.query && !data.category) {
      console.warn(`Skipping search event ${doc.id}: empty search payload.`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `
          insert into search_events (
            id, query, normalized_query, category, location, user_id, source, data, created_at_ms
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9
          )
          on conflict (id) do update
          set query = excluded.query,
              normalized_query = excluded.normalized_query,
              category = excluded.category,
              location = excluded.location,
              user_id = excluded.user_id,
              source = excluded.source,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms
        `,
        [
          doc.id,
          data.query || "",
          data.normalizedQuery || "",
          data.category || "",
          data.location || "",
          data.userId || "",
          data.source || "search",
          JSON.stringify({ id: doc.id, ...data, createdAt }),
          createdAt,
        ]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateListingViewEvents(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const viewedAt = toMillis(data.viewedAt) || Date.now();
    if (!data.listingId) {
      console.warn(`Skipping listing view event ${doc.id}: missing listingId.`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `
          insert into listing_view_events (
            id, listing_id, bazar_item_id, owner_id, viewer_id, is_owner_view, data, viewed_at_ms
          ) values (
            $1, $2, $3, $4, $5, $6, $7::jsonb, $8
          )
          on conflict (id) do update
          set listing_id = excluded.listing_id,
              bazar_item_id = excluded.bazar_item_id,
              owner_id = excluded.owner_id,
              viewer_id = excluded.viewer_id,
              is_owner_view = excluded.is_owner_view,
              data = excluded.data,
              viewed_at_ms = excluded.viewed_at_ms
        `,
        [
          doc.id,
          data.listingId,
          data.bazarItemId || null,
          data.ownerId || "",
          data.viewerId || "",
          data.isOwnerView === true,
          JSON.stringify({ id: doc.id, ...data, viewedAt }),
          viewedAt,
        ]
      );
    }
    count += 1;
  }
  return count;
}

async function migratePresence(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const userId = data.userId || doc.id;
    const lastActiveAt = toMillis(data.lastActiveAt) || 0;
    if (!userId || !lastActiveAt) {
      console.warn(`Skipping user presence ${doc.id}: missing user or last active time.`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `
          insert into user_presence (user_id, last_active_at_ms, data, updated_at)
          values ($1, $2, $3::jsonb, now())
          on conflict (user_id) do update
          set last_active_at_ms = excluded.last_active_at_ms,
              data = excluded.data,
              updated_at = now()
        `,
        [userId, lastActiveAt, JSON.stringify({ id: doc.id, ...data, userId, lastActiveAt })]
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
    const [searchSnap, viewsSnap, presenceSnap] = await Promise.all([
      firestore.collection("searchEvents").get(),
      firestore.collection("listingViewEvents").get(),
      firestore.collection("userPresence").get(),
    ]);

    console.log(`Found ${searchSnap.size} search events.`);
    console.log(`Found ${viewsSnap.size} listing view events.`);
    console.log(`Found ${presenceSnap.size} presence records.`);

    const searchEvents = await migrateSearchEvents(pool, searchSnap.docs, dryRun);
    const listingViews = await migrateListingViewEvents(pool, viewsSnap.docs, dryRun);
    const presence = await migratePresence(pool, presenceSnap.docs, dryRun);

    console.log(
      dryRun
        ? `Dry run complete: ${searchEvents} search events, ${listingViews} listing views, ${presence} presence records.`
        : `Migration complete: ${searchEvents} search events, ${listingViews} listing views, ${presence} presence records upserted.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
