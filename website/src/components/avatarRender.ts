/**
 * Sentinel `topType` for the default DeepRacer helmet ("Stig"). Not a real
 * avataaars top — when selected, the helmet SVG is shown instead of an avataaars
 * avatar (matching DRoA, where `top === 'Helmet'` does the same).
 */
export const HELMET_TOP = 'Helmet';

/**
 * Nearest valid @vierweb/avataaars hat colour for each hair colour.
 *
 * @vierweb/avataaars@3 only accepts the clothing-fabric palette for `hatColor`
 * (Black, Blue01–03, Gray01–02, Heather, Pastel*, Pink, Red, White) and falls
 * back to blue for anything else — so a hair colour can't be passed through
 * directly. avataaars@2 (and DRoA) rendered hats in the hair colour by default;
 * we approximate that here so hats stop defaulting to blue. The hat palette has
 * no true brown/blonde, so browns map to neutrals and blondes to pale yellow.
 */
const HAIR_TO_HAT_COLOUR: Record<string, string> = {
  Auburn: 'Gray02',
  Black: 'Black',
  Blonde: 'PastelYellow',
  BlondeGolden: 'PastelYellow',
  Brown: 'Gray02',
  BrownDark: 'Heather',
  PastelPink: 'Pink',
  Platinum: 'Gray01',
  Red: 'Red',
  SilverGray: 'Gray01',
};

/** The nearest valid hat colour for a hair colour, or undefined if unmapped. */
export function hatColourForHair(hairColor: string): string | undefined {
  return HAIR_TO_HAT_COLOUR[hairColor];
}

export type AvatarRender =
  | { useDefault: true }
  | { useDefault: false; config: Record<string, string> };

/**
 * Decide how to render an avatar from its (already-parsed) config:
 * - the Stig helmet SVG when there's no config or the Helmet sentinel is chosen;
 * - otherwise the avataaars props, defaulting an unset `hatColor` to the
 *   hair-mapped hat colour so hats track hair instead of defaulting to blue.
 */
export function resolveAvatarRender(parsed: Record<string, string> | null): AvatarRender {
  if (!parsed || parsed.topType === HELMET_TOP) {
    return { useDefault: true };
  }
  if (!parsed.hatColor && parsed.hairColor) {
    const mapped = hatColourForHair(parsed.hairColor);
    if (mapped) {
      return { useDefault: false, config: { ...parsed, hatColor: mapped } };
    }
  }
  return { useDefault: false, config: parsed };
}
