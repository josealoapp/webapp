const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function getAccountAgeLabel(createdAt: number) {
  if (!createdAt) {
    return { text: "Nueva cuenta", isNew: true };
  }

  const ageMs = Math.max(0, Date.now() - createdAt);
  if (ageMs < MONTH_MS) {
    return { text: "Nueva cuenta", isNew: true };
  }

  if (ageMs < YEAR_MS) {
    const months = Math.max(1, Math.floor(ageMs / MONTH_MS));
    return {
      text: `Creada hace ${months} ${months === 1 ? "mes" : "meses"}`,
      isNew: false,
    };
  }

  const years = Math.max(1, Math.floor(ageMs / YEAR_MS));
  return {
    text: `Creada hace ${years} ${years === 1 ? "año" : "años"}`,
    isNew: false,
  };
}
