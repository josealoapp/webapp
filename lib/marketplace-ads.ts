export type MarketplaceAd = {
  id: string;
  campaignName: string;
  imageUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  createdAt: number;
};

function getDateKeyInAppTimezone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isAdActive(ad: MarketplaceAd, now = new Date()) {
  const today = getDateKeyInAppTimezone(now);
  return Boolean(ad.imageUrl && ad.startDate <= today && ad.endDate >= today);
}
