const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const monthMs = 30 * dayMs;
const yearMs = 365 * dayMs;

export function formatListingAge(createdAt: number, now = Date.now()) {
  if (!createdAt || !Number.isFinite(createdAt)) return "";

  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < minuteMs) {
    const value = Math.max(1, Math.floor(elapsed / 1000));
    return `Hace ${value}seg`;
  }

  if (elapsed < hourMs) {
    const value = Math.max(1, Math.floor(elapsed / minuteMs));
    return `Hace ${value} min`;
  }

  if (elapsed < dayMs) {
    const value = Math.max(1, Math.floor(elapsed / hourMs));
    return `Hace ${value} h`;
  }

  if (elapsed < monthMs) {
    const value = Math.max(1, Math.floor(elapsed / dayMs));
    return `Hace ${value} d`;
  }

  if (elapsed < yearMs) {
    const value = Math.max(1, Math.floor(elapsed / monthMs));
    return `Hace ${value}m`;
  }

  const value = Math.max(1, Math.floor(elapsed / yearMs));
  return `Hace ${value}a`;
}
