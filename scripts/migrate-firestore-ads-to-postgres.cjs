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
    const snap = await firestore.collection("marketplaceAds").get();
    console.log(`Found ${snap.size} marketplace ads.`);

    let count = 0;
    for (const doc of snap.docs) {
      const data = cleanData(doc.data());
      if (!data.campaignName || !data.imageUrl || !data.linkUrl || !data.startDate || !data.endDate) {
        console.warn(`Skipping marketplace ad ${doc.id}: missing required campaign fields.`);
        continue;
      }

      const createdAt = toMillis(data.createdAt);
      if (!dryRun) {
        await pool.query(
          `
            insert into marketplace_ads (
              id, campaign_name, image_url, link_url, start_date, end_date, data, created_at_ms
            ) values (
              $1, $2, $3, $4, $5, $6, $7::jsonb, $8
            )
            on conflict (id) do update
            set campaign_name = excluded.campaign_name,
                image_url = excluded.image_url,
                link_url = excluded.link_url,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                data = excluded.data,
                created_at_ms = excluded.created_at_ms
          `,
          [
            doc.id,
            data.campaignName,
            data.imageUrl,
            data.linkUrl,
            data.startDate,
            data.endDate,
            JSON.stringify({ id: doc.id, ...data, createdAt }),
            createdAt,
          ]
        );
      }
      count += 1;
    }

    console.log(dryRun ? `Dry run complete: ${count} ads ready.` : `Migration complete: ${count} ads upserted.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
