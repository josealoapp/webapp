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
  return 0;
}

function cleanData(data) {
  const output = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.endsWith("Server")) continue;
    output[key] = value && typeof value.toMillis === "function" ? value.toMillis() : value;
  }
  return output;
}

async function migrateChats(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const createdAt = toMillis(data.createdAt) || Date.now();
    const updatedAt = toMillis(data.updatedAt) || createdAt;

    if (!data.listingId || !data.buyerId || !data.sellerId) {
      console.warn(`Skipping chat ${doc.id}: missing listing, buyer, or seller.`);
      continue;
    }

    const row = {
      id: doc.id,
      ...data,
      createdAt,
      updatedAt,
    };

    if (!dryRun) {
      await pool.query(
        `
          insert into chats (id, listing_id, buyer_id, seller_id, data, created_at_ms, updated_at_ms)
          values ($1, $2, $3, $4, $5::jsonb, $6, $7)
          on conflict (id) do update
          set listing_id = excluded.listing_id,
              buyer_id = excluded.buyer_id,
              seller_id = excluded.seller_id,
              data = chats.data || excluded.data,
              created_at_ms = excluded.created_at_ms,
              updated_at_ms = excluded.updated_at_ms
        `,
        [doc.id, data.listingId, data.buyerId, data.sellerId, JSON.stringify(row), createdAt, updatedAt]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateMessages(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    const createdAt = toMillis(data.createdAt) || Date.now();

    if (!data.chatId || !data.senderId) {
      console.warn(`Skipping message ${doc.id}: missing chat or sender.`);
      continue;
    }

    const row = {
      id: doc.id,
      ...data,
      createdAt,
    };

    if (!dryRun) {
      await pool.query(
        `
          insert into messages (id, chat_id, sender_id, data, created_at_ms)
          values ($1, $2, $3, $4::jsonb, $5)
          on conflict (id) do update
          set chat_id = excluded.chat_id,
              sender_id = excluded.sender_id,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms
        `,
        [doc.id, data.chatId, data.senderId, JSON.stringify(row), createdAt]
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
    const [chatsSnap, messagesSnap] = await Promise.all([
      firestore.collection("chats").get(),
      firestore.collection("messages").get(),
    ]);

    console.log(`Found ${chatsSnap.size} Firestore chats.`);
    console.log(`Found ${messagesSnap.size} Firestore messages.`);

    const chats = await migrateChats(pool, chatsSnap.docs, dryRun);
    const messages = await migrateMessages(pool, messagesSnap.docs, dryRun);

    console.log(
      dryRun
        ? `Dry run complete: ${chats} valid chats, ${messages} valid messages.`
        : `Migration complete: ${chats} chats and ${messages} messages upserted.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
