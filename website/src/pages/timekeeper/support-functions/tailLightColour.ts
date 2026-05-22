/** Racer has no highlight colour → white while racing. */
export const DEFAULT_RACING_COLOUR = '#FFFFFF';
/** Fallback "stopped" colour (also used when the racing colour has no usable hue). */
export const DEFAULT_STOP_COLOUR = '#FF0000';

/**
 * Colour to send to the car: operator override → racer highlight → default.
 * All inputs are expected to be `#RRGGBB` hex strings (or null/empty).
 */
export function resolveRacingColour(
  highlightColour?: string | null,
  override?: string | null
): string {
  return (
    (override && override.trim()) ||
    (highlightColour && highlightColour.trim()) ||
    DEFAULT_RACING_COLOUR
  );
}

interface Rgb { r: number; g: number; b: number; }
interface Hsl { h: number; s: number; l: number; }

function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const hh = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, hn + 1 / 3) * 255,
    g: hue2rgb(p, q, hn) * 255,
    b: hue2rgb(p, q, hn - 1 / 3) * 255,
  };
}

/**
 * Contrasting "stopped" colour for a racing colour.
 * - malformed / achromatic (white/grey/black) → DEFAULT_STOP_COLOUR
 * - racing hue in the red range (≥315° or ≤30°) → blue (#243: a green-ish
 *   complement reads poorly on stream)
 * - otherwise → 180° hue rotation at the same saturation/lightness
 */
export function complementaryColour(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_STOP_COLOUR;
  const hsl = rgbToHsl(rgb);
  if (hsl.s < 0.1) return DEFAULT_STOP_COLOUR;
  if (hsl.h >= 315 || hsl.h <= 30) return '#0000FF';
  return rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 }));
}
