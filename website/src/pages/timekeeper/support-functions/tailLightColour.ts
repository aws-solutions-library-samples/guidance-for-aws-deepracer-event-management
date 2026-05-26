import { graphqlQuery } from '../../../graphql/graphqlHelpers';
import { getRacerProfile } from '../../../graphql/queries';
import { carSetTaillightColor, carEmergencyStop } from '../../../graphql/mutations';
import { TAIL_LIGHT_COLOURS } from '../../../constants/tailLightColours';

/**
 * Racing colour when the racer has no highlight + no override. Blue (the car's
 * natural default tail-light, and palette[0]) — deliberately NOT white, which
 * is reserved as the stop signal (STOP_COLOUR) and excluded from the palette.
 */
export const DEFAULT_RACING_COLOUR = '#0000FF';
/** Fixed "stopped" colour, sent on race end (distinct from any racing colour). */
export const STOP_COLOUR = '#FFFFFF';

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

function hexToRgb(hex: string): [number, number, number] | null {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Snap an arbitrary hex to the nearest hardware-validated palette colour
 * (RGB Euclidean). An in-palette colour returns itself (distance 0); malformed
 * input falls back to the first palette colour (never throws). Defensive layer
 * for legacy profiles holding a hex that was dropped from the palette (e.g.
 * #673ab7) — the picker only offers palette colours, so new picks are exact.
 */
export function nearestPaletteColour(hex: string): string {
  const target = hexToRgb(hex);
  if (!target) return TAIL_LIGHT_COLOURS[0];
  let nearest = TAIL_LIGHT_COLOURS[0];
  let min = Infinity;
  for (const c of TAIL_LIGHT_COLOURS) {
    const rgb = hexToRgb(c)!;
    const d =
      (target[0] - rgb[0]) ** 2 + (target[1] - rgb[1]) ** 2 + (target[2] - rgb[2]) ** 2;
    if (d < min) {
      min = d;
      nearest = c;
    }
  }
  return nearest;
}

/**
 * Fetch the racer's profile, resolve + snap their highlight colour to a palette
 * hex, and set it on the car. Returns the colour applied + the stop colour, or
 * null if the racer has no highlight colour. Used by the classic race pages.
 */
export async function setTaillightFromProfile(
  carInstanceId: string,
  username: string
): Promise<{ raceColour: string; stopColour: string } | null> {
  try {
    const data = await graphqlQuery<{ getRacerProfile: { highlightColour?: string | null } | null }>(
      getRacerProfile,
      { username }
    );
    const hex = data?.getRacerProfile?.highlightColour;
    if (!hex) return null;
    const raceColour = nearestPaletteColour(hex);
    await graphqlQuery(carSetTaillightColor, { resourceIds: [carInstanceId], selectedColor: raceColour });
    return { raceColour, stopColour: STOP_COLOUR };
  } catch (err) {
    console.error('Failed to set taillight colour from profile:', err);
    return null;
  }
}

/** Set a specific hex colour on the car (used for the stop colour + reverts). */
export async function setTaillightColour(carInstanceId: string, colour: string): Promise<void> {
  try {
    await graphqlQuery(carSetTaillightColor, { resourceIds: [carInstanceId], selectedColor: colour });
  } catch (err) {
    console.error('Failed to set taillight colour:', err);
  }
}

/** Emergency-stop the car (sent on race end). */
export async function stopCar(carInstanceId: string): Promise<void> {
  try {
    await graphqlQuery(carEmergencyStop, { resourceIds: [carInstanceId] });
  } catch (err) {
    console.error('Failed to emergency stop car:', err);
  }
}
