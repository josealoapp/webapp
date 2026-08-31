export type MoneyCurrency = "DOP" | "USD" | string | undefined | null;

export function formatMoney(value: number, currency: MoneyCurrency = "DOP") {
  const prefix = currency === "USD" ? "USD" : "RD$";
  return `${prefix}${Number(value || 0).toLocaleString("es-DO")}`;
}
