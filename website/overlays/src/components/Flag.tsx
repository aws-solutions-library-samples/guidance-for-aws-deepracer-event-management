/**
 * Render an ISO-3166 alpha-2 country code as the corresponding regional-
 * indicator flag emoji. Same mapping used elsewhere in DREM — `'GB'` →
 * 🇬🇧, `'US'` → 🇺🇸, etc.
 */

function countryToFlag(isoCode: string): string {
  if (!isoCode || isoCode.length !== 2) return '';
  const A = 'A'.charCodeAt(0);
  const BASE = 0x1f1e6;
  const upper = isoCode.toUpperCase();
  const c0 = upper.charCodeAt(0);
  const c1 = upper.charCodeAt(1);
  if (c0 < A || c0 > A + 25 || c1 < A || c1 > A + 25) return '';
  return String.fromCodePoint(BASE + (c0 - A)) + String.fromCodePoint(BASE + (c1 - A));
}

interface FlagProps {
  countryCode?: string | null;
  className?: string;
}

export function Flag({ countryCode, className }: FlagProps) {
  if (!countryCode) return null;
  const flag = countryToFlag(countryCode);
  if (!flag) return null;
  return <span className={className}>{flag}</span>;
}
