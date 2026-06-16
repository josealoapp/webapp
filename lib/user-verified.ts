"use client";

export function subscribeVerifiedUser(userId: string, onData: (verified: boolean) => void) {
  if (!userId) {
    onData(false);
    return () => undefined;
  }

  let cancelled = false;

  const load = async () => {
    try {
      const response = await fetch(`/api/profile?scope=public&userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { profile?: { isVerified?: boolean } | null }
        | null;
      if (cancelled) return;
      onData(Boolean(payload?.profile?.isVerified));
    } catch {
      if (!cancelled) {
        onData(false);
      }
    }
  };

  void load();
  const intervalId = window.setInterval(load, 15000);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}
