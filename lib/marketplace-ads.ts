export type MarketplaceAd = {
  id: string;
  campaignName: string;
  imageUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  createdAt: number;
};

export function isAdActive(ad: MarketplaceAd, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return ad.startDate <= today && ad.endDate >= today;
}
