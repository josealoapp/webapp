"use client";

import { Country, State } from "country-state-city";
import { DEFAULT_BUSINESS_PROFILE, readAccountProfile } from "@/lib/account-profile";

const USER_LOCATION_KEY = "josealo_user_location";

const DOMINICAN_GEO_FALLBACKS = [
  { name: "Santo Domingo", latitude: 18.4861, longitude: -69.9312 },
  { name: "San Cristóbal", latitude: 18.4167, longitude: -70.1167 },
  { name: "Santiago", latitude: 19.4517, longitude: -70.697 },
  { name: "La Romana", latitude: 18.4273, longitude: -68.9728 },
  { name: "La Altagracia", latitude: 18.617, longitude: -68.7081 },
  { name: "San Pedro de Macorís", latitude: 18.4539, longitude: -69.3067 },
  { name: "Puerto Plata", latitude: 19.7902, longitude: -70.6884 },
] as const;

export type StoredUserLocation = {
  name: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  updatedAt: number;
};

export type LocationOption = {
  name: string;
  detail: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(bLat - aLat);
  const deltaLon = toRadians(bLon - aLon);
  const startLat = toRadians(aLat);
  const endLat = toRadians(bLat);

  const inner =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
}

function resolveDominicanLocation(latitude: number, longitude: number) {
  return DOMINICAN_GEO_FALLBACKS.reduce<{ name: string; distance: number }>(
    (closest, option) => {
      const distance = haversineDistanceKm(latitude, longitude, option.latitude, option.longitude);
      return distance < closest.distance ? { name: option.name, distance } : closest;
    },
    { name: DOMINICAN_GEO_FALLBACKS[0].name, distance: Number.POSITIVE_INFINITY }
  ).name;
}

function getCountryOptions() {
  const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

  return Country.getAllCountries()
    .map((country) => ({
      isoCode: country.isoCode,
      name: regionNames.of(country.isoCode) || country.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function getCountryIsoCode(countryName: string) {
  return getCountryOptions().find(
    (country) => normalizeText(country.name) === normalizeText(countryName)
  )?.isoCode;
}

export function getSignedUpCountry() {
  const profile = readAccountProfile();
  return profile.businessProfile?.country?.trim() || DEFAULT_BUSINESS_PROFILE.country;
}

export function getSignedUpProvince() {
  const profile = readAccountProfile();
  return profile.businessProfile?.province?.trim() || "";
}

export function getLocationOptionsForCountry(countryName = getSignedUpCountry()): LocationOption[] {
  const isoCode = getCountryIsoCode(countryName);
  if (!isoCode) {
    return [
      {
        name: countryName,
        detail: countryName,
      },
    ];
  }

  const states = State.getStatesOfCountry(isoCode)
    .map((state) => state.name.replace(/ Province$/i, "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));

  if (states.length === 0) {
    return [
      {
        name: countryName,
        detail: countryName,
      },
    ];
  }

  return states.map((stateName) => ({
    name: stateName,
    detail: `${stateName}, ${countryName}`,
  }));
}

export function normalizeLocationName(location: string) {
  const normalized = normalizeText(location);

  if (normalized === "sdn" || normalized === "distrito nacional") return "santo domingo";
  if (normalized === "santiago de los caballeros") return "santiago";
  if (normalized === "punta cana") return "la altagracia";

  return normalized;
}

export function readStoredUserLocation() {
  if (typeof window === "undefined") return null as StoredUserLocation | null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserLocation>;
    if (!parsed.name || typeof parsed.name !== "string") {
      return null;
    }

    return {
      name: parsed.name,
      country:
        typeof parsed.country === "string" && parsed.country.trim()
          ? parsed.country
          : getSignedUpCountry(),
      latitude: typeof parsed.latitude === "number" ? parsed.latitude : null,
      longitude: typeof parsed.longitude === "number" ? parsed.longitude : null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeStoredUserLocation(location: StoredUserLocation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(location));
}

export function getDefaultListingLocation() {
  const stored = readStoredUserLocation();
  if (stored?.name) return stored.name;

  const signedUpProvince = getSignedUpProvince();
  if (signedUpProvince) return signedUpProvince;

  return getLocationOptionsForCountry(getSignedUpCountry())[0]?.name || "Santo Domingo";
}

export async function requestCurrentSupportedLocation(): Promise<StoredUserLocation> {
  const country = getSignedUpCountry();
  const signedUpProvince = getSignedUpProvince();

  const fromProfile = () => {
    if (!signedUpProvince) {
      throw new Error("location/not-available");
    }

    const payload: StoredUserLocation = {
      name: signedUpProvince,
      country,
      latitude: null,
      longitude: null,
      updatedAt: Date.now(),
    };

    writeStoredUserLocation(payload);
    return payload;
  };

  if (typeof window === "undefined" || !navigator.geolocation) {
    return fromProfile();
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const resolvedName =
      normalizeText(country) === normalizeText("República Dominicana")
        ? resolveDominicanLocation(latitude, longitude)
        : signedUpProvince;

    if (!resolvedName) {
      return fromProfile();
    }

    const payload: StoredUserLocation = {
      name: resolvedName,
      country,
      latitude,
      longitude,
      updatedAt: Date.now(),
    };

    writeStoredUserLocation(payload);
    return payload;
  } catch (error) {
    if (signedUpProvince) {
      return fromProfile();
    }

    const message = error instanceof Error ? error.message : "";
    if (message === "User denied Geolocation") {
      throw new Error("location/permission-denied");
    }
    throw error instanceof Error ? error : new Error("location/not-available");
  }
}
