"use client";

export const DEFAULT_PROFILE_AVATAR = "/default-avatar.svg";

type ProfileAvatarRegistry = Record<string, string>;

const PROFILE_AVATAR_KEY = "josealo_profile_avatars";
const PROFILE_AVATAR_EVENT = "josealo:profile-avatar-changed";

function readRegistry() {
  if (typeof window === "undefined") return {} as ProfileAvatarRegistry;

  try {
    const raw = window.localStorage.getItem(PROFILE_AVATAR_KEY);
    if (!raw) return {} as ProfileAvatarRegistry;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ProfileAvatarRegistry) : {};
  } catch {
    return {} as ProfileAvatarRegistry;
  }
}

function writeRegistry(registry: ProfileAvatarRegistry) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_AVATAR_KEY, JSON.stringify(registry));
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_EVENT));
}

export function readProfileAvatar(userId: string) {
  if (!userId) return "";
  return readRegistry()[userId] || "";
}

export function writeProfileAvatar(userId: string, value: string) {
  if (!userId) return;
  const registry = readRegistry();

  if (value) {
    registry[userId] = value;
  } else {
    delete registry[userId];
  }

  writeRegistry(registry);
}

export function subscribeProfileAvatar(userId: string, onData: (value: string) => void) {
  const publish = () => onData(readProfileAvatar(userId));

  if (typeof window === "undefined") {
    publish();
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== PROFILE_AVATAR_KEY) return;
    publish();
  };
  const handleCustom = () => publish();

  publish();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PROFILE_AVATAR_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PROFILE_AVATAR_EVENT, handleCustom);
  };
}
