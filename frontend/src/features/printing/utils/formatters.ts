export type PrintableValue = number | string | null | undefined;

function toFiniteNumber(value: PrintableValue): number {
  const number = value == null ? 0 : Number(value);
  if (!Number.isFinite(number)) {
    throw new RangeError(`Cannot format non-finite printable value: ${value}`);
  }
  return number;
}

function assertValidDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Cannot format invalid printable date: ${value}`);
  }
  return date;
}

export function formatPrintNumber(
  value: PrintableValue,
  options: {
    locale?: string;
    decimals?: number;
    useGrouping?: boolean;
  } = {},
): string {
  const { locale = "en-US", decimals = 2, useGrouping = true } = options;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(toFiniteNumber(value));
}

export function formatPrintCurrency(
  value: PrintableValue,
  currency: string,
  options?: Parameters<typeof formatPrintNumber>[1],
): string {
  return `${currency} ${formatPrintNumber(value, options)}`;
}

export function formatPrintDate(
  value: string | Date,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(assertValidDate(value));
}

export function formatPrintDateTime(
  value: string | Date,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(assertValidDate(value));
}
