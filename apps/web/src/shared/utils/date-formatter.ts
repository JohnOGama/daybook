const pad = (value: number) => String(value).padStart(2, '0');

function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function localDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return localDay(date);
}

export function formatDayHeading(day: string): string {
  const date = parseDay(day);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday}, ${date.getDate()} ${month}`;
}

const shortDate = (date: Date) => `${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;

export function formatShortDate(iso: string): string {
  return shortDate(new Date(iso));
}

export function formatShortDay(day: string): string {
  return shortDate(parseDay(day));
}
