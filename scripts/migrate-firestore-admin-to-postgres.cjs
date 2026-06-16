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

async function migrateReports(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.reporterId) {
      console.warn(`Skipping report ${doc.id}: missing reporter.`);
      continue;
    }
    const createdAt = toMillis(data.createdAt);
    if (!dryRun) {
      await pool.query(
        `
          insert into reports (
            id, report_type, listing_id, seller_id, target_user_id, reporter_id, status, data, created_at_ms, handled_at_ms
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10
          )
          on conflict (id) do update
          set report_type = excluded.report_type,
              listing_id = excluded.listing_id,
              seller_id = excluded.seller_id,
              target_user_id = excluded.target_user_id,
              reporter_id = excluded.reporter_id,
              status = excluded.status,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms,
              handled_at_ms = excluded.handled_at_ms
        `,
        [
          doc.id,
          data.reportType || "item",
          data.listingId || null,
          data.sellerId || null,
          data.targetUserId || null,
          data.reporterId,
          data.status || "open",
          JSON.stringify({ id: doc.id, ...data, createdAt }),
          createdAt,
          data.handledAt || null,
        ]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateNotifications(pool, docs, dryRun) {
  let count = 0;
  for (const doc of docs) {
    const data = cleanData(doc.data());
    if (!data.userId || !data.type) {
      console.warn(`Skipping support notification ${doc.id}: missing user or type.`);
      continue;
    }
    const createdAt = toMillis(data.createdAt);
    if (!dryRun) {
      await pool.query(
        `
          insert into support_notifications (
            id, user_id, type, title, message, reason, listing_id, read, data, created_at_ms, read_at_ms
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11
          )
          on conflict (id) do update
          set user_id = excluded.user_id,
              type = excluded.type,
              title = excluded.title,
              message = excluded.message,
              reason = excluded.reason,
              listing_id = excluded.listing_id,
              read = excluded.read,
              data = excluded.data,
              created_at_ms = excluded.created_at_ms,
              read_at_ms = excluded.read_at_ms
        `,
        [
          doc.id,
          data.userId,
          data.type,
          data.title || "",
          data.message || "",
          data.reason || "",
          data.listingId || null,
          data.read === true,
          JSON.stringify({ id: doc.id, ...data, createdAt }),
          createdAt,
          data.readAt || null,
        ]
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
    const [reportsSnap, notificationsSnap] = await Promise.all([
      firestore.collection("reports").get(),
      firestore.collection("supportNotifications").get(),
    ]);
    console.log(`Found ${reportsSnap.size} reports.`);
    console.log(`Found ${notificationsSnap.size} support notifications.`);
    const reports = await migrateReports(pool, reportsSnap.docs, dryRun);
    const notifications = await migrateNotifications(pool, notificationsSnap.docs, dryRun);
    console.log(
      dryRun
        ? `Dry run complete: ${reports} reports, ${notifications} notifications.`
        : `Migration complete: ${reports} reports and ${notifications} notifications upserted.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
