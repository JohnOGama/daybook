const number = (value: number, digits = 0) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatKcal = (kcal: number) => `${number(Math.round(kcal))} kcal`;
export const formatGrams = (mg: number) => `${number(Math.round(mg / 1000))} g`;
export const formatKg = (grams: number) => `${number(grams / 1000, 1)} kg`;

// '1,5' and '1.5' both read as 1.5; anything that is not a positive number is null.
export function parseAmount(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}
