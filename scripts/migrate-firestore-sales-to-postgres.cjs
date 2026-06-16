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

async function migrateSoldEvents(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.listingId || !data.ownerId) {
      console.warn(`Skipping sold event ${doc.id}: missing listing or owner.`);
      continue;
    }
    const soldAt = toMillis(data.soldAt);
    if (!dryRun) {
      await pool.query(
        `
          insert into listing_sold_events (id, listing_id, owner_id, type, data, sold_at_ms)
          values ($1, $2, $3, $4, $5::jsonb, $6)
          on conflict (id) do update
          set listing_id = excluded.listing_id,
              owner_id = excluded.owner_id,
              type = excluded.type,
              data = excluded.data,
              sold_at_ms = excluded.sold_at_ms
        `,
        [doc.id, data.listingId, data.ownerId, data.type || "listing", JSON.stringify({ id: doc.id, ...data, soldAt }), soldAt]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateReviewRequests(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.listingId || !data.sellerId || !data.buyerId) {
      console.warn(`Skipping review request ${doc.id}: missing listing, seller, or buyer.`);
      continue;
    }
    const createdAt = toMillis(data.createdAt);
    if (!dryRun) {
      await pool.query(
        `
          insert into purchase_review_requests (id, listing_id, seller_id, buyer_id, status, data, created_at_ms, updated_at_ms)
          values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
          on conflict (id) do update
          set listing_id = excluded.listing_id,
              seller_id = excluded.seller_id,
              buyer_id = excluded.buyer_id,
              status = excluded.status,
              data = purchase_review_requests.data || excluded.data,
              updated_at_ms = excluded.updated_at_ms
        `,
        [doc.id, data.listingId, data.sellerId, data.buyerId, data.status || "pending", JSON.stringify({ id: doc.id, ...data, createdAt }), createdAt, data.updatedAt || null]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateRatings(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const rating = Number(data.rating);
    if (!data.sellerId || !data.buyerId || !Number.isInteger(rating)) {
      console.warn(`Skipping rating ${doc.id}: missing seller, buyer, or rating.`);
      continue;
    }
    const createdAt = toMillis(data.createdAt);
    if (!dryRun) {
      await pool.query(
        `
          insert into user_ratings (id, seller_id, buyer_id, listing_id, rating, comment, data, created_at_ms)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
          on conflict (id) do update
          set seller_id = excluded.seller_id,
              buyer_id = excluded.buyer_id,
              listing_id = excluded.listing_id,
              rating = excluded.rating,
              comment = excluded.comment,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms
        `,
        [doc.id, data.sellerId, data.buyerId, data.listingId || "", rating, data.comment || "", JSON.stringify({ id: doc.id, ...data, createdAt }), createdAt]
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
    const [soldSnap, requestSnap, ratingSnap] = await Promise.all([
      firestore.collection("listingSoldEvents").get(),
      firestore.collection("purchaseReviewRequests").get(),
      firestore.collection("userRatings").get(),
    ]);
    console.log(`Found ${soldSnap.size} sold events.`);
    console.log(`Found ${requestSnap.size} review requests.`);
    console.log(`Found ${ratingSnap.size} user ratings.`);
    const sold = await migrateSoldEvents(pool, soldSnap.docs, dryRun);
    const requests = await migrateReviewRequests(pool, requestSnap.docs, dryRun);
    const ratings = await migrateRatings(pool, ratingSnap.docs, dryRun);
    console.log(
      dryRun
        ? `Dry run complete: ${sold} sold events, ${requests} review requests, ${ratings} ratings.`
        : `Migration complete: ${sold} sold events, ${requests} review requests, ${ratings} ratings upserted.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
