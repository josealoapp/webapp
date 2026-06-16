import { randomUUID } from "crypto";
import type { MarketplaceAd } from "@/lib/marketplace-ads";
import { pgQuery } from "@/lib/postgres";

type MarketplaceAdRow = {
  id: string;
  campaign_name: string;
  image_url: string;
  link_url: string;
  start_date: string;
  end_date: string;
  data: Record<string, unknown>;
  created_at_ms: number | string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function adFromRow(row: MarketplaceAdRow): MarketplaceAd {
  return {
    id: row.id,
    ...(row.data || {}),
    campaignName: row.campaign_name,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: toNumber(row.created_at_ms),
  } as MarketplaceAd;
}

export async function listMarketplaceAdsFromPostgres() {
  const result = await pgQuery<MarketplaceAdRow>("select * from marketplace_ads order by created_at_ms desc");
  return result.rows.map(adFromRow);
}

export async function createMarketplaceAdInPostgres(input: Omit<MarketplaceAd, "id">) {
  const id = randomUUID();
  await pgQuery(
    `
      insert into marketplace_ads (
        id, campaign_name, image_url, link_url, start_date, end_date, data, created_at_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8
      )
    `,
    [
      id,
      input.campaignName,
      input.imageUrl,
      input.linkUrl,
      input.startDate,
      input.endDate,
      JSON.stringify({ id, ...input }),
      input.createdAt,
    ]
  );

  return {
    id,
    ...input,
  } satisfies MarketplaceAd;
}

export async function deleteMarketplaceAdFromPostgres(adId: string) {
  await pgQuery("delete from marketplace_ads where id = $1", [adId]);
}
