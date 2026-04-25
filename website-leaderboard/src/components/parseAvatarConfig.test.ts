import { describe, expect, it } from 'vitest';
import { parseAvatarConfig } from './parseAvatarConfig';

describe('parseAvatarConfig', () => {
  it('parses a valid JSON object', () => {
    const config = { topType: 'ShortHairShortFlat', clotheType: 'Hoodie' };
    expect(parseAvatarConfig(config)).toEqual(config);
  });

  it('parses a JSON string', () => {
    const json = '{"topType":"ShortHairShortFlat"}';
    expect(parseAvatarConfig(json)).toEqual({ topType: 'ShortHairShortFlat' });
  });

  it('handles double-encoded AWSJSON string', () => {
    const doubleEncoded = '"{\\"topType\\":\\"ShortHairShortFlat\\"}"';
    expect(parseAvatarConfig(doubleEncoded)).toEqual({ topType: 'ShortHairShortFlat' });
  });

  it('returns null for null input', () => {
    expect(parseAvatarConfig(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseAvatarConfig(undefined)).toBeNull();
  });

  it('returns null for invalid JSON string', () => {
    expect(parseAvatarConfig('not valid json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAvatarConfig('')).toBeNull();
  });
});
