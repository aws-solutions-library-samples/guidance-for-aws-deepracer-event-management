import { describe, it, expect } from 'vitest';
import {
  resolveRacingColour,
  nearestPaletteColour,
  DEFAULT_RACING_COLOUR,
  STOP_COLOUR,
} from './tailLightColour';
import { TAIL_LIGHT_COLOURS } from '../../../constants/tailLightColours';

describe('resolveRacingColour', () => {
  it('prefers override, then highlight, then the default', () => {
    expect(resolveRacingColour('#FF0000', '#00FF00')).toBe('#00FF00');
    expect(resolveRacingColour('#FF0000', null)).toBe('#FF0000');
    expect(resolveRacingColour(null, null)).toBe(DEFAULT_RACING_COLOUR);
    expect(resolveRacingColour('', '')).toBe(DEFAULT_RACING_COLOUR);
  });
});

describe('STOP_COLOUR', () => {
  it('is fixed white', () => {
    expect(STOP_COLOUR).toBe('#FFFFFF');
  });
});

describe('nearestPaletteColour', () => {
  it('returns a palette colour unchanged (distance 0)', () => {
    for (const c of TAIL_LIGHT_COLOURS) {
      expect(nearestPaletteColour(c).toUpperCase()).toBe(c.toUpperCase());
    }
  });

  it('snaps an out-of-palette hex to the nearest palette colour', () => {
    expect(nearestPaletteColour('#673ab7').toUpperCase()).toBe('#800080');
    expect(nearestPaletteColour('#e01010').toUpperCase()).toBe('#FF0000');
  });

  it('returns a palette colour for malformed input (falls back, never throws)', () => {
    expect(TAIL_LIGHT_COLOURS).toContain(nearestPaletteColour('nope'));
    expect(TAIL_LIGHT_COLOURS).toContain(nearestPaletteColour(''));
  });
});
