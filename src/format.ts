export function formatMoney(value: string | number, currency: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
