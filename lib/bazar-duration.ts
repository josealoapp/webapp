export const BAZAR_DURATION_OPTIONS = [
  { value: 1, label: "1 hora" },
  { value: 24, label: "24 horas" },
  { value: 168, label: "7 días" },
  { value: 336, label: "14 días" },
] as const;

export type BazarDurationHours = (typeof BAZAR_DURATION_OPTIONS)[number]["value"];

const VALID_BAZAR_DURATIONS = new Set<number>(BAZAR_DURATION_OPTIONS.map((option) => option.value));
const HOUR_MS = 60 * 60 * 1000;

export function isValidBazarDuration(value: number): value is BazarDurationHours {
  return VALID_BAZAR_DURATIONS.has(value);
}

export function getBazarEndsAt(createdAt: number, durationHours: number) {
  return createdAt + durationHours * HOUR_MS;
}

export function formatBazarTimeLeft(endsAt: number, now = Date.now()) {
  const remaining = Math.max(0, endsAt - now);
  if (!endsAt || remaining <= 0) return "Finalizado";

  if (remaining < HOUR_MS) {
    const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `Acaba en ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const hours = Math.ceil(remaining / HOUR_MS);
  if (hours < 48) {
    return `Acaba en ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  const days = Math.ceil(hours / 24);
  return `Acaba en ${days} ${days === 1 ? "día" : "días"}`;
}

export function formatBazarTimeLeftShort(endsAt: number, now = Date.now()) {
  const remaining = Math.max(0, endsAt - now);
  if (!endsAt || remaining <= 0) return "0s";

  const totalSeconds = Math.ceil(remaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 48) return `${totalHours}h`;

  return `${Math.ceil(totalHours / 24)}d`;
}
