import { describe, expect, it } from 'vitest';
import { HELMET_TOP, hatColourForHair, resolveAvatarRender } from './avatarRender';

describe('hatColourForHair', () => {
  it('maps hair colours to the nearest valid @vierweb hat colour', () => {
    expect(hatColourForHair('Brown')).toBe('Gray02');
    expect(hatColourForHair('Blonde')).toBe('PastelYellow');
    expect(hatColourForHair('Black')).toBe('Black');
    expect(hatColourForHair('Red')).toBe('Red');
  });

  it('returns undefined for an unknown hair colour (no guess)', () => {
    expect(hatColourForHair('Rainbow')).toBeUndefined();
  });
});

describe('resolveAvatarRender', () => {
  it('uses the default Stig helmet when there is no config', () => {
    expect(resolveAvatarRender(null)).toEqual({ useDefault: true });
  });

  it('uses the default Stig helmet when topType is the Helmet sentinel', () => {
    expect(resolveAvatarRender({ topType: HELMET_TOP, hairColor: 'Brown' })).toEqual({
      useDefault: true,
    });
  });

  it('defaults an unset hatColor to the hair-mapped hat colour', () => {
    expect(resolveAvatarRender({ topType: 'WinterHat4', hairColor: 'Brown' })).toEqual({
      useDefault: false,
      config: { topType: 'WinterHat4', hairColor: 'Brown', hatColor: 'Gray02' },
    });
  });

  it('preserves an explicit hatColor', () => {
    const parsed = { topType: 'WinterHat4', hairColor: 'Brown', hatColor: 'Red' };
    expect(resolveAvatarRender(parsed)).toEqual({ useDefault: false, config: parsed });
  });

  it('leaves config untouched when there is no hairColor to map from', () => {
    const parsed = { topType: 'NoHair' };
    expect(resolveAvatarRender(parsed)).toEqual({ useDefault: false, config: parsed });
  });

  it('leaves config untouched when the hair colour has no mapping', () => {
    const parsed = { topType: 'WinterHat4', hairColor: 'Rainbow' };
    expect(resolveAvatarRender(parsed)).toEqual({ useDefault: false, config: parsed });
  });
});
