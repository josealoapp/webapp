import { randomUUID } from "crypto";
import type { AdminReportRow } from "@/lib/admin-types";
import { pgQuery } from "@/lib/postgres";

type ReportRow = {
  id: string;
  report_type: string;
  listing_id: string | null;
  seller_id: string | null;
  target_user_id: string | null;
  reporter_id: string;
  status: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
  handled_at_ms: number | string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reason: string;
  listing_id: string | null;
  read: boolean;
  data: Record<string, unknown>;
  created_at_ms: number | string;
  read_at_ms: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportFromRow(row: ReportRow): AdminReportRow {
  return {
    id: row.id,
    ...(row.data || {}),
    reportType: row.report_type as AdminReportRow["reportType"],
    listingId: row.listing_id || "",
    sellerId: row.seller_id || "",
    targetUserId: row.target_user_id || "",
    reporterId: row.reporter_id,
    status: row.status,
    createdAt: toNumber(row.created_at_ms),
    handledAt: toNumber(row.handled_at_ms) || undefined,
    listingImage: "",
  } as AdminReportRow;
}

function notificationFromRow(row: NotificationRow) {
  return {
    id: row.id,
    ...(row.data || {}),
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    reason: row.reason,
    listingId: row.listing_id || undefined,
    read: row.read,
    createdAt: toNumber(row.created_at_ms),
    readAt: toNumber(row.read_at_ms) || undefined,
  };
}

export async function createReportInPostgres(input: Record<string, unknown>) {
  const id = randomUUID();
  const createdAt = Number(input.createdAt || Date.now());
  await pgQuery(
    `
      insert into reports (
        id, report_type, listing_id, seller_id, target_user_id, reporter_id, status, data, created_at_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9
      )
    `,
    [
      id,
      String(input.reportType || "item"),
      String(input.listingId || "") || null,
      String(input.sellerId || "") || null,
      String(input.targetUserId || "") || null,
      String(input.reporterId || ""),
      String(input.status || "open"),
      JSON.stringify({ id, ...input, createdAt }),
      createdAt,
    ]
  );
  return id;
}

export async function listReportsFromPostgres() {
  const result = await pgQuery<ReportRow>("select * from reports order by created_at_ms desc");
  return result.rows.map(reportFromRow);
}

export async function getReportFromPostgres(reportId: string) {
  const result = await pgQuery<ReportRow>("select * from reports where id = $1", [reportId]);
  const row = result.rows[0];
  return row ? reportFromRow(row) : null;
}

export async function listReportsForUserFromPostgres(userId: string) {
  const result = await pgQuery<ReportRow>(
    `
      select *
      from reports
      where seller_id = $1 or target_user_id = $1
      order by created_at_ms desc
    `,
    [userId]
  );
  return result.rows.map(reportFromRow);
}

export async function markReportHandledInPostgres(
  reportId: string,
  input: { action: "delete_item" | "delete_user" | "omit"; reason: string }
) {
  if (!reportId) return;
  const now = Date.now();
  await pgQuery(
    `
      update reports
      set status = 'handled',
          data = data || $2::jsonb,
          handled_at_ms = $3
      where id = $1
    `,
    [
      reportId,
      JSON.stringify({
        status: "handled",
        handledAction: input.action,
        handledReason: input.reason,
        handledAt: now,
        updatedAt: now,
      }),
      now,
    ]
  );
}

export async function createSupportNotificationInPostgres(input: {
  userId: string;
  title: string;
  message: string;
  reason: string;
  type: string;
  listingId?: string;
}) {
  const id = randomUUID();
  const createdAt = Date.now();
  await pgQuery(
    `
      insert into support_notifications (
        id, user_id, type, title, message, reason, listing_id, read, data, created_at_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7, false, $8::jsonb, $9
      )
    `,
    [
      id,
      input.userId,
      input.type,
      input.title,
      input.message,
      input.reason,
      input.listingId || null,
      JSON.stringify({ id, ...input, read: false, createdAt }),
      createdAt,
    ]
  );
  return id;
}

export async function listSupportNotificationsFromPostgres(userId: string) {
  const result = await pgQuery<NotificationRow>(
    `
      select *
      from support_notifications
      where user_id = $1
      order by created_at_ms desc
      limit 100
    `,
    [userId]
  );
  return result.rows.map(notificationFromRow);
}

export async function markSupportNotificationReadInPostgres(notificationId: string) {
  const now = Date.now();
  await pgQuery(
    `
      update support_notifications
      set read = true,
          read_at_ms = $2,
          data = data || $3::jsonb
      where id = $1
    `,
    [notificationId, now, JSON.stringify({ read: true, readAt: now })]
  );
}

export async function setUserSupportStatusInPostgres(
  userId: string,
  input: { status: "active" | "deactivated"; reason?: string }
) {
  const now = Date.now();
  const profile =
    input.status === "deactivated"
      ? {
          supportStatus: "deactivated",
          supportDeactivationReason: input.reason || "Moderación de soporte",
          supportDeactivatedAt: now,
          updatedAt: now,
        }
      : {
          supportStatus: "active",
          supportReactivatedAt: now,
          updatedAt: now,
        };
  await pgQuery(
    `
      insert into user_profiles (id, support_status, profile, updated_at_ms)
      values ($1, $2, $3::jsonb, $4)
      on conflict (id) do update
      set support_status = excluded.support_status,
          profile = user_profiles.profile || excluded.profile,
          updated_at_ms = excluded.updated_at_ms,
          updated_at = now()
    `,
    [userId, input.status, JSON.stringify(profile), now]
  );
}
