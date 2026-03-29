"use client";

export const SUPPORTED_LISTING_LOCATIONS = [
  { name: "Santo Domingo", latitude: 18.4861, longitude: -69.9312 },
  { name: "San Cristóbal", latitude: 18.4167, longitude: -70.1167 },
  { name: "Santiago", latitude: 19.4517, longitude: -70.697 },
  { name: "La Romana", latitude: 18.4273, longitude: -68.9728 },
  { name: "Punta Cana", latitude: 18.5601, longitude: -68.3725 },
  { name: "San Pedro de Macorís", latitude: 18.4539, longitude: -69.3067 },
  { name: "Puerto Plata", latitude: 19.7902, longitude: -70.6884 },
] as const;

export type SupportedListingLocation = (typeof SUPPORTED_LISTING_LOCATIONS)[number]["name"];

const USER_LOCATION_KEY = "josealo_user_location";

type StoredUserLocation = {
  name: SupportedListingLocation;
  latitude: number;
  longitude: number;
  updatedAt: number;
};

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

export function resolveSupportedLocation(latitude: number, longitude: number): SupportedListingLocation {
  return SUPPORTED_LISTING_LOCATIONS.reduce<{ name: SupportedListingLocation; distance: number }>(
    (closest, option) => {
      const distance = haversineDistanceKm(latitude, longitude, option.latitude, option.longitude);
      return distance < closest.distance ? { name: option.name, distance } : closest;
    },
    { name: SUPPORTED_LISTING_LOCATIONS[0].name, distance: Number.POSITIVE_INFINITY }
  ).name;
}

export function readStoredUserLocation() {
  if (typeof window === "undefined") return null as StoredUserLocation | null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserLocation>;
    if (!parsed.name || typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }

    return {
      name: parsed.name,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
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

export async function requestCurrentSupportedLocation(): Promise<StoredUserLocation> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    throw new Error("location/not-supported");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const name = resolveSupportedLocation(latitude, longitude);

  const payload = {
    name,
    latitude,
    longitude,
    updatedAt: Date.now(),
  };

  writeStoredUserLocation(payload);
  return payload;
}
