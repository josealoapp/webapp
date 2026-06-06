export type PendingAuthAction = {
  type: "interest";
  returnTo: string;
  listingId: string;
  bazarItemId?: string;
  createdAt: number;
};

const PENDING_AUTH_ACTION_KEY = "pending_auth_action";
const MAX_PENDING_ACTION_AGE_MS = 30 * 60 * 1000;

export function savePendingAuthAction(action: PendingAuthAction) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_AUTH_ACTION_KEY, JSON.stringify(action));
}

export function readPendingAuthAction(): PendingAuthAction | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_AUTH_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAuthAction>;
    if (parsed.type !== "interest" || !parsed.returnTo || !parsed.listingId || !parsed.createdAt) {
      clearPendingAuthAction();
      return null;
    }

    if (Date.now() - Number(parsed.createdAt) > MAX_PENDING_ACTION_AGE_MS) {
      clearPendingAuthAction();
      return null;
    }

    return {
      type: "interest",
      returnTo: parsed.returnTo,
      listingId: parsed.listingId,
      bazarItemId: parsed.bazarItemId,
      createdAt: Number(parsed.createdAt),
    };
  } catch {
    clearPendingAuthAction();
    return null;
  }
}

export function clearPendingAuthAction() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_AUTH_ACTION_KEY);
}
