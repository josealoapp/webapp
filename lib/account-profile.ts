"use client";

export type AccountType = "personal" | "business";

export type BusinessProfile = {
  businessName: string;
  country: string;
  province: string;
  hasPhysicalStore: boolean;
  storeAddress: string;
  whatsapp: string;
  categories: string[];
  rnc: string;
  email: string;
};

export type AccountProfile = {
  accountType: AccountType;
  onboardingCompleted: boolean;
  pendingBusinessUpgrade: boolean;
  interests: string[];
  whatsappPhone: string;
  useWhatsappForCustomers: boolean;
  businessProfile: BusinessProfile | null;
  businessVerificationPending: boolean;
  businessVerificationMessage: string | null;
  updatedAt: number;
};

export const ACCOUNT_PROFILE_KEY = "account_profile";

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  businessName: "",
  country: "República Dominicana",
  province: "",
  hasPhysicalStore: false,
  storeAddress: "",
  whatsapp: "",
  categories: [],
  rnc: "",
  email: "",
};

export function getDefaultAccountProfile(): AccountProfile {
  return {
    accountType: "personal",
    onboardingCompleted: false,
    pendingBusinessUpgrade: false,
    interests: [],
    whatsappPhone: "",
    useWhatsappForCustomers: false,
    businessProfile: null,
    businessVerificationPending: false,
    businessVerificationMessage: null,
    updatedAt: Date.now(),
  };
}

export function readAccountProfile(): AccountProfile {
  if (typeof window === "undefined") {
    return getDefaultAccountProfile();
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_PROFILE_KEY);
    if (!raw) {
      return getDefaultAccountProfile();
    }

    const parsed = JSON.parse(raw) as Partial<AccountProfile>;

    return {
      ...getDefaultAccountProfile(),
      ...parsed,
      businessProfile: parsed.businessProfile
        ? { ...DEFAULT_BUSINESS_PROFILE, ...parsed.businessProfile }
        : null,
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return getDefaultAccountProfile();
  }
}

export function writeAccountProfile(profile: AccountProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ACCOUNT_PROFILE_KEY,
    JSON.stringify({
      ...profile,
      updatedAt: Date.now(),
    })
  );
}

export function getPostAuthDestination(nextPath: string) {
  const profile = readAccountProfile();
  if (!profile.onboardingCompleted || profile.pendingBusinessUpgrade) {
    const flow = profile.pendingBusinessUpgrade ? "&flow=business" : "";
    return `/onboarding?next=${encodeURIComponent(nextPath || "/")}${flow}`;
  }

  return nextPath || "/";
}

export function getWhatsappContactSettings(profile: AccountProfile = readAccountProfile()) {
  const fallbackBusinessWhatsapp = profile.businessProfile?.whatsapp?.trim() || "";
  const phone = profile.whatsappPhone.trim() || fallbackBusinessWhatsapp;

  return {
    phone,
    enabled: Boolean(profile.useWhatsappForCustomers && phone),
  };
}
