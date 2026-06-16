"use client";

import { auth } from "@/lib/firebase";

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
  userId: string;
  accountType: AccountType;
  onboardingRequired: boolean;
  onboardingCompleted: boolean;
  pendingBusinessUpgrade: boolean;
  interests: string[];
  specificInterests: string[];
  whatsappPhone: string;
  useWhatsappForCustomers: boolean;
  businessProfile: BusinessProfile | null;
  businessVerificationPending: boolean;
  businessVerificationMessage: string | null;
  updatedAt: number;
};

export const ACCOUNT_PROFILE_KEY = "account_profile";
const ACCOUNT_PROFILE_EVENT = "josealo:account-profile-changed";

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
    userId: "",
    accountType: "personal",
    onboardingRequired: false,
    onboardingCompleted: true,
    pendingBusinessUpgrade: false,
    interests: [],
    specificInterests: [],
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
      specificInterests: Array.isArray(parsed.specificInterests) ? parsed.specificInterests : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return getDefaultAccountProfile();
  }
}

function cacheAccountProfile(profile: AccountProfile) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    ACCOUNT_PROFILE_KEY,
    JSON.stringify({
      ...profile,
      updatedAt: Date.now(),
    })
  );
  window.dispatchEvent(new CustomEvent(ACCOUNT_PROFILE_EVENT));
}

function normalizeAccountProfile(input: Partial<AccountProfile> | undefined): AccountProfile {
  return {
    ...getDefaultAccountProfile(),
    ...(input || {}),
    businessProfile: input?.businessProfile
      ? { ...DEFAULT_BUSINESS_PROFILE, ...input.businessProfile }
      : null,
    interests: Array.isArray(input?.interests) ? input.interests : [],
    specificInterests: Array.isArray(input?.specificInterests) ? input.specificInterests : [],
    updatedAt: typeof input?.updatedAt === "number" ? input.updatedAt : Date.now(),
  };
}

export async function loadAccountProfileFromBackend(userId = auth.currentUser?.uid) {
  if (!userId) return readAccountProfile();

  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return readAccountProfile();

    const response = await fetch(`/api/profile?scope=private&userId=${encodeURIComponent(userId)}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json().catch(() => null)) as
      | { profile?: Partial<AccountProfile> | null }
      | null;

    if (!response.ok || !payload?.profile) {
      const localProfile = readAccountProfile();
      if (localProfile.userId === userId && localProfile.onboardingRequired && !localProfile.onboardingCompleted) {
        return localProfile;
      }

      const profile = normalizeAccountProfile({
        userId,
        onboardingRequired: false,
        onboardingCompleted: true,
      });
      cacheAccountProfile(profile);
      return profile;
    }

    const profile = normalizeAccountProfile({
      userId,
      ...payload.profile,
    });
    cacheAccountProfile(profile);
    return profile;
  } catch {
    return readAccountProfile();
  }
}

export function writeAccountProfile(profile: AccountProfile) {
  const payload = {
    ...profile,
    updatedAt: Date.now(),
  };

  cacheAccountProfile(payload);

  const user = auth.currentUser;
  if (!user) return;

  void user.getIdToken().then((token) =>
    fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.uid,
        scope: "private",
        profile: payload,
      }),
    })
  ).catch(() => {
    // Local cache remains available if the network is temporarily unavailable.
  });
}

export function subscribeAccountProfile(onData: (profile: AccountProfile) => void) {
  let cancelled = false;

  const publishLocal = () => onData(readAccountProfile());
  const load = async () => {
    const profile = await loadAccountProfileFromBackend();
    if (!cancelled) onData(profile);
  };

  publishLocal();
  void load();

  if (typeof window === "undefined") {
    return () => {
      cancelled = true;
    };
  }

  const intervalId = window.setInterval(load, 15000);
  const handleChange = () => publishLocal();
  window.addEventListener(ACCOUNT_PROFILE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
    window.removeEventListener(ACCOUNT_PROFILE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function getPostAuthDestination(nextPath: string) {
  const profile = readAccountProfile();
  const currentUserId = auth.currentUser?.uid || "";
  const isCurrentUsersOnboarding =
    profile.onboardingRequired &&
    !profile.onboardingCompleted &&
    (!profile.userId || !currentUserId || profile.userId === currentUserId);

  if (isCurrentUsersOnboarding || profile.pendingBusinessUpgrade) {
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
