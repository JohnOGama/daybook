const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatMoney(cents: number, currency: string, { signed = false, compact = false } = {}): string {
  const text = formatterFor(currency, compact).format(Math.abs(cents) / 100);
  if (cents < 0) return `−${text}`;
  return signed && cents > 0 ? `+${text}` : text;
}

// Reads what someone types into an amount field ("1,250.5", "$12") as cents.
export function parseMoney(text: string, { allowNegative = false } = {}): number | null {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^[^\d.\-−]+/, '').replace('−', '-');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 1e13) return null;
  if (cents < 0 && !allowNegative) return null;
  return cents;
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, '');

export function currencySymbol(currency: string): string {
  return formatterFor(currency, false).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}
