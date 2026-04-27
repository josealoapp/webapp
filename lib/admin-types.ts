export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  isVerified: boolean;
};

export type AdminReportRow = {
  id: string;
  listingId: string;
  bazarItemId: string;
  sellerId: string;
  itemTitle: string;
  reason: string;
  details: string;
  reporterId: string;
  reporterName: string;
  createdAt: number;
  status: string;
  listingImage: string;
};
