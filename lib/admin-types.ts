export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  isVerified: boolean;
  accountType?: "personal" | "business";
  businessName?: string;
  businessVerificationStatus?: "pending" | "verified" | "";
  supportStatus?: "active" | "deactivated";
  supportDeactivationReason?: string;
};

export type AdminReportRow = {
  id: string;
  reportType?: "item" | "user";
  listingId: string;
  bazarItemId: string;
  sellerId: string;
  itemTitle: string;
  targetUserId?: string;
  targetUserName?: string;
  reportedUserEmail?: string;
  reason: string;
  details: string;
  reporterId: string;
  reporterName: string;
  createdAt: number;
  status: string;
  handledAction?: "delete_item" | "delete_user" | "omit";
  handledReason?: string;
  handledAt?: number;
  listingImage: string;
};

export type AdminReportedListing = {
  id: string;
  title: string;
  price: number;
  currency?: string;
  category: string;
  location: string;
  image: string;
  status: string;
  createdAt: number;
};

export type AdminReportDetails = {
  report: AdminReportRow;
  user: {
    uid: string;
    email: string;
    displayName: string;
    createdAt: number;
    location: string;
    salesCategory: string;
  };
  metrics: {
    reportCount: number;
    interactionCount: number;
    accountAgeDays: number;
    location: string;
    salesCategory: string;
  };
  listings: AdminReportedListing[];
  relatedReports: AdminReportRow[];
};
