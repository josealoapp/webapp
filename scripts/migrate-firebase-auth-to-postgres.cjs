const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

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
  if (!value) return Date.now();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
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
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const users = await listAllUsers(auth);
    console.log(`Found ${users.length} Firebase Auth users.`);

    let count = 0;
    for (const user of users) {
      const createdAt = toMillis(user.metadata.creationTime);
      const provider = user.providerData[0]?.providerId || "firebase";
      if (!dryRun) {
        await pool.query(
          `
            insert into auth_users (
              id, email, display_name, photo_url, email_verified, disabled, provider,
              provider_id, password_hash, created_at_ms, updated_at_ms
            ) values (
              $1, lower($2), $3, $4, $5, $6, $7, $8, null, $9, $10
            )
            on conflict (id) do update
            set email = excluded.email,
                display_name = excluded.display_name,
                photo_url = excluded.photo_url,
                email_verified = excluded.email_verified,
                disabled = excluded.disabled,
                provider = excluded.provider,
                provider_id = excluded.provider_id,
                updated_at_ms = excluded.updated_at_ms
          `,
          [
            user.uid,
            user.email || null,
            user.displayName || user.email?.split("@")[0] || "",
            user.photoURL || "",
            user.emailVerified === true,
            user.disabled === true,
            provider,
            user.providerData[0]?.uid || null,
            createdAt,
            Date.now(),
          ]
        );
      }
      count += 1;
    }

    console.log(
      dryRun
        ? `Dry run complete: ${count} auth users ready. Passwords cannot be migrated from Firebase.`
        : `Migration complete: ${count} auth users upserted. Passwords cannot be migrated from Firebase.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
