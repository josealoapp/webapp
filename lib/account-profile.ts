"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
    accountType: "personal",
    onboardingCompleted: false,
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

function getCurrentProfileRef() {
  const user = auth.currentUser;
  return user ? doc(db, "userPrivateProfiles", user.uid) : null;
}

export async function loadAccountProfileFromBackend(userId = auth.currentUser?.uid) {
  if (!userId) return readAccountProfile();

  try {
    const snapshot = await getDoc(doc(db, "userPrivateProfiles", userId));
    if (!snapshot.exists()) return readAccountProfile();
    const profile = normalizeAccountProfile(snapshot.data() as Partial<AccountProfile>);
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

  const profileRef = getCurrentProfileRef();
  if (!profileRef) return;

  void setDoc(
    profileRef,
    {
      ...payload,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true }
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
