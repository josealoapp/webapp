import type { MetadataRoute } from "next";
import { appCategories } from "@/lib/categories";
import { pgQuery } from "@/lib/postgres";

const siteUrl = "https://josealo.com";

type SitemapListingRow = {
  id: string;
  updated_at_ms: number | string | null;
  created_at_ms: number | string | null;
};

export const revalidate = 3600;

function absoluteUrl(path: string) {
  return `${siteUrl}${path}`;
}

function dateFromMs(value: number | string | null | undefined) {
  const timestamp = Number(value || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date();
}

async function getActiveListingUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const result = await pgQuery<SitemapListingRow>(
      `
        select id, updated_at_ms, created_at_ms
        from listings
        where status = 'active'
        order by created_at_ms desc
        limit 1000
      `
    );

    return result.rows.map((row) => ({
      url: absoluteUrl(`/item/${encodeURIComponent(row.id)}`),
      lastModified: dateFromMs(row.updated_at_ms || row.created_at_ms),
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/categories"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/descubre"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/search"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = appCategories.map((category) => ({
    url: absoluteUrl(`/categories/${category.id}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...(await getActiveListingUrls())];
}
