import { Pool, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function isPostgresListingsEnabled() {
  return process.env.USE_POSTGRES_LISTINGS === "true";
}

export function isPostgresSocialEnabled() {
  return process.env.USE_POSTGRES_SOCIAL === "true";
}

export function isPostgresChatsEnabled() {
  return process.env.USE_POSTGRES_CHATS === "true";
}

export function isPostgresSalesEnabled() {
  return process.env.USE_POSTGRES_SALES === "true";
}

export function isPostgresAdminEnabled() {
  return process.env.USE_POSTGRES_ADMIN === "true";
}

export function isPostgresAdsEnabled() {
  return process.env.USE_POSTGRES_ADS === "true";
}

export function isPostgresAnalyticsEnabled() {
  return process.env.USE_POSTGRES_ANALYTICS === "true";
}

export function isPostgresAuthEnabled() {
  return process.env.USE_POSTGRES_AUTH === "true";
}

export function getPostgresPool() {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("postgres/missing-database-url");
  }

  pool = new Pool({
    connectionString,
    max: 10,
  });

  return pool;
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return getPostgresPool().query<T>(text, values);
}

export async function pgTransaction<T>(
  callback: (query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<R>>) => Promise<T>
) {
  const client = await getPostgresPool().connect();

  try {
    await client.query("begin");
    const result = await callback((text, values = []) => client.query(text, values));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
