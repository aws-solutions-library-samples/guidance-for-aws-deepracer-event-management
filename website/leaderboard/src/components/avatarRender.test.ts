import { describe, expect, it } from 'vitest';
import { HELMET_TOP, hatColourForHair, resolveAvatarRender } from './avatarRender';

describe('hatColourForHair', () => {
  it('maps hair colours to the nearest valid @vierweb hat colour', () => {
    expect(hatColourForHair('Brown')).toBe('Gray02');
    expect(hatColourForHair('Blonde')).toBe('PastelYellow');
    expect(hatColourForHair('Black')).toBe('Black');
    expect(hatColourForHair('Red')).toBe('Red');
  });

  it('returns undefined for an unknown hair colour', () => {
    expect(hatColourForHair('Rainbow')).toBeUndefined();
  });
});

describe('resolveAvatarRender', () => {
  it('uses the default Stig helmet for no config or the Helmet sentinel', () => {
    expect(resolveAvatarRender(null)).toEqual({ useDefault: true });
    expect(resolveAvatarRender({ topType: HELMET_TOP })).toEqual({ useDefault: true });
  });

  it('defaults an unset hatColor to the hair-mapped hat colour', () => {
    expect(resolveAvatarRender({ topType: 'WinterHat4', hairColor: 'Brown' })).toEqual({
      useDefault: false,
      config: { topType: 'WinterHat4', hairColor: 'Brown', hatColor: 'Gray02' },
    });
  });

  it('preserves an explicit hatColor and leaves unmappable configs untouched', () => {
    const explicit = { topType: 'WinterHat4', hairColor: 'Brown', hatColor: 'Red' };
    expect(resolveAvatarRender(explicit)).toEqual({ useDefault: false, config: explicit });
    const noHair = { topType: 'NoHair' };
    expect(resolveAvatarRender(noHair)).toEqual({ useDefault: false, config: noHair });
  });
});
