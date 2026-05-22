import { describe, it, expect } from 'vitest';
import {
  resolveRacingColour,
  complementaryColour,
  DEFAULT_RACING_COLOUR,
  DEFAULT_STOP_COLOUR,
} from './tailLightColour';

describe('resolveRacingColour', () => {
  it('prefers override, then highlight, then the default', () => {
    expect(resolveRacingColour('#FF0000', '#00FF00')).toBe('#00FF00');
    expect(resolveRacingColour('#FF0000', null)).toBe('#FF0000');
    expect(resolveRacingColour(null, null)).toBe(DEFAULT_RACING_COLOUR);
    expect(resolveRacingColour('', '')).toBe(DEFAULT_RACING_COLOUR);
  });
});

describe('complementaryColour', () => {
  it('returns blue when the racing colour is in the red range (#243 rule)', () => {
    expect(complementaryColour('#FF0000')).toBe('#0000FF');
  });

  it('rotates hue 180° for non-red colours', () => {
    expect(complementaryColour('#0000FF')).toBe('#FFFF00'); // blue → yellow
    expect(complementaryColour('#00FF00')).toBe('#FF00FF'); // green → magenta
  });

  it('treats hot-pink (hue ~326°) as red-range → blue', () => {
    expect(complementaryColour('#FF0090')).toBe('#0000FF');
  });

  it('expands 3-digit hex shorthand', () => {
    expect(complementaryColour('#F00')).toBe('#0000FF'); // #F00 → #FF0000 (red range)
  });

  it('returns the stop default for achromatic input', () => {
    expect(complementaryColour('#FFFFFF')).toBe(DEFAULT_STOP_COLOUR);
    expect(complementaryColour('#808080')).toBe(DEFAULT_STOP_COLOUR);
  });

  it('returns the stop default for malformed input', () => {
    expect(complementaryColour('nope')).toBe(DEFAULT_STOP_COLOUR);
  });
});
